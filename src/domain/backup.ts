import { PLANNER_SCHEMA_VERSION } from './model'
import { failure, success } from './result'
import type {
  FixedEvent,
  PlannerDocument,
  Project,
  Revision,
  RevisionKind,
  Task,
  TaskSession,
} from './model'
import type { Result } from './result'

const maximumTitleLength = 200
const maximumReasonLength = 300

export interface BackupFailure {
  code:
    | 'invalid-json'
    | 'invalid-backup'
    | 'unsupported-version'
  message: string
}

export const serialiseBackup = (
  document: PlannerDocument,
): Result<string, BackupFailure> => {
  const validated = validatePlannerDocument(document)
  if (!validated.ok) {
    return validated
  }
  return success(JSON.stringify(validated.value, null, 2))
}

export const parseBackup = (raw: string): Result<PlannerDocument, BackupFailure> => {
  let candidate: unknown
  try {
    candidate = JSON.parse(raw) as unknown
  } catch {
    return failure({
      code: 'invalid-json',
      message: 'This backup is not valid JSON.',
    })
  }

  return validatePlannerDocument(candidate)
}

export const validatePlannerDocument = (
  candidate: unknown,
): Result<PlannerDocument, BackupFailure> => {
  if (!isRecord(candidate)) {
    return invalidBackup('A backup must contain a planner document.')
  }

  // Handle migration from earlier versions to current schema (v3)
  let docRecord = candidate
  if (docRecord.schemaVersion === 1) {
    if (
      !hasOnlyKeys(docRecord, [
        'schemaVersion',
        'timeZone',
        'revision',
        'projects',
        'tasks',
        'revisions',
      ])
    ) {
      return invalidBackup('A backup contains unsupported document fields.')
    }
    docRecord = {
      ...docRecord,
      schemaVersion: PLANNER_SCHEMA_VERSION,
      fixedEvents: [],
      taskSessions: [],
    }
  } else if (docRecord.schemaVersion === 2) {
    if (
      !hasOnlyKeys(docRecord, [
        'schemaVersion',
        'timeZone',
        'revision',
        'projects',
        'tasks',
        'fixedEvents',
        'taskSessions',
        'revisions',
      ])
    ) {
      return invalidBackup('A backup contains unsupported document fields.')
    }
    docRecord = {
      ...docRecord,
      schemaVersion: PLANNER_SCHEMA_VERSION,
    }
  }

  if (
    !hasOnlyKeys(docRecord, [
      'schemaVersion',
      'timeZone',
      'revision',
      'projects',
      'tasks',
      'fixedEvents',
      'taskSessions',
      'revisions',
    ])
  ) {
    return invalidBackup('A backup contains unsupported document fields.')
  }

  if (docRecord.schemaVersion !== PLANNER_SCHEMA_VERSION) {
    return failure({
      code: 'unsupported-version',
      message: `This backup uses an unsupported schema version: ${String(docRecord.schemaVersion)}.`,
    })
  }

  if (!isIanaTimeZone(docRecord.timeZone)) {
    return invalidBackup('A backup needs a valid IANA time zone.')
  }

  if (!isNonNegativeInteger(docRecord.revision)) {
    return invalidBackup('A backup needs a non-negative revision number.')
  }
  const documentRevision = docRecord.revision

  const identifiers = new Set<string>()

  const projects = parseProjects(docRecord.projects, identifiers)
  if (!projects.ok) {
    return projects
  }

  const tasks = parseTasks(docRecord.tasks, projects.value, identifiers)
  if (!tasks.ok) {
    return tasks
  }

  const fixedEvents = parseFixedEvents(docRecord.fixedEvents, identifiers)
  if (!fixedEvents.ok) {
    return fixedEvents
  }

  const taskSessions = parseTaskSessions(docRecord.taskSessions, tasks.value, identifiers)
  if (!taskSessions.ok) {
    return taskSessions
  }

  const revisions = parseRevisions(docRecord.revisions, documentRevision)
  if (!revisions.ok) {
    return revisions
  }

  return success({
    schemaVersion: PLANNER_SCHEMA_VERSION,
    timeZone: docRecord.timeZone,
    revision: documentRevision,
    projects: projects.value,
    tasks: tasks.value,
    fixedEvents: fixedEvents.value,
    taskSessions: taskSessions.value,
    revisions: revisions.value,
  })
}

const parseProjects = (
  candidate: unknown,
  identifiers: Set<string>,
): Result<Project[], BackupFailure> => {
  if (!Array.isArray(candidate)) {
    return invalidBackup('Projects must be an array.')
  }

  const projects: Project[] = []
  for (const item of candidate) {
    if (
      !isRecord(item) ||
      !hasOnlyKeys(item, ['id', 'title', 'createdAt', 'updatedAt']) ||
      !isIdentifier(item.id) ||
      !isTitle(item.title)
    ) {
      return invalidBackup('Every project needs a stable ID and a valid title.')
    }
    if (!isUtcTimestamp(item.createdAt) || !isUtcTimestamp(item.updatedAt)) {
      return invalidBackup('Every project needs UTC creation and update timestamps.')
    }
    if (identifiers.has(item.id)) {
      return invalidBackup('Project IDs must be unique.')
    }
    identifiers.add(item.id)
    projects.push({
      id: item.id,
      title: item.title,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })
  }
  return success(projects)
}

