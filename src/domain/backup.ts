import { DEFAULT_AVAILABILITY, DEFAULT_POLICY, PLANNER_SCHEMA_VERSION } from './model'
import { failure, success } from './result'
import type {
  Availability,
  AvailabilityWindow,
  Dependency,
  FixedEvent,
  PlannerDocument,
  PlanningPolicy,
  PolicyPreset,
  Project,
  ProposalCapability,
  ProposalDecision,
  ProposalProvenance,
  Revision,
  RevisionKind,
  Task,
  TaskSession,
} from './model'
import type { Result } from './result'
import { hasDependencyCycle } from './dependency-graph'

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

  // Handle migration from earlier versions to current schema (v6)
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
      dependencies: [],
      availability: DEFAULT_AVAILABILITY,
      policy: DEFAULT_POLICY,
      proposals: [],
    }
  } else if (docRecord.schemaVersion === 2 || docRecord.schemaVersion === 3) {
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
      dependencies: [],
      availability: DEFAULT_AVAILABILITY,
      policy: DEFAULT_POLICY,
      proposals: [],
    }
  } else if (docRecord.schemaVersion === 4) {
    if (
      !hasOnlyKeys(docRecord, [
        'schemaVersion',
        'timeZone',
        'revision',
        'projects',
        'tasks',
        'dependencies',
        'availability',
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
      policy: DEFAULT_POLICY,
      proposals: [],
    }
  } else if (docRecord.schemaVersion === 5) {
    if (
      !hasOnlyKeys(docRecord, [
        'schemaVersion',
        'timeZone',
        'revision',
        'projects',
        'tasks',
        'dependencies',
        'availability',
        'policy',
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
      proposals: [],
    }
  }

  if (
    !hasOnlyKeys(docRecord, [
      'schemaVersion',
      'timeZone',
      'revision',
      'projects',
      'tasks',
      'dependencies',
      'availability',
      'policy',
      'fixedEvents',
      'taskSessions',
      'proposals',
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

  const dependencies = parseDependencies(docRecord.dependencies, tasks.value, identifiers)
  if (!dependencies.ok) {
    return dependencies
  }

  const availability = parseAvailability(docRecord.availability)
  if (!availability.ok) {
    return availability
  }

  const policy = parsePolicy(docRecord.policy)
  if (!policy.ok) {
    return policy
  }

  const fixedEvents = parseFixedEvents(docRecord.fixedEvents, identifiers)
  if (!fixedEvents.ok) {
    return fixedEvents
  }

  const taskSessions = parseTaskSessions(docRecord.taskSessions, tasks.value, identifiers)
  if (!taskSessions.ok) {
    return taskSessions
  }

  const proposals = parseProposals(docRecord.proposals, tasks.value, identifiers)
  if (!proposals.ok) {
    return proposals
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
    dependencies: dependencies.value,
    availability: availability.value,
    policy: policy.value,
    fixedEvents: fixedEvents.value,
    taskSessions: taskSessions.value,
    proposals: proposals.value,
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
      !hasOnlyKeys(item, ['id', 'title', 'color', 'createdAt', 'updatedAt']) ||
      !isIdentifier(item.id) ||
      !isTitle(item.title)
    ) {
      return invalidBackup('Every project needs a stable ID and a valid title.')
    }
    if (item.color !== undefined && (typeof item.color !== 'string' || item.color.length > 50)) {
      return invalidBackup('Project color must be a valid color string.')
    }
    if (!isUtcTimestamp(item.createdAt) || !isUtcTimestamp(item.updatedAt)) {
      return invalidBackup('Every project needs UTC creation and update timestamps.')
    }
    if (identifiers.has(item.id)) {
      return invalidBackup('Project IDs must be unique.')
    }
    identifiers.add(item.id)
    const project: Project = {
      id: item.id,
      title: item.title,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }
    if (typeof item.color === 'string') project.color = item.color
    projects.push(project)
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
        'notes',
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
    if (item.notes !== undefined && (typeof item.notes !== 'string' || item.notes.length > 5000)) {
      return invalidBackup('Task notes must be a string up to 5000 characters.')
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
    if (typeof item.notes === 'string') task.notes = item.notes

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

const parseDependencies = (
  candidate: unknown,
  tasks: Task[],
  identifiers: Set<string>,
): Result<Dependency[], BackupFailure> => {
  if (!Array.isArray(candidate)) {
    return invalidBackup('Dependencies must be an array.')
  }

  const taskIds = new Set(tasks.map((task) => task.id))
  const dependencies: Dependency[] = []

  for (const item of candidate) {
    if (
      !isRecord(item) ||
      !hasOnlyKeys(item, ['id', 'fromTaskId', 'toTaskId', 'createdAt']) ||
      !isIdentifier(item.id) ||
      !isIdentifier(item.fromTaskId) ||
      !isIdentifier(item.toTaskId) ||
      !isUtcTimestamp(item.createdAt)
    ) {
      return invalidBackup('Every dependency needs valid IDs and a UTC timestamp.')
    }
    if (item.fromTaskId === item.toTaskId) {
      return invalidBackup('A dependency cannot link a task to itself.')
    }
    if (!taskIds.has(item.fromTaskId) || !taskIds.has(item.toTaskId)) {
      return invalidBackup('Every dependency must link imported tasks.')
    }
    if (identifiers.has(item.id)) {
      return invalidBackup('Dependency IDs must be unique.')
    }
    identifiers.add(item.id)
    dependencies.push({
      id: item.id,
      fromTaskId: item.fromTaskId,
      toTaskId: item.toTaskId,
      createdAt: item.createdAt,
    })
  }

  if (hasDependencyCycle(dependencies)) {
    return invalidBackup('Dependencies cannot contain circular relationships.')
  }

  return success(dependencies)
}

const parseAvailability = (candidate: unknown): Result<Availability, BackupFailure> => {
  if (!isRecord(candidate) || !hasOnlyKeys(candidate, ['workingWindows'])) {
    return invalidBackup('Availability must define working windows.')
  }

  if (!Array.isArray(candidate.workingWindows)) {
    return invalidBackup('Availability working windows must be an array.')
  }

  const windows: AvailabilityWindow[] = []
  for (const item of candidate.workingWindows) {
    if (
      !isRecord(item) ||
      !hasOnlyKeys(item, ['dayOfWeek', 'startHour', 'endHour']) ||
      typeof item.dayOfWeek !== 'number' ||
      !Number.isInteger(item.dayOfWeek) ||
      item.dayOfWeek < 1 ||
      item.dayOfWeek > 7 ||
      typeof item.startHour !== 'number' ||
      !Number.isInteger(item.startHour) ||
      item.startHour < 0 ||
      item.startHour > 23 ||
      typeof item.endHour !== 'number' ||
      !Number.isInteger(item.endHour) ||
      item.endHour < 1 ||
      item.endHour > 24 ||
      item.startHour >= item.endHour
    ) {
      return invalidBackup('Availability windows must have valid day (1-7) and startHour < endHour (0-24).')
    }
    windows.push({
      dayOfWeek: item.dayOfWeek,
      startHour: item.startHour,
      endHour: item.endHour,
    })
  }

  return success({ workingWindows: windows })
}

const policyPresets: readonly PolicyPreset[] = ['balanced', 'focus', 'deadline']

const parsePolicy = (candidate: unknown): Result<PlanningPolicy, BackupFailure> => {
  if (!isRecord(candidate) || !hasOnlyKeys(candidate, ['preset', 'maxDailyWorkMinutes', 'preferredTime'])) {
    return invalidBackup('Policy must be an object with valid settings.')
  }

  if (typeof candidate.preset !== 'string' || !policyPresets.includes(candidate.preset as PolicyPreset)) {
    return invalidBackup('Policy preset must be balanced, focus, or deadline.')
  }

  if (
    candidate.maxDailyWorkMinutes !== undefined &&
    (typeof candidate.maxDailyWorkMinutes !== 'number' ||
      !Number.isInteger(candidate.maxDailyWorkMinutes) ||
      candidate.maxDailyWorkMinutes < 30 ||
      candidate.maxDailyWorkMinutes > 1440)
  ) {
    return invalidBackup('Policy maxDailyWorkMinutes must be an integer between 30 and 1440.')
  }

  if (
    candidate.preferredTime !== undefined &&
    !['morning', 'afternoon', 'any'].includes(candidate.preferredTime as string)
  ) {
    return invalidBackup('Policy preferredTime must be morning, afternoon, or any.')
  }

  return success({
    preset: candidate.preset as PolicyPreset,
    maxDailyWorkMinutes:
      typeof candidate.maxDailyWorkMinutes === 'number' ? candidate.maxDailyWorkMinutes : 360,
    preferredTime:
      typeof candidate.preferredTime === 'string'
        ? (candidate.preferredTime as 'morning' | 'afternoon' | 'any')
        : 'any',
  })
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
      !isTitle(item.title) ||
      !isUtcTimestamp(item.startAt) ||
      !isUtcTimestamp(item.endAt) ||
      Date.parse(item.startAt) >= Date.parse(item.endAt) ||
      !isUtcTimestamp(item.createdAt) ||
      !isUtcTimestamp(item.updatedAt)
    ) {
      return invalidBackup('Every fixed event needs a valid time range and UTC timestamps.')
    }
    if (identifiers.has(item.id)) {
      return invalidBackup('Event IDs must be unique.')
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
      !hasOnlyKeys(item, ['id', 'taskId', 'startAt', 'endAt', 'locked', 'createdAt', 'updatedAt']) ||
      !isIdentifier(item.id) ||
      !isIdentifier(item.taskId) ||
      !isUtcTimestamp(item.startAt) ||
      !isUtcTimestamp(item.endAt) ||
      Date.parse(item.startAt) >= Date.parse(item.endAt) ||
      (item.locked !== undefined && typeof item.locked !== 'boolean') ||
      !isUtcTimestamp(item.createdAt) ||
      !isUtcTimestamp(item.updatedAt)
    ) {
      return invalidBackup('Every task session needs a valid time range and UTC timestamps.')
    }
    if (!taskIds.has(item.taskId)) {
      return invalidBackup('Every task session must reference an imported task.')
    }
    if (identifiers.has(item.id)) {
      return invalidBackup('Session IDs must be unique.')
    }
    identifiers.add(item.id)
    const session: TaskSession = {
      id: item.id,
      taskId: item.taskId,
      startAt: item.startAt,
      endAt: item.endAt,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }
    if (item.locked !== undefined) {
      session.locked = item.locked
    }
    sessions.push(session)
  }
  return success(sessions)
}

const proposalCapabilities: readonly ProposalCapability[] = [
  'duration-estimate',
  'subtask-decomposition',
  'deadline-extract',
  'dependency-infer',
]

const proposalProvenances: readonly ProposalProvenance[] = [
  'heuristic',
  'simulated-ai',
  'gemini-api',
]

const parseProposals = (
  candidate: unknown,
  tasks: Task[],
  identifiers: Set<string>,
): Result<ProposalDecision[], BackupFailure> => {
  if (!Array.isArray(candidate)) {
    return invalidBackup('Proposals must be an array.')
  }

  const taskIds = new Set(tasks.map((task) => task.id))
  const proposals: ProposalDecision[] = []

  for (const item of candidate) {
    if (
      !isRecord(item) ||
      !hasOnlyKeys(item, [
        'id',
        'taskId',
        'capability',
        'provenance',
        'confidence',
        'summary',
        'accepted',
        'occurredAt',
      ]) ||
      !isIdentifier(item.id) ||
      !isIdentifier(item.taskId) ||
      typeof item.capability !== 'string' ||
      !proposalCapabilities.includes(item.capability as ProposalCapability) ||
      typeof item.provenance !== 'string' ||
      !proposalProvenances.includes(item.provenance as ProposalProvenance) ||
      typeof item.confidence !== 'number' ||
      item.confidence < 0 ||
      item.confidence > 1 ||
      typeof item.summary !== 'string' ||
      typeof item.accepted !== 'boolean' ||
      !isUtcTimestamp(item.occurredAt)
    ) {
      return invalidBackup('Every proposal decision needs valid schema properties.')
    }

    if (!taskIds.has(item.taskId)) {
      return invalidBackup('Every proposal must link an imported task.')
    }
    if (identifiers.has(item.id)) {
      return invalidBackup('Proposal decision IDs must be unique.')
    }
    identifiers.add(item.id)

    proposals.push({
      id: item.id,
      taskId: item.taskId,
      capability: item.capability as ProposalCapability,
      provenance: item.provenance as ProposalProvenance,
      confidence: item.confidence,
      summary: item.summary,
      accepted: item.accepted,
      occurredAt: item.occurredAt,
    })
  }

  return success(proposals)
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
  'task-session-lock-toggled',
  'dependency-created',
  'dependency-deleted',
  'schedule-planned',
  'plan-undone',
  'policy-updated',
  'proposal-accepted',
  'proposal-rejected',
  'schedule-repaired',
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
      !hasOnlyKeys(item, ['id', 'number', 'kind', 'reason', 'occurredAt', 'snapshot']) ||
      !isIdentifier(item.id) ||
      !Number.isInteger(item.number) ||
      item.number !== index + 1 ||
      !isRevisionKind(item.kind) ||
      !isReason(item.reason) ||
      !isUtcTimestamp(item.occurredAt)
    ) {
      return invalidBackup('Every revision needs valid ordered audit information.')
    }
    if (item.snapshot !== undefined && typeof item.snapshot !== 'string') {
      return invalidBackup('Revision snapshot must be a string.')
    }
    if (identifiers.has(item.id)) {
      return invalidBackup('Revision IDs must be unique.')
    }
    identifiers.add(item.id)
    const revision: Revision = {
      id: item.id,
      number: item.number,
      kind: item.kind,
      reason: item.reason,
      occurredAt: item.occurredAt,
    }
    if (typeof item.snapshot === 'string') {
      revision.snapshot = item.snapshot
    }
    revisions.push(revision)
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
  value.trim().length > 0 &&
  value.trim().length <= maximumTitleLength

const isReason = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.trim().length > 0 &&
  value.trim().length <= maximumReasonLength

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
  if (typeof value !== 'string' || value.trim().length === 0) {
    return false
  }
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: value }).resolvedOptions()
    return true
  } catch {
    return false
  }
}

const invalidBackup = (message: string): Result<never, BackupFailure> =>
  failure({ code: 'invalid-backup', message })
