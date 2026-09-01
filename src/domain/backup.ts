import { PLANNER_SCHEMA_VERSION } from './model'
import { failure, success } from './result'
import type { PlannerDocument, Project, Revision, RevisionKind, Task } from './model'
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

  if (
    !hasOnlyKeys(candidate, [
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

  if (candidate.schemaVersion !== PLANNER_SCHEMA_VERSION) {
    return failure({
      code: 'unsupported-version',
      message: `This backup uses an unsupported schema version: ${String(candidate.schemaVersion)}.`,
    })
  }

  if (!isIanaTimeZone(candidate.timeZone)) {
    return invalidBackup('A backup needs a valid IANA time zone.')
  }

  if (!isNonNegativeInteger(candidate.revision)) {
    return invalidBackup('A backup needs a non-negative revision number.')
  }
  const documentRevision = candidate.revision

  const projects = parseProjects(candidate.projects)
  if (!projects.ok) {
    return projects
  }

  const tasks = parseTasks(candidate.tasks, projects.value)
  if (!tasks.ok) {
    return tasks
  }

  const revisions = parseRevisions(candidate.revisions, documentRevision)
  if (!revisions.ok) {
    return revisions
  }

  return success({
    schemaVersion: PLANNER_SCHEMA_VERSION,
    timeZone: candidate.timeZone,
    revision: documentRevision,
    projects: projects.value,
    tasks: tasks.value,
    revisions: revisions.value,
  })
}

const parseProjects = (candidate: unknown): Result<Project[], BackupFailure> => {
  if (!Array.isArray(candidate)) {
    return invalidBackup('Projects must be an array.')
  }

  const projects: Project[] = []
  const identifiers = new Set<string>()
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
): Result<Task[], BackupFailure> => {
  if (!Array.isArray(candidate)) {
    return invalidBackup('Tasks must be an array.')
  }

  const projectIds = new Set(projects.map((project) => project.id))
  const identifiers = new Set(projects.map((project) => project.id))
  const tasks: Task[] = []
  for (const item of candidate) {
    if (
      !isRecord(item) ||
      !hasOnlyKeys(item, ['id', 'projectId', 'title', 'completed', 'createdAt', 'updatedAt']) ||
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
    if (!isUtcTimestamp(item.createdAt) || !isUtcTimestamp(item.updatedAt)) {
      return invalidBackup('Every task needs UTC creation and update timestamps.')
    }
    if (identifiers.has(item.id)) {
      return invalidBackup('Project and task IDs must be unique together.')
    }
    identifiers.add(item.id)
    tasks.push({
      id: item.id,
      projectId: item.projectId,
      title: item.title,
      completed: item.completed,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })
  }
  return success(tasks)
}

const revisionKinds: readonly RevisionKind[] = [
  'project-created',
  'task-created',
  'task-completion-changed',
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