const parseTasks = (
  candidate: unknown,
  projects: Project[],
  identifiers: Set<string>,
): Result<Task[], BackupFailure> => {
  if (!Array.isArray(candidate)) {
    return invalidBackup('Tasks must be an array.')
  }

  const projectIds = new Set(projects.map((project) => project.id))
  const tasks: Task[] = []
  for (const item of candidate) {
    if (
      !isRecord(item) ||
      !hasOnlyKeys(item, [
        'id',
        'projectId',
        'parentTaskId',
        'title',
        'completed',
        'estimateMinutes',
        'dueAt',
        'earliestStartAt',
        'createdAt',
        'updatedAt',
      ]) ||
      !isIdentifier(item.id) ||
      !isIdentifier(item.projectId) ||
      !isTitle(item.title) ||
      typeof item.completed !== 'boolean'
    ) {
      return invalidBackup('Every task needs valid IDs, a title and a completion state.')
    }
    if (!projectIds.has(item.projectId)) {
      return invalidBackup('Every task must belong to an imported project.')
    }
    if (item.parentTaskId !== undefined && (!isIdentifier(item.parentTaskId) || item.parentTaskId === item.id)) {
      return invalidBackup('Subtasks need a valid, distinct parent task ID.')
    }
    if (
      item.estimateMinutes !== undefined &&
      (typeof item.estimateMinutes !== 'number' ||
        !Number.isInteger(item.estimateMinutes) ||
        item.estimateMinutes <= 0 ||
        item.estimateMinutes > 1440)
    ) {
      return invalidBackup('Task estimated duration must be an integer between 1 and 1440 minutes.')
    }
    if (item.dueAt !== undefined && !isUtcTimestamp(item.dueAt)) {
      return invalidBackup('Task due date must be a valid UTC timestamp.')
    }
    if (item.earliestStartAt !== undefined && !isUtcTimestamp(item.earliestStartAt)) {
      return invalidBackup('Task earliest start date must be a valid UTC timestamp.')
    }
    if (
      typeof item.earliestStartAt === 'string' &&
      typeof item.dueAt === 'string' &&
      Date.parse(item.earliestStartAt) >= Date.parse(item.dueAt)
    ) {
      return invalidBackup('Task earliest start date must be before due date.')
    }
    if (!isUtcTimestamp(item.createdAt) || !isUtcTimestamp(item.updatedAt)) {
      return invalidBackup('Every task needs UTC creation and update timestamps.')
    }
    if (identifiers.has(item.id)) {
      return invalidBackup('Project and task IDs must be unique together.')
    }
    identifiers.add(item.id)

    const task: Task = {
      id: item.id,
      projectId: item.projectId,
      title: item.title,
      completed: item.completed,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }
    if (typeof item.parentTaskId === 'string') task.parentTaskId = item.parentTaskId
    if (typeof item.estimateMinutes === 'number') task.estimateMinutes = item.estimateMinutes
    if (typeof item.dueAt === 'string') task.dueAt = item.dueAt
    if (typeof item.earliestStartAt === 'string') task.earliestStartAt = item.earliestStartAt

    tasks.push(task)
  }

  const taskMap = new Map(tasks.map((task) => [task.id, task]))
  for (const task of tasks) {
    if (task.parentTaskId !== undefined) {
      const parent = taskMap.get(task.parentTaskId)
      if (!parent || parent.projectId !== task.projectId) {
        return invalidBackup('Subtasks must belong to an imported parent task in the same project.')
      }
      if (parent.parentTaskId !== undefined) {
        return invalidBackup('Subtasks cannot be nested under another subtask.')
      }
    }
  }

  return success(tasks)
}

const parseFixedEvents = (
  candidate: unknown,
  identifiers: Set<string>,
): Result<FixedEvent[], BackupFailure> => {
  if (!Array.isArray(candidate)) {
    return invalidBackup('Fixed events must be an array.')
  }

  const events: FixedEvent[] = []
  for (const item of candidate) {
    if (
      !isRecord(item) ||
      !hasOnlyKeys(item, ['id', 'title', 'startAt', 'endAt', 'createdAt', 'updatedAt']) ||
      !isIdentifier(item.id) ||
      !isTitle(item.title)
    ) {
      return invalidBackup('Every fixed event needs a stable ID and a valid title.')
    }
    if (!isUtcTimestamp(item.startAt) || !isUtcTimestamp(item.endAt)) {
      return invalidBackup('Every fixed event needs valid UTC start and end timestamps.')
    }
    if (Date.parse(item.startAt) >= Date.parse(item.endAt)) {
      return invalidBackup('Fixed event start time must be before end time.')
    }
    if (!isUtcTimestamp(item.createdAt) || !isUtcTimestamp(item.updatedAt)) {
      return invalidBackup('Every fixed event needs UTC creation and update timestamps.')
    }
    if (identifiers.has(item.id)) {
      return invalidBackup('Document item IDs must be unique.')
    }
    identifiers.add(item.id)
    events.push({
      id: item.id,
      title: item.title,
      startAt: item.startAt,
      endAt: item.endAt,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })
  }
  return success(events)
}

