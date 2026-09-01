import { failure, success } from './result'
import type {
  PlannerDocument,
  Project,
  Revision,
  RevisionKind,
  Task,
} from './model'
import type { Result } from './result'

const maximumTitleLength = 200
const maximumReasonLength = 300

interface CommandMetadata {
  id: string
  revisionId: string
  occurredAt: string
  reason?: string
}

export type PlannerCommand =
  | (CommandMetadata & {
      type: 'create-project'
      title: string
    })
  | (CommandMetadata & {
      type: 'create-task'
      projectId: string
      title: string
    })
  | (CommandMetadata & {
      type: 'set-task-completion'
      taskId: string
      completed: boolean
    })

export interface CommandFailure {
  code:
    | 'invalid-command'
    | 'project-not-found'
    | 'task-not-found'
    | 'duplicate-id'
  message: string
}

export interface CommandSuccess {
  document: PlannerDocument
  revision: Revision
  replanningRequired: false
}

export type CommandResult = Result<CommandSuccess, CommandFailure>

export const executeCommand = (
  document: PlannerDocument,
  command: PlannerCommand,
): CommandResult => {
  const metadataIssue = validateMetadata(command)
  if (metadataIssue) {
    return failure(metadataIssue)
  }

  switch (command.type) {
    case 'create-project':
      return createProject(document, command)
    case 'create-task':
      return createTask(document, command)
    case 'set-task-completion':
      return setTaskCompletion(document, command)
  }
}

const createProject = (
  document: PlannerDocument,
  command: Extract<PlannerCommand, { type: 'create-project' }>,
): CommandResult => {
  const title = normaliseTitle(command.title)
  if (!title) {
    return invalidCommand('Project names must contain between 1 and 200 characters.')
  }

  if (hasId(document, command.id) || hasRevisionId(document, command.revisionId)) {
    return duplicateId()
  }

  const project: Project = {
    id: command.id,
    title,
    createdAt: command.occurredAt,
    updatedAt: command.occurredAt,
  }

  return revised(document, command, 'project-created', `Created project “${title}”.`, {
    projects: [...document.projects, project],
  })
}

const createTask = (
  document: PlannerDocument,
  command: Extract<PlannerCommand, { type: 'create-task' }>,
): CommandResult => {
  const title = normaliseTitle(command.title)
  if (!title) {
    return invalidCommand('Task names must contain between 1 and 200 characters.')
  }

  if (!document.projects.some((project) => project.id === command.projectId)) {
    return failure({
      code: 'project-not-found',
      message: 'Choose an existing project before adding a task.',
    })
  }

  if (hasId(document, command.id) || hasRevisionId(document, command.revisionId)) {
    return duplicateId()
  }

  const task: Task = {
    id: command.id,
    projectId: command.projectId,
    title,
    completed: false,
    createdAt: command.occurredAt,
    updatedAt: command.occurredAt,
  }

  return revised(document, command, 'task-created', `Added task “${title}”.`, {
    tasks: [...document.tasks, task],
  })
}

const setTaskCompletion = (
  document: PlannerDocument,
  command: Extract<PlannerCommand, { type: 'set-task-completion' }>,
): CommandResult => {
  const task = document.tasks.find((candidate) => candidate.id === command.taskId)
  if (!task) {
    return failure({
      code: 'task-not-found',
      message: 'That task no longer exists.',
    })
  }

  if (hasRevisionId(document, command.revisionId)) {
    return duplicateId()
  }

  const completed = command.completed
  const nextTask: Task = {
    ...task,
    completed,
    updatedAt: command.occurredAt,
  }
  const reason = completed ? `Completed task “${task.title}”.` : `Reopened task “${task.title}”.`

  return revised(document, command, 'task-completion-changed', reason, {
    tasks: document.tasks.map((candidate) =>
      candidate.id === task.id ? nextTask : candidate,
    ),
  })
}

const revised = (
  document: PlannerDocument,
  command: CommandMetadata,
  kind: RevisionKind,
  fallbackReason: string,
  changes: Pick<PlannerDocument, 'projects'> | Pick<PlannerDocument, 'tasks'>,
): CommandResult => {
  const reason = normaliseReason(command.reason) ?? fallbackReason
  const revision: Revision = {
    id: command.revisionId,
    number: document.revision + 1,
    kind,
    reason,
    occurredAt: command.occurredAt,
  }
  const nextDocument: PlannerDocument = {
    ...document,
    ...changes,
    revision: revision.number,
    revisions: [...document.revisions, revision],
  }

  return success({
    document: nextDocument,
    revision,
    replanningRequired: false,
  })
}

const validateMetadata = (command: CommandMetadata): CommandFailure | undefined => {
  if (!isIdentifier(command.id) || !isIdentifier(command.revisionId)) {
    return {
      code: 'invalid-command',
      message: 'Commands need stable identifiers.',
    }
  }

  if (!isUtcTimestamp(command.occurredAt)) {
    return {
      code: 'invalid-command',
      message: 'Commands need a valid UTC timestamp.',
    }
  }

  if (command.reason !== undefined && !normaliseReason(command.reason)) {
    return {
      code: 'invalid-command',
      message: 'Reasons must contain between 1 and 300 characters when supplied.',
    }
  }

  return undefined
}

const normaliseTitle = (value: string): string | undefined => {
  const title = value.trim()
  return title.length > 0 && title.length <= maximumTitleLength ? title : undefined
}

const normaliseReason = (value: string | undefined): string | undefined => {
  if (value === undefined) {
    return undefined
  }
  const reason = value.trim()
  return reason.length > 0 && reason.length <= maximumReasonLength ? reason : undefined
}

const hasId = (document: PlannerDocument, id: string): boolean =>
  document.projects.some((project) => project.id === id) ||
  document.tasks.some((task) => task.id === id)

const hasRevisionId = (document: PlannerDocument, id: string): boolean =>
  document.revisions.some((revision) => revision.id === id)

const isIdentifier = (value: string): boolean => value.trim().length > 0 && value.length <= 128

const isUtcTimestamp = (value: string): boolean => {
  const instant = new Date(value)
  return !Number.isNaN(instant.getTime()) && instant.toISOString() === value
}

const invalidCommand = (message: string): CommandResult =>
  failure({ code: 'invalid-command', message })

const duplicateId = (): CommandResult =>
  failure({
    code: 'duplicate-id',
    message: 'That identifier is already in use. Please try again.',
  })
