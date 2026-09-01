import { failure, success } from './result'
import type {
  AvailabilityWindow,
  DeadlineType,
  Dependency,
  FixedEvent,
  PlannerDocument,
  PlanningPolicy,
  PolicyPreset,
  Project,
  ProposalDecision,
  RecurrenceRule,
  Revision,
  RevisionKind,
  Schedule,
  Task,
  TaskPriority,
  TaskSession,
} from './model'
import type { Result } from './result'
import { hasDependencyCycle } from './dependency-graph'
import { generateTasksFromRecurrenceRule } from './recurrence-engine'

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
      type: 'create-subtask'
      projectId: string
      parentTaskId: string
      title: string
    })
  | (CommandMetadata & {
      type: 'update-task-constraints'
      taskId: string
      estimateMinutes?: number
      dueAt?: string
      earliestStartAt?: string
      priority?: TaskPriority
      deadlineType?: DeadlineType
      description?: string
      labels?: string[]
      scheduleId?: string
    })
  | (CommandMetadata & {
      type: 'move-task'
      taskId: string
      targetProjectId: string
    })
  | (CommandMetadata & {
      type: 'set-task-completion'
      taskId: string
      completed: boolean
    })
  | (CommandMetadata & {
      type: 'create-schedule'
      title: string
      workingWindows: AvailabilityWindow[]
      isDefault?: boolean
    })
  | (CommandMetadata & {
      type: 'update-schedule'
      scheduleId: string
      title?: string
      workingWindows?: AvailabilityWindow[]
      isDefault?: boolean
    })
  | (CommandMetadata & {
      type: 'delete-schedule'
      scheduleId: string
    })
  | (CommandMetadata & {
      type: 'set-default-schedule'
      scheduleId: string
    })
  | (CommandMetadata & {
      type: 'create-recurrence-rule'
      rule: Omit<RecurrenceRule, 'createdAt' | 'updatedAt'>
      horizonDays?: number
    })
  | (CommandMetadata & {
      type: 'update-recurrence-rule'
      ruleId: string
      updates: Partial<Omit<RecurrenceRule, 'id' | 'createdAt' | 'updatedAt'>>
    })
  | (CommandMetadata & {
      type: 'delete-recurrence-rule'
      ruleId: string
      deleteFutureTasks?: boolean
    })
  | (CommandMetadata & {
      type: 'generate-recurring-tasks'
      horizonDays?: number
    })
  | (CommandMetadata & {
      type: 'create-fixed-event'
      title: string
      startAt: string
      endAt: string
    })
  | (CommandMetadata & {
      type: 'delete-fixed-event'
      eventId: string
    })
  | (CommandMetadata & {
      type: 'create-task-session'
      taskId: string
      startAt: string
      endAt: string
    })
  | (CommandMetadata & {
      type: 'delete-task-session'
      sessionId: string
    })
  | (CommandMetadata & {
      type: 'toggle-task-session-lock'
      sessionId: string
    })
  | (CommandMetadata & {
      type: 'create-dependency'
      fromTaskId: string
      toTaskId: string
    })
  | (CommandMetadata & {
      type: 'delete-dependency'
      dependencyId: string
    })
  | (CommandMetadata & {
      type: 'apply-plan'
      sessions: TaskSession[]
    })
  | (CommandMetadata & {
      type: 'undo-last-plan'
    })
  | (CommandMetadata & {
      type: 'update-availability'
      workingWindows: AvailabilityWindow[]
    })
  | (CommandMetadata & {
      type: 'update-policy'
      policy: PlanningPolicy
    })
  | (CommandMetadata & {
      type: 'record-proposal-decision'
      decision: ProposalDecision
    })
  | (CommandMetadata & {
      type: 'repair-schedule'
      sessions: TaskSession[]
    })