const parseTaskSessions = (
  candidate: unknown,
  tasks: Task[],
  identifiers: Set<string>,
): Result<TaskSession[], BackupFailure> => {
  if (!Array.isArray(candidate)) {
    return invalidBackup('Task sessions must be an array.')
  }

  const taskIds = new Set(tasks.map((task) => task.id))
  const sessions: TaskSession[] = []
  for (const item of candidate) {
    if (
      !isRecord(item) ||
      !hasOnlyKeys(item, ['id', 'taskId', 'startAt', 'endAt', 'createdAt', 'updatedAt']) ||
      !isIdentifier(item.id) ||
      !isIdentifier(item.taskId)
    ) {
      return invalidBackup('Every task session needs stable session and task IDs.')
    }
    if (!taskIds.has(item.taskId)) {
      return invalidBackup('Every task session must belong to an imported task.')
    }
    if (!isUtcTimestamp(item.startAt) || !isUtcTimestamp(item.endAt)) {
      return invalidBackup('Every task session needs valid UTC start and end timestamps.')
    }
    if (Date.parse(item.startAt) >= Date.parse(item.endAt)) {
      return invalidBackup('Task session start time must be before end time.')
    }
    if (!isUtcTimestamp(item.createdAt) || !isUtcTimestamp(item.updatedAt)) {
      return invalidBackup('Every task session needs UTC creation and update timestamps.')
    }
    if (identifiers.has(item.id)) {
      return invalidBackup('Document item IDs must be unique.')
    }
    identifiers.add(item.id)
    sessions.push({
      id: item.id,
      taskId: item.taskId,
      startAt: item.startAt,
      endAt: item.endAt,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })
  }
  return success(sessions)
}

const revisionKinds: readonly RevisionKind[] = [
  'project-created',
  'task-created',
  'subtask-created',
  'task-completion-changed',
  'task-constraints-updated',
  'fixed-event-created',
  'fixed-event-deleted',
  'task-session-created',
  'task-session-deleted',
]

const parseRevisions = (
  candidate: unknown,
  documentRevision: number,
): Result<Revision[], BackupFailure> => {
  if (!Array.isArray(candidate)) {
    return invalidBackup('Revisions must be an array.')
  }
  if (candidate.length !== documentRevision) {
    return invalidBackup('The document revision must match the revision history.')
  }

  const identifiers = new Set<string>()
  const revisions: Revision[] = []
  for (const [index, item] of candidate.entries()) {
    if (
      !isRecord(item) ||
      !hasOnlyKeys(item, ['id', 'number', 'kind', 'reason', 'occurredAt']) ||
      !isIdentifier(item.id) ||
      !Number.isInteger(item.number) ||
      item.number !== index + 1 ||
      !isRevisionKind(item.kind) ||
      !isReason(item.reason) ||
      !isUtcTimestamp(item.occurredAt)
    ) {
      return invalidBackup('Every revision needs valid ordered audit information.')
    }
    if (identifiers.has(item.id)) {
      return invalidBackup('Revision IDs must be unique.')
    }
    identifiers.add(item.id)
    revisions.push({
      id: item.id,
      number: item.number,
      kind: item.kind,
      reason: item.reason,
      occurredAt: item.occurredAt,
    })
  }
  return success(revisions)
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const hasOnlyKeys = (record: Record<string, unknown>, allowed: string[]): boolean =>
  Object.keys(record).every((key) => allowed.includes(key))

const isIdentifier = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= 128

const isTitle = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.trim() === value &&
  value.length > 0 &&
  value.length <= maximumTitleLength

const isReason = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.trim() === value &&
  value.length > 0 &&
  value.length <= maximumReasonLength

const isRevisionKind = (value: unknown): value is RevisionKind =>
  typeof value === 'string' && revisionKinds.includes(value as RevisionKind)

const isUtcTimestamp = (value: unknown): value is string => {
  if (typeof value !== 'string') {
    return false
  }
  const instant = new Date(value)
  return !Number.isNaN(instant.getTime()) && instant.toISOString() === value
}

const isNonNegativeInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0

const isIanaTimeZone = (value: unknown): value is string => {
  if (typeof value !== 'string' || value.length === 0) {
    return false
  }
  try {
    Intl.DateTimeFormat('en-GB', { timeZone: value })
    return true
  } catch {
    return false
  }
}

const invalidBackup = <T>(message: string): Result<T, BackupFailure> =>
  failure({ code: 'invalid-backup', message })