export interface CommandFailure {
  code:
    | 'invalid-command'
    | 'project-not-found'
    | 'task-not-found'
    | 'parent-task-not-found'
    | 'schedule-not-found'
    | 'recurrence-rule-not-found'
    | 'dependency-not-found'
    | 'fixed-event-not-found'
    | 'task-session-not-found'
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
    case 'create-subtask':
      return createSubtask(document, command)
    case 'update-task-constraints':
      return updateTaskConstraints(document, command)
    case 'move-task':
      return moveTask(document, command)
    case 'set-task-completion':
      return setTaskCompletion(document, command)
    case 'create-schedule':
      return createSchedule(document, command)
    case 'update-schedule':
      return updateSchedule(document, command)
    case 'delete-schedule':
      return deleteSchedule(document, command)
    case 'set-default-schedule':
      return setDefaultSchedule(document, command)
    case 'create-recurrence-rule':
      return createRecurrenceRule(document, command)
    case 'update-recurrence-rule':
      return updateRecurrenceRule(document, command)
    case 'delete-recurrence-rule':
      return deleteRecurrenceRule(document, command)
    case 'generate-recurring-tasks':
      return generateRecurringTasksCommand(document, command)
    case 'create-fixed-event':
      return createFixedEvent(document, command)
    case 'delete-fixed-event':
      return deleteFixedEvent(document, command)
    case 'create-task-session':
      return createTaskSession(document, command)
    case 'delete-task-session':
      return deleteTaskSession(document, command)
    case 'toggle-task-session-lock':
      return toggleTaskSessionLock(document, command)
    case 'create-dependency':
      return createDependency(document, command)
    case 'delete-dependency':
      return deleteDependency(document, command)
    case 'apply-plan':
      return applyPlan(document, command)
    case 'undo-last-plan':
      return undoLastPlan(document, command)
    case 'update-availability':
      return updateAvailability(document, command)
    case 'update-policy':
      return updatePolicy(document, command)
    case 'record-proposal-decision':
      return recordProposalDecision(document, command)
    case 'repair-schedule':
      return repairScheduleCommand(document, command)
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

const createSubtask = (
  document: PlannerDocument,
  command: Extract<PlannerCommand, { type: 'create-subtask' }>,
): CommandResult => {
  const title = normaliseTitle(command.title)
  if (!title) {
    return invalidCommand('Subtask names must contain between 1 and 200 characters.')
  }

  if (!document.projects.some((project) => project.id === command.projectId)) {
    return failure({
      code: 'project-not-found',
      message: 'Choose an existing project before adding a subtask.',
    })
  }

  const parent = document.tasks.find((task) => task.id === command.parentTaskId)
  if (!parent) {
    return failure({
      code: 'parent-task-not-found',
      message: 'Choose an existing parent task before adding a subtask.',
    })
  }

  if (parent.projectId !== command.projectId) {
    return invalidCommand('Subtasks must belong to the same project as their parent task.')
  }

  if (parent.parentTaskId !== undefined) {
    return invalidCommand('Subtasks cannot be nested under another subtask.')
  }

  if (hasId(document, command.id) || hasRevisionId(document, command.revisionId)) {
    return duplicateId()
  }

  const subtask: Task = {
    id: command.id,
    projectId: command.projectId,
    parentTaskId: command.parentTaskId,
    title,
    completed: false,
    createdAt: command.occurredAt,
    updatedAt: command.occurredAt,
  }

  return revised(
    document,
    command,
    'subtask-created',
    `Added subtask “${title}” to “${parent.title}”.`,
    {
      tasks: [...document.tasks, subtask],
    },
  )
}

const validPriorities: TaskPriority[] = ['ASAP', 'HIGH', 'MEDIUM', 'LOW']
const validDeadlineTypes: DeadlineType[] = ['HARD', 'SOFT', 'NONE']

const updateTaskConstraints = (
  document: PlannerDocument,
  command: Extract<PlannerCommand, { type: 'update-task-constraints' }>,
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

  if (
    command.estimateMinutes !== undefined &&
    (!Number.isInteger(command.estimateMinutes) ||
      command.estimateMinutes <= 0 ||
      command.estimateMinutes > 1440)
  ) {
    return invalidCommand('Estimated duration must be an integer between 1 and 1440 minutes.')
  }

  if (command.dueAt !== undefined && !isUtcTimestamp(command.dueAt)) {
    return invalidCommand('Due date must be a valid UTC timestamp.')
  }

  if (command.earliestStartAt !== undefined && !isUtcTimestamp(command.earliestStartAt)) {
    return invalidCommand('Earliest start date must be a valid UTC timestamp.')
  }

  if (command.priority !== undefined && !validPriorities.includes(command.priority)) {
    return invalidCommand('Priority must be ASAP, HIGH, MEDIUM, or LOW.')
  }

  if (command.deadlineType !== undefined && !validDeadlineTypes.includes(command.deadlineType)) {
    return invalidCommand('Deadline type must be HARD, SOFT, or NONE.')
  }

  if (
    command.description !== undefined &&
    (typeof command.description !== 'string' || command.description.length > 2000)
  ) {
    return invalidCommand('Description must be a string up to 2000 characters.')
  }

  if (command.labels !== undefined) {
    if (!Array.isArray(command.labels)) {
      return invalidCommand('Labels must be an array of strings.')
    }
    if (command.labels.length > 20) {
      return invalidCommand('A task can have at most 20 labels.')
    }
    for (const label of command.labels) {
      if (typeof label !== 'string' || label.trim().length === 0 || label.length > 50) {
        return invalidCommand('Each label must be between 1 and 50 characters.')
      }
    }
  }

  if (command.scheduleId !== undefined && command.scheduleId !== '') {
    if (!document.schedules.some((s) => s.id === command.scheduleId)) {
      return failure({
        code: 'schedule-not-found',
        message: 'The specified availability schedule does not exist.',
      })
    }
  }

  const effectiveEarliest =
    command.earliestStartAt !== undefined ? command.earliestStartAt : task.earliestStartAt
  const effectiveDue = command.dueAt !== undefined ? command.dueAt : task.dueAt

  if (
    effectiveEarliest &&
    effectiveDue &&
    Date.parse(effectiveEarliest) >= Date.parse(effectiveDue)
  ) {
    return invalidCommand('Earliest start time must be before the due date.')
  }

  const nextTask: Task = {
    ...task,
    estimateMinutes:
      command.estimateMinutes !== undefined ? command.estimateMinutes : task.estimateMinutes,
    dueAt: command.dueAt !== undefined ? command.dueAt : task.dueAt,
    earliestStartAt:
      command.earliestStartAt !== undefined ? command.earliestStartAt : task.earliestStartAt,
    priority: command.priority !== undefined ? command.priority : task.priority,
    deadlineType:
      command.deadlineType !== undefined
        ? command.deadlineType
        : task.deadlineType ?? (task.dueAt ? 'SOFT' : 'NONE'),
    description: command.description !== undefined ? command.description : task.description,
    labels: command.labels !== undefined ? command.labels.map((l) => l.trim()) : task.labels,
    scheduleId:
      command.scheduleId !== undefined
        ? command.scheduleId || undefined
        : task.scheduleId,
    updatedAt: command.occurredAt,
  }

  return revised(
    document,
    command,
    'task-constraints-updated',
    `Updated constraints for task “${task.title}”.`,
    {
      tasks: document.tasks.map((candidate) =>
        candidate.id === task.id ? nextTask : candidate,
      ),
    },
  )
}

const moveTask = (
  document: PlannerDocument,
  command: Extract<PlannerCommand, { type: 'move-task' }>,
): CommandResult => {
  const task = document.tasks.find((candidate) => candidate.id === command.taskId)
  if (!task) {
    return failure({
      code: 'task-not-found',
      message: 'That task no longer exists.',
    })
  }

  const targetProject = document.projects.find((p) => p.id === command.targetProjectId)
  if (!targetProject) {
    return failure({
      code: 'project-not-found',
      message: 'The target project does not exist.',
    })
  }

  if (hasRevisionId(document, command.revisionId)) {
    return duplicateId()
  }

  if (task.projectId === command.targetProjectId) {
    return invalidCommand('Task is already in the target project.')
  }

  const childSubtaskIds = new Set(
    document.tasks.filter((t) => t.parentTaskId === task.id).map((t) => t.id),
  )

  const updatedTasks = document.tasks.map((t) => {
    if (t.id === task.id) {
      return {
        ...t,
        projectId: command.targetProjectId,
        parentTaskId: undefined, // Detached from parent if moved to another project
        updatedAt: command.occurredAt,
      }
    }
    if (childSubtaskIds.has(t.id)) {
      return {
        ...t,
        projectId: command.targetProjectId,
        updatedAt: command.occurredAt,
      }
    }
    return t
  })

  if (hasDependencyCycle(document.dependencies)) {
    return invalidCommand('Moving this task creates an invalid circular dependency state.')
  }

  return revised(
    document,
    command,
    'task-moved',
    `Moved task “${task.title}” to “${targetProject.title}”.`,
    {
      tasks: updatedTasks,
    },
  )
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
  return revised(
    document,
    command,
    'task-completion-changed',
    completed
      ? `Completed task “${task.title}”.`
      : `Reopened task “${task.title}”.`,
    {
      tasks: document.tasks.map((candidate) =>
        candidate.id === command.taskId
          ? {
              ...candidate,
              completed,
              updatedAt: command.occurredAt,
            }
          : candidate,
      ),
    },
  )
}

const createSchedule = (
  document: PlannerDocument,
  command: Extract<PlannerCommand, { type: 'create-schedule' }>,
): CommandResult => {
  const title = normaliseTitle(command.title)
  if (!title) {
    return invalidCommand('Schedule names must contain between 1 and 200 characters.')
  }
  if (hasId(document, command.id) || hasRevisionId(document, command.revisionId)) {
    return duplicateId()
  }
  if (!Array.isArray(command.workingWindows) || command.workingWindows.length === 0) {
    return invalidCommand('A schedule must have at least one working availability window.')
  }
  for (const win of command.workingWindows) {
    if (!Number.isInteger(win.dayOfWeek) || win.dayOfWeek < 1 || win.dayOfWeek > 7) {
      return invalidCommand('Day of week must be between 1 and 7.')
    }
    if (!Number.isInteger(win.startHour) || win.startHour < 0 || win.startHour > 23) {
      return invalidCommand('Start hour must be between 0 and 23.')
    }
    if (!Number.isInteger(win.endHour) || win.endHour < 1 || win.endHour > 24) {
      return invalidCommand('End hour must be between 1 and 24.')
    }
    if (win.startHour >= win.endHour) {
      return invalidCommand('Start hour must be before end hour.')
    }
  }

  const isDefault = Boolean(command.isDefault)
  const schedules = isDefault
    ? document.schedules.map((s) => ({ ...s, isDefault: false }))
    : [...document.schedules]

  const newSchedule: Schedule = {
    id: command.id,
    title,
    isDefault,
    workingWindows: command.workingWindows,
    createdAt: command.occurredAt,
    updatedAt: command.occurredAt,
  }

  schedules.push(newSchedule)

  return revised(document, command, 'schedule-created', `Created schedule “${title}”.`, {
    schedules,
    ...(isDefault ? { availability: { workingWindows: command.workingWindows } } : {}),
  })
}

const updateSchedule = (
  document: PlannerDocument,
  command: Extract<PlannerCommand, { type: 'update-schedule' }>,
): CommandResult => {
  const schedule = document.schedules.find((s) => s.id === command.scheduleId)
  if (!schedule) {
    return failure({ code: 'schedule-not-found', message: 'That schedule does not exist.' })
  }
  if (hasRevisionId(document, command.revisionId)) {
    return duplicateId()
  }
  let title = schedule.title
  if (command.title !== undefined) {
    const parsedTitle = normaliseTitle(command.title)
    if (!parsedTitle) return invalidCommand('Schedule names must contain between 1 and 200 characters.')
    title = parsedTitle
  }
  let workingWindows = schedule.workingWindows
  if (command.workingWindows !== undefined) {
    if (!Array.isArray(command.workingWindows) || command.workingWindows.length === 0) {
      return invalidCommand('A schedule must have at least one working availability window.')
    }
    for (const win of command.workingWindows) {
      if (!Number.isInteger(win.dayOfWeek) || win.dayOfWeek < 1 || win.dayOfWeek > 7) {
        return invalidCommand('Day of week must be between 1 and 7.')
      }
      if (!Number.isInteger(win.startHour) || win.startHour < 0 || win.startHour > 23) {
        return invalidCommand('Start hour must be between 0 and 23.')
      }
      if (!Number.isInteger(win.endHour) || win.endHour < 1 || win.endHour > 24) {
        return invalidCommand('End hour must be between 1 and 24.')
      }
      if (win.startHour >= win.endHour) {
        return invalidCommand('Start hour must be before end hour.')
      }
    }
    workingWindows = command.workingWindows
  }

  const isDefault = command.isDefault !== undefined ? command.isDefault : schedule.isDefault
  const updatedSchedules = document.schedules.map((s) => {
    if (s.id === schedule.id) {
      return {
        ...s,
        title,
        workingWindows,
        isDefault,
        updatedAt: command.occurredAt,
      }
    }
    return isDefault ? { ...s, isDefault: false } : s
  })

  return revised(document, command, 'schedule-updated', `Updated schedule “${title}”.`, {
    schedules: updatedSchedules,
    ...(isDefault ? { availability: { workingWindows } } : {}),
  })
}

const deleteSchedule = (
  document: PlannerDocument,
  command: Extract<PlannerCommand, { type: 'delete-schedule' }>,
): CommandResult => {
  const schedule = document.schedules.find((s) => s.id === command.scheduleId)
  if (!schedule) {
    return failure({ code: 'schedule-not-found', message: 'That schedule does not exist.' })
  }
  if (document.schedules.length <= 1) {
    return invalidCommand('You cannot delete the only remaining schedule.')
  }
  if (hasRevisionId(document, command.revisionId)) {
    return duplicateId()
  }

  let remainingSchedules = document.schedules.filter((s) => s.id !== command.scheduleId)
  if (schedule.isDefault && remainingSchedules.length > 0) {
    remainingSchedules = remainingSchedules.map((s, idx) =>
      idx === 0 ? { ...s, isDefault: true } : s,
    )
  }

  // Clear scheduleId on tasks that used this deleted schedule
  const updatedTasks = document.tasks.map((task) =>
    task.scheduleId === command.scheduleId ? { ...task, scheduleId: undefined } : task,
  )

  const activeDefault = remainingSchedules.find((s) => s.isDefault) ?? remainingSchedules[0]

  return revised(document, command, 'schedule-deleted', `Deleted schedule “${schedule.title}”.`, {
    schedules: remainingSchedules,
    tasks: updatedTasks,
    availability: { workingWindows: activeDefault.workingWindows },
  })
}

const setDefaultSchedule = (
  document: PlannerDocument,
  command: Extract<PlannerCommand, { type: 'set-default-schedule' }>,
): CommandResult => {
  const target = document.schedules.find((s) => s.id === command.scheduleId)
  if (!target) {
    return failure({ code: 'schedule-not-found', message: 'That schedule does not exist.' })
  }
  if (hasRevisionId(document, command.revisionId)) {
    return duplicateId()
  }

  const schedules = document.schedules.map((s) => ({
    ...s,
    isDefault: s.id === command.scheduleId,
  }))

  return revised(document, command, 'default-schedule-changed', `Set “${target.title}” as default schedule.`, {
    schedules,
    availability: { workingWindows: target.workingWindows },
  })
}

const createRecurrenceRule = (
  document: PlannerDocument,
  command: Extract<PlannerCommand, { type: 'create-recurrence-rule' }>,
): CommandResult => {
  const { rule, horizonDays = 90 } = command
  const title = normaliseTitle(rule.title)
  if (!title) {
    return invalidCommand('Recurring task titles must contain between 1 and 200 characters.')
  }
  if (!document.projects.some((p) => p.id === rule.projectId)) {
    return failure({ code: 'project-not-found', message: 'Choose an existing project before creating a recurring rule.' })
  }
  if (!['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY'].includes(rule.frequency)) {
    return invalidCommand('Frequency must be DAILY, WEEKLY, BIWEEKLY, or MONTHLY.')
  }
  if (hasId(document, rule.id) || hasRevisionId(document, command.revisionId)) {
    return duplicateId()
  }

  const newRule: RecurrenceRule = {
    ...rule,
    title,
    createdAt: command.occurredAt,
    updatedAt: command.occurredAt,
  }

  const horizonEnd = new Date(Date.parse(command.occurredAt) + horizonDays * 24 * 3600 * 1000)
  let instanceIdCounter = 1
  const createInstanceId = () => `${rule.id}-inst-${instanceIdCounter++}-${Date.now().toString(36)}`

  const generatedTasks = generateTasksFromRecurrenceRule(
    newRule,
    document.tasks,
    horizonEnd,
    createInstanceId,
    new Date(command.occurredAt),
  )

  return revised(document, command, 'recurrence-rule-created', `Created recurring rule for “${title}”.`, {
    recurrenceRules: [...document.recurrenceRules, newRule],
    tasks: [...document.tasks, ...generatedTasks],
  })
}

const updateRecurrenceRule = (
  document: PlannerDocument,
  command: Extract<PlannerCommand, { type: 'update-recurrence-rule' }>,
): CommandResult => {
  const rule = document.recurrenceRules.find((r) => r.id === command.ruleId)
  if (!rule) {
    return failure({ code: 'recurrence-rule-not-found', message: 'Recurring rule not found.' })
  }
  if (hasRevisionId(document, command.revisionId)) {
    return duplicateId()
  }

  const updatedRule: RecurrenceRule = {
    ...rule,
    ...command.updates,
    updatedAt: command.occurredAt,
  }

  const updatedRules = document.recurrenceRules.map((r) =>
    r.id === command.ruleId ? updatedRule : r,
  )

  return revised(document, command, 'recurrence-rule-updated', `Updated recurring rule “${updatedRule.title}”.`, {
    recurrenceRules: updatedRules,
  })
}

const deleteRecurrenceRule = (
  document: PlannerDocument,
  command: Extract<PlannerCommand, { type: 'delete-recurrence-rule' }>,
): CommandResult => {
  const rule = document.recurrenceRules.find((r) => r.id === command.ruleId)
  if (!rule) {
    return failure({ code: 'recurrence-rule-not-found', message: 'Recurring rule not found.' })
  }
  if (hasRevisionId(document, command.revisionId)) {
    return duplicateId()
  }

  const shouldDeleteFuture = command.deleteFutureTasks ?? true
  const todayStr = command.occurredAt.slice(0, 10)

  const remainingTasks = document.tasks.filter((t) => {
    if (t.recurrenceRuleId !== command.ruleId) return true
    if (t.completed) return true // Keep completed tasks
    if (shouldDeleteFuture) {
      if (t.recurrenceInstanceDate && t.recurrenceInstanceDate >= todayStr) return false
      if (t.dueAt && t.dueAt >= command.occurredAt) return false
    }
    return true
  })

  const remainingRules = document.recurrenceRules.filter((r) => r.id !== command.ruleId)

  return revised(document, command, 'recurrence-rule-deleted', `Deleted recurring rule “${rule.title}”.`, {
    recurrenceRules: remainingRules,
    tasks: remainingTasks,
  })
}

const generateRecurringTasksCommand = (
  document: PlannerDocument,
  command: Extract<PlannerCommand, { type: 'generate-recurring-tasks' }>,
): CommandResult => {
  const horizonDays = command.horizonDays ?? 90
  const horizonEnd = new Date(Date.parse(command.occurredAt) + horizonDays * 24 * 3600 * 1000)
  let instanceIdCounter = 1
  const createInstanceId = () => `rec-inst-${instanceIdCounter++}-${Date.now().toString(36)}`

  let currentTasks = [...document.tasks]
  let totalGenerated = 0

  for (const rule of document.recurrenceRules) {
    const generated = generateTasksFromRecurrenceRule(
      rule,
      currentTasks,
      horizonEnd,
      createInstanceId,
      new Date(command.occurredAt),
    )
    currentTasks = [...currentTasks, ...generated]
    totalGenerated += generated.length
  }

  return revised(
    document,
    command,
    'recurring-tasks-generated',
    `Generated ${totalGenerated} recurring task instance(s).`,
    {
      tasks: currentTasks,
    },
  )
}

const createFixedEvent = (
  document: PlannerDocument,
  command: Extract<PlannerCommand, { type: 'create-fixed-event' }>,
): CommandResult => {
  const title = normaliseTitle(command.title)
  if (!title) {
    return invalidCommand('Event titles must contain between 1 and 200 characters.')
  }

  const timeIssue = validateTimeRange(command.startAt, command.endAt)
  if (timeIssue) {
    return failure(timeIssue)
  }

  if (hasId(document, command.id) || hasRevisionId(document, command.revisionId)) {
    return duplicateId()
  }

  const event: FixedEvent = {
    id: command.id,
    title,
    startAt: command.startAt,
    endAt: command.endAt,
    createdAt: command.occurredAt,
    updatedAt: command.occurredAt,
  }

  return revised(document, command, 'fixed-event-created', `Created fixed event “${title}”.`, {
    fixedEvents: [...document.fixedEvents, event],
  })
}

const deleteFixedEvent = (
  document: PlannerDocument,
  command: Extract<PlannerCommand, { type: 'delete-fixed-event' }>,
): CommandResult => {
  const event = document.fixedEvents.find((candidate) => candidate.id === command.eventId)
  if (!event) {
    return failure({
      code: 'fixed-event-not-found',
      message: 'That fixed event no longer exists.',
    })
  }

  if (hasRevisionId(document, command.revisionId)) {
    return duplicateId()
  }

  return revised(document, command, 'fixed-event-deleted', `Deleted fixed event “${event.title}”.`, {
    fixedEvents: document.fixedEvents.filter((candidate) => candidate.id !== command.eventId),
  })
}

const createTaskSession = (
  document: PlannerDocument,
  command: Extract<PlannerCommand, { type: 'create-task-session' }>,
): CommandResult => {
  const task = document.tasks.find((candidate) => candidate.id === command.taskId)
  if (!task) {
    return failure({
      code: 'task-not-found',
      message: 'Cannot schedule a session for a task that does not exist.',
    })
  }

  const timeIssue = validateTimeRange(command.startAt, command.endAt)
  if (timeIssue) {
    return failure(timeIssue)
  }

  if (hasId(document, command.id) || hasRevisionId(document, command.revisionId)) {
    return duplicateId()
  }

  const session: TaskSession = {
    id: command.id,
    taskId: command.taskId,
    startAt: command.startAt,
    endAt: command.endAt,
    locked: true, // Manually placed sessions are locked/pinned by default
    createdAt: command.occurredAt,
    updatedAt: command.occurredAt,
  }

  return revised(
    document,
    command,
    'task-session-created',
    `Scheduled session for task “${task.title}”.`,
    {
      taskSessions: [...document.taskSessions, session],
    },
  )
}

const deleteTaskSession = (
  document: PlannerDocument,
  command: Extract<PlannerCommand, { type: 'delete-task-session' }>,
): CommandResult => {
  const session = document.taskSessions.find((candidate) => candidate.id === command.sessionId)
  if (!session) {
    return failure({
      code: 'task-session-not-found',
      message: 'That task session no longer exists.',
    })
  }

  if (hasRevisionId(document, command.revisionId)) {
    return duplicateId()
  }

  return revised(document, command, 'task-session-deleted', 'Deleted task session.', {
    taskSessions: document.taskSessions.filter((candidate) => candidate.id !== command.sessionId),
  })
}

const toggleTaskSessionLock = (
  document: PlannerDocument,
  command: Extract<PlannerCommand, { type: 'toggle-task-session-lock' }>,
): CommandResult => {
  const session = document.taskSessions.find((s) => s.id === command.sessionId)
  if (!session) {
    return failure({
      code: 'task-session-not-found',
      message: 'That task session no longer exists.',
    })
  }

  if (hasRevisionId(document, command.revisionId)) {
    return duplicateId()
  }

  const nextLocked = !session.locked
  const action = nextLocked ? 'Pinned' : 'Unpinned'

  return revised(
    document,
    command,
    'task-session-lock-toggled',
    `${action} session on the schedule.`,
    {
      taskSessions: document.taskSessions.map((s) =>
        s.id === session.id
          ? { ...s, locked: nextLocked, updatedAt: command.occurredAt }
          : s,
      ),
    },
  )
}

const createDependency = (
  document: PlannerDocument,
  command: Extract<PlannerCommand, { type: 'create-dependency' }>,
): CommandResult => {
  if (command.fromTaskId === command.toTaskId) {
    return invalidCommand('A task cannot depend on itself.')
  }

  const fromTask = document.tasks.find((t) => t.id === command.fromTaskId)
  const toTask = document.tasks.find((t) => t.id === command.toTaskId)

  if (!fromTask || !toTask) {
    return failure({
      code: 'task-not-found',
      message: 'Both dependent and prerequisite tasks must exist.',
    })
  }

  const alreadyExists = document.dependencies.some(
    (d) => d.fromTaskId === command.fromTaskId && d.toTaskId === command.toTaskId,
  )
  if (alreadyExists) {
    return invalidCommand('This dependency relationship already exists.')
  }

  if (
    hasDependencyCycle(document.dependencies, {
      fromTaskId: command.fromTaskId,
      toTaskId: command.toTaskId,
    })
  ) {
    return invalidCommand('Adding this dependency would create a circular dependency.')
  }

  if (hasId(document, command.id) || hasRevisionId(document, command.revisionId)) {
    return duplicateId()
  }

  const dependency: Dependency = {
    id: command.id,
    fromTaskId: command.fromTaskId,
    toTaskId: command.toTaskId,
    createdAt: command.occurredAt,
  }

  return revised(
    document,
    command,
    'dependency-created',
    `Set “${toTask.title}” to depend on “${fromTask.title}”.`,
    {
      dependencies: [...document.dependencies, dependency],
    },
  )
}

const deleteDependency = (
  document: PlannerDocument,
  command: Extract<PlannerCommand, { type: 'delete-dependency' }>,
): CommandResult => {
  const dep = document.dependencies.find((d) => d.id === command.dependencyId)
  if (!dep) {
    return failure({
      code: 'dependency-not-found',
      message: 'That dependency no longer exists.',
    })
  }

  if (hasRevisionId(document, command.revisionId)) {
    return duplicateId()
  }

  return revised(
    document,
    command,
    'dependency-deleted',
    'Removed task dependency.',
    {
      dependencies: document.dependencies.filter((d) => d.id !== command.dependencyId),
    },
  )
}

const applyPlan = (
  document: PlannerDocument,
  command: Extract<PlannerCommand, { type: 'apply-plan' }>,
): CommandResult => {
  if (hasRevisionId(document, command.revisionId)) {
    return duplicateId()
  }

  const previousSnapshot = JSON.stringify(document.taskSessions)

  return revised(
    document,
    command,
    'schedule-planned',
    `Applied reference schedule (${command.sessions.length} session(s) allocated).`,
    {
      taskSessions: command.sessions,
    },
    previousSnapshot,
  )
}

const undoLastPlan = (
  document: PlannerDocument,
  command: Extract<PlannerCommand, { type: 'undo-last-plan' }>,
): CommandResult => {
  const targetRevision = [...document.revisions]
    .reverse()
    .find((r) => r.kind === 'schedule-planned' && r.snapshot)

  if (!targetRevision || !targetRevision.snapshot) {
    return failure({
      code: 'invalid-command',
      message: 'No previous schedule plan to undo.',
    })
  }

  let restoredSessions: TaskSession[]
  try {
    restoredSessions = JSON.parse(targetRevision.snapshot) as TaskSession[]
  } catch {
    return invalidCommand('Failed to parse previous schedule snapshot.')
  }

  if (hasRevisionId(document, command.revisionId)) {
    return duplicateId()
  }

  return revised(
    document,
    command,
    'plan-undone',
    'Reverted to previous schedule.',
    {
      taskSessions: restoredSessions,
    },
  )
}

const repairScheduleCommand = (
  document: PlannerDocument,
  command: Extract<PlannerCommand, { type: 'repair-schedule' }>,
): CommandResult => {
  if (hasRevisionId(document, command.revisionId)) {
    return duplicateId()
  }

  const snapshot = JSON.stringify(document.taskSessions)

  return revised(
    document,
    command,
    'schedule-repaired',
    'Repaired schedule and shifted overdue sessions forward.',
    {
      taskSessions: command.sessions,
    },
    snapshot,
  )
}

const updateAvailability = (
  document: PlannerDocument,
  command: Extract<PlannerCommand, { type: 'update-availability' }>,
): CommandResult => {
  for (const win of command.workingWindows) {
    if (
      win.dayOfWeek < 1 ||
      win.dayOfWeek > 7 ||
      win.startHour < 0 ||
      win.endHour > 24 ||
      win.startHour >= win.endHour
    ) {
      return invalidCommand('Availability window hours must be valid (0-24) with start before end.')
    }
  }

  if (hasRevisionId(document, command.revisionId)) {
    return duplicateId()
  }

  return revised(
    document,
    command,
    'dependency-created',
    'Updated working availability hours.',
    {
      availability: {
        workingWindows: command.workingWindows,
      },
    },
  )
}

const updatePolicy = (
  document: PlannerDocument,
  command: Extract<PlannerCommand, { type: 'update-policy' }>,
): CommandResult => {
  const allowedPresets: PolicyPreset[] = ['balanced', 'focus', 'deadline']
  if (!allowedPresets.includes(command.policy.preset)) {
    return invalidCommand('Policy preset must be balanced, focus, or deadline.')
  }
  if (
    command.policy.maxDailyWorkMinutes !== undefined &&
    (!Number.isInteger(command.policy.maxDailyWorkMinutes) ||
      command.policy.maxDailyWorkMinutes < 30 ||
      command.policy.maxDailyWorkMinutes > 1440)
  ) {
    return invalidCommand('Max daily work minutes must be an integer between 30 and 1440.')
  }

  if (hasRevisionId(document, command.revisionId)) {
    return duplicateId()
  }

  return revised(
    document,
    command,
    'policy-updated',
    `Updated planning policy to ${command.policy.preset}.`,
    {
      policy: command.policy,
    },
  )
}

const recordProposalDecision = (
  document: PlannerDocument,
  command: Extract<PlannerCommand, { type: 'record-proposal-decision' }>,
): CommandResult => {
  if (hasId(document, command.id) || hasRevisionId(document, command.revisionId)) {
    return duplicateId()
  }

  const kind = command.decision.accepted ? 'proposal-accepted' : 'proposal-rejected'
  const action = command.decision.accepted ? 'Accepted' : 'Dismissed'
  const fallbackReason = `${action} ${command.decision.capability} suggestion (${command.decision.provenance}).`

  return revised(
    document,
    command,
    kind,
    fallbackReason,
    {
      proposals: [...document.proposals, command.decision],
    },
  )
}

const revised = (
  document: PlannerDocument,
  command: CommandMetadata,
  kind: RevisionKind,
  fallbackReason: string,
  changes: Partial<
    Pick<
      PlannerDocument,
      | 'projects'
      | 'tasks'
      | 'dependencies'
      | 'availability'
      | 'policy'
      | 'fixedEvents'
      | 'taskSessions'
      | 'proposals'
      | 'schedules'
      | 'recurrenceRules'
    >
  >,
  snapshot?: string,
): CommandResult => {
  const reason = normaliseReason(command.reason) ?? fallbackReason
  const revision: Revision = {
    id: command.revisionId,
    number: document.revision + 1,
    kind,
    reason,
    occurredAt: command.occurredAt,
  }
  if (snapshot) {
    revision.snapshot = snapshot
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

const validateTimeRange = (startAt: string, endAt: string): CommandFailure | undefined => {
  if (!isUtcTimestamp(startAt) || !isUtcTimestamp(endAt)) {
    return {
      code: 'invalid-command',
      message: 'Start and end times must be valid UTC timestamps.',
    }
  }

  if (Date.parse(startAt) >= Date.parse(endAt)) {
    return {
      code: 'invalid-command',
      message: 'Start time must be before end time.',
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
  document.tasks.some((task) => task.id === id) ||
  document.dependencies.some((dep) => dep.id === id) ||
  document.schedules?.some((schedule) => schedule.id === id) ||
  document.recurrenceRules?.some((rule) => rule.id === id) ||
  document.fixedEvents.some((event) => event.id === id) ||
  document.taskSessions.some((session) => session.id === id) ||
  document.proposals.some((proposal) => proposal.id === id)

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
