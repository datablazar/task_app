import { failure, success } from "./result"
import type {
  AvailabilityWindow,
  DeadlineStrictness,
  Dependency,
  FixedEvent,
  PlannerDocument,
  PlanningPolicy,
  PolicyPreset,
  Priority,
  Project,
  ProposalDecision,
  RecurrenceRule,
  Revision,
  RevisionKind,
  Schedule,
  Task,
  TaskSession,
} from "./model"
import type { Result } from "./result"
import { hasDependencyCycle } from "./dependency-graph"

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
      type: "create-project"
      title: string
      color?: string
    })
  | (CommandMetadata & {
      type: "delete-project"
      projectId: string
    })
  | (CommandMetadata & {
      type: "create-task"
      projectId: string
      title: string
      priority?: Priority
      deadlineStrictness?: DeadlineStrictness
      scheduleId?: string
      estimateMinutes?: number
      dueAt?: string
      earliestStartAt?: string
      notes?: string
    })
  | (CommandMetadata & {
      type: "delete-task"
      taskId: string
    })
  | (CommandMetadata & {
      type: "move-task"
      taskId: string
      targetProjectId: string
    })
  | (CommandMetadata & {
      type: "create-subtask"
      projectId: string
      parentTaskId: string
      title: string
    })
  | (CommandMetadata & {
      type: "update-task-constraints"
      taskId: string
      title?: string
      estimateMinutes?: number
      dueAt?: string
      earliestStartAt?: string
      priority?: Priority
      deadlineStrictness?: DeadlineStrictness
      scheduleId?: string
      notes?: string
    })
  | (CommandMetadata & {
      type: "set-task-completion"
      taskId: string
      completed: boolean
    })
  | (CommandMetadata & {
      type: "set-task-priority"
      taskId: string
      priority: Priority
    })
  | (CommandMetadata & {
      type: "set-task-strictness"
      taskId: string
      deadlineStrictness: DeadlineStrictness
    })
  | (CommandMetadata & {
      type: "set-task-schedule"
      taskId: string
      scheduleId?: string
    })
  | (CommandMetadata & {
      type: "set-task-notes"
      taskId: string
      notes: string
    })
  | (CommandMetadata & {
      type: "set-task-recurrence"
      taskId: string
      recurrence?: RecurrenceRule
    })
  | (CommandMetadata & {
      type: "create-fixed-event"
      title: string
      startAt: string
      endAt: string
    })
  | (CommandMetadata & {
      type: "delete-fixed-event"
      eventId: string
    })
  | (CommandMetadata & {
      type: "create-task-session"
      taskId: string
      startAt: string
      endAt: string
    })
  | (CommandMetadata & {
      type: "delete-task-session"
      sessionId: string
    })
  | (CommandMetadata & {
      type: "toggle-task-session-lock"
      sessionId: string
    })
  | (CommandMetadata & {
      type: "create-dependency"
      fromTaskId: string
      toTaskId: string
    })
  | (CommandMetadata & {
      type: "delete-dependency"
      dependencyId: string
    })
  | (CommandMetadata & {
      type: "create-schedule"
      name: string
      workingWindows: AvailabilityWindow[]
      color?: string
    })
  | (CommandMetadata & {
      type: "update-schedule"
      scheduleId: string
      name?: string
      workingWindows?: AvailabilityWindow[]
      color?: string
      isDefault?: boolean
    })
  | (CommandMetadata & {
      type: "delete-schedule"
      scheduleId: string
    })
  | (CommandMetadata & {
      type: "apply-plan"
      sessions: TaskSession[]
    })
  | (CommandMetadata & {
      type: "undo-last-plan"
    })
  | (CommandMetadata & {
      type: "update-availability"
      workingWindows: AvailabilityWindow[]
    })
  | (CommandMetadata & {
      type: "update-policy"
      policy: PlanningPolicy
    })
  | (CommandMetadata & {
      type: "record-proposal-decision"
      decision: ProposalDecision
    })
  | (CommandMetadata & {
      type: "repair-schedule"
      sessions: TaskSession[]
    })

export interface CommandFailure {
  code:
    | "invalid-command"
    | "project-not-found"
    | "task-not-found"
    | "parent-task-not-found"
    | "dependency-not-found"
    | "fixed-event-not-found"
    | "task-session-not-found"
    | "schedule-not-found"
    | "duplicate-id"
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
    case "create-project":
      return createProject(document, command)
    case "delete-project":
      return deleteProject(document, command)
    case "create-task":
      return createTask(document, command)
    case "delete-task":
      return deleteTask(document, command)
    case "move-task":
      return moveTask(document, command)
    case "create-subtask":
      return createSubtask(document, command)
    case "update-task-constraints":
      return updateTaskConstraints(document, command)
    case "set-task-completion":
      return setTaskCompletion(document, command)
    case "set-task-priority":
      return setTaskPriority(document, command)
    case "set-task-strictness":
      return setTaskStrictness(document, command)
    case "set-task-schedule":
      return setTaskSchedule(document, command)
    case "set-task-notes":
      return setTaskNotes(document, command)
    case "set-task-recurrence":
      return setTaskRecurrence(document, command)
    case "create-fixed-event":
      return createFixedEvent(document, command)
    case "delete-fixed-event":
      return deleteFixedEvent(document, command)
    case "create-task-session":
      return createTaskSession(document, command)
    case "delete-task-session":
      return deleteTaskSession(document, command)
    case "toggle-task-session-lock":
      return toggleTaskSessionLock(document, command)
    case "create-dependency":
      return createDependency(document, command)
    case "delete-dependency":
      return deleteDependency(document, command)
    case "create-schedule":
      return createSchedule(document, command)
    case "update-schedule":
      return updateSchedule(document, command)
    case "delete-schedule":
      return deleteSchedule(document, command)
    case "apply-plan":
      return applyPlan(document, command)
    case "undo-last-plan":
      return undoLastPlan(document, command)
    case "update-availability":
      return updateAvailability(document, command)
    case "update-policy":
      return updatePolicy(document, command)
    case "record-proposal-decision":
      return recordProposalDecision(document, command)
    case "repair-schedule":
      return repairScheduleCommand(document, command)
  }
}

const createProject = (
  document: PlannerDocument,
  command: Extract<PlannerCommand, { type: "create-project" }>,
): CommandResult => {
  const title = normaliseTitle(command.title)
  if (!title) {
    return invalidCommand("Project names must contain between 1 and 200 characters.")
  }

  if (hasId(document, command.id) || hasRevisionId(document, command.revisionId)) {
    return duplicateId()
  }

  const project: Project = {
    id: command.id,
    title,
    color: command.color,
    createdAt: command.occurredAt,
    updatedAt: command.occurredAt,
  }

  return revised(document, command, "project-created", `Created project “${title}”.`, {
    projects: [...document.projects, project],
  })
}

const deleteProject = (
  document: PlannerDocument,
  command: Extract<PlannerCommand, { type: "delete-project" }>,
): CommandResult => {
  const project = document.projects.find((p) => p.id === command.projectId)
  if (!project) {
    return failure({ code: "project-not-found", message: "That project no longer exists." })
  }

  const projectTaskIds = new Set(
    document.tasks.filter((t) => t.projectId === command.projectId).map((t) => t.id),
  )

  return revised(document, command, "project-deleted", `Deleted project “${project.title}”.`, {
    projects: document.projects.filter((p) => p.id !== command.projectId),
    tasks: document.tasks.filter((t) => t.projectId !== command.projectId),
    dependencies: document.dependencies.filter(
      (d) => !projectTaskIds.has(d.fromTaskId) && !projectTaskIds.has(d.toTaskId),
    ),
    taskSessions: document.taskSessions.filter((s) => !projectTaskIds.has(s.taskId)),
    proposals: document.proposals.filter((pr) => !projectTaskIds.has(pr.taskId)),
  })
}

const createTask = (
  document: PlannerDocument,
  command: Extract<PlannerCommand, { type: "create-task" }>,
): CommandResult => {
  const title = normaliseTitle(command.title)
  if (!title) {
    return invalidCommand("Task names must contain between 1 and 200 characters.")
  }

  if (!document.projects.some((project) => project.id === command.projectId)) {
    return failure({
      code: "project-not-found",
      message: "Choose an existing project before adding a task.",
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
    priority: command.priority,
    deadlineStrictness: command.deadlineStrictness,
    scheduleId: command.scheduleId,
    estimateMinutes: command.estimateMinutes,
    dueAt: command.dueAt,
    earliestStartAt: command.earliestStartAt,
    notes: command.notes,
    createdAt: command.occurredAt,
    updatedAt: command.occurredAt,
  }

  return revised(document, command, "task-created", `Added task “${title}”.`, {
    tasks: [...document.tasks, task],
  })
}

const deleteTask = (
  document: PlannerDocument,
  command: Extract<PlannerCommand, { type: "delete-task" }>,
): CommandResult => {
  const task = document.tasks.find((t) => t.id === command.taskId)
  if (!task) {
    return failure({ code: "task-not-found", message: "That task no longer exists." })
  }

  const tasksToDelete = new Set([
    task.id,
    ...document.tasks.filter((t) => t.parentTaskId === task.id).map((t) => t.id),
  ])

  return revised(document, command, "task-deleted", `Deleted task “${task.title}”.`, {
    tasks: document.tasks.filter((t) => !tasksToDelete.has(t.id)),
    dependencies: document.dependencies.filter(
      (d) => !tasksToDelete.has(d.fromTaskId) && !tasksToDelete.has(d.toTaskId),
    ),
    taskSessions: document.taskSessions.filter((s) => !tasksToDelete.has(s.taskId)),
    proposals: document.proposals.filter((p) => !tasksToDelete.has(p.taskId)),
  })
}

const moveTask = (
  document: PlannerDocument,
  command: Extract<PlannerCommand, { type: "move-task" }>,
): CommandResult => {
  const task = document.tasks.find((t) => t.id === command.taskId)
  if (!task) {
    return failure({ code: "task-not-found", message: "That task no longer exists." })
  }
  const targetProject = document.projects.find((p) => p.id === command.targetProjectId)
  if (!targetProject) {
    return failure({ code: "project-not-found", message: "Target project does not exist." })
  }

  return revised(
    document,
    command,
    "task-moved",
    `Moved task “${task.title}” to “${targetProject.title}”.`,
    {
      tasks: document.tasks.map((t) => {
        if (t.id === task.id || t.parentTaskId === task.id) {
          return { ...t, projectId: targetProject.id, updatedAt: command.occurredAt }
        }
        return t
      }),
    },
  )
}

const createSubtask = (
  document: PlannerDocument,
  command: Extract<PlannerCommand, { type: "create-subtask" }>,
): CommandResult => {
  const title = normaliseTitle(command.title)
  if (!title) {
    return invalidCommand("Subtask names must contain between 1 and 200 characters.")
  }

  if (!document.projects.some((project) => project.id === command.projectId)) {
    return failure({
      code: "project-not-found",
      message: "Choose an existing project before adding a subtask.",
    })
  }

  const parent = document.tasks.find((task) => task.id === command.parentTaskId)
  if (!parent) {
    return failure({
      code: "parent-task-not-found",
      message: "Choose an existing parent task before adding a subtask.",
    })
  }

  if (parent.projectId !== command.projectId) {
    return invalidCommand("Subtasks must belong to the same project as their parent task.")
  }

  if (parent.parentTaskId !== undefined) {
    return invalidCommand("Subtasks cannot be nested under another subtask.")
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
    "subtask-created",
    `Added subtask “${title}” to “${parent.title}”.`,
    {
      tasks: [...document.tasks, subtask],
    },
  )
}

const updateTaskConstraints = (
  document: PlannerDocument,
  command: Extract<PlannerCommand, { type: "update-task-constraints" }>,
): CommandResult => {
  const task = document.tasks.find((candidate) => candidate.id === command.taskId)
  if (!task) {
    return failure({
      code: "task-not-found",
      message: "That task no longer exists.",
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
    return invalidCommand("Estimated duration must be an integer between 1 and 1440 minutes.")
  }

  if (command.dueAt !== undefined && !isUtcTimestamp(command.dueAt)) {
    return invalidCommand("Due date must be a valid UTC timestamp.")
  }

  if (command.earliestStartAt !== undefined && !isUtcTimestamp(command.earliestStartAt)) {
    return invalidCommand("Earliest start date must be a valid UTC timestamp.")
  }

  const effectiveEarliest =
    command.earliestStartAt !== undefined ? command.earliestStartAt : task.earliestStartAt
  const effectiveDue = command.dueAt !== undefined ? command.dueAt : task.dueAt

  if (
    effectiveEarliest &&
    effectiveDue &&
    Date.parse(effectiveEarliest) >= Date.parse(effectiveDue)
  ) {
    return invalidCommand("Earliest start time must be before the due date.")
  }

  const nextTitle = command.title ? normaliseTitle(command.title) : undefined
  if (command.title && !nextTitle) {
    return invalidCommand("Task names must contain between 1 and 200 characters.")
  }

  const nextTask: Task = {
    ...task,
    title: nextTitle ?? task.title,
    estimateMinutes:
      command.estimateMinutes !== undefined ? command.estimateMinutes : task.estimateMinutes,
    dueAt: command.dueAt !== undefined ? command.dueAt : task.dueAt,
    earliestStartAt:
      command.earliestStartAt !== undefined ? command.earliestStartAt : task.earliestStartAt,
    priority: command.priority !== undefined ? command.priority : task.priority,
    deadlineStrictness:
      command.deadlineStrictness !== undefined
        ? command.deadlineStrictness
        : task.deadlineStrictness,
    scheduleId: command.scheduleId !== undefined ? command.scheduleId : task.scheduleId,
    notes: command.notes !== undefined ? command.notes : task.notes,
    updatedAt: command.occurredAt,
  }

  return revised(
    document,
    command,
    "task-constraints-updated",
    `Updated constraints for task “${task.title}”.`,
    {
      tasks: document.tasks.map((candidate) =>
        candidate.id === task.id ? nextTask : candidate,
      ),
    },
  )
}

const setTaskCompletion = (
  document: PlannerDocument,
  command: Extract<PlannerCommand, { type: "set-task-completion" }>,
): CommandResult => {
  const task = document.tasks.find((candidate) => candidate.id === command.taskId)
  if (!task) {
    return failure({
      code: "task-not-found",
      message: "That task no longer exists.",
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

  const action = completed ? "Completed" : "Reopened"
  return revised(
    document,
    command,
    "task-completion-changed",
    `${action} task “${task.title}”.`,
    {
      tasks: document.tasks.map((candidate) =>
        candidate.id === task.id ? nextTask : candidate,
      ),
    },
  )
}

const setTaskPriority = (
  document: PlannerDocument,
  command: Extract<PlannerCommand, { type: "set-task-priority" }>,
): CommandResult => {
  const task = document.tasks.find((t) => t.id === command.taskId)
  if (!task) return failure({ code: "task-not-found", message: "Task not found." })

  return revised(
    document,
    command,
    "task-priority-changed",
    `Set priority for “${task.title}” to ${command.priority}.`,
    {
      tasks: document.tasks.map((t) =>
        t.id === task.id ? { ...t, priority: command.priority, updatedAt: command.occurredAt } : t,
      ),
    },
  )
}

const setTaskStrictness = (
  document: PlannerDocument,
  command: Extract<PlannerCommand, { type: "set-task-strictness" }>,
): CommandResult => {
  const task = document.tasks.find((t) => t.id === command.taskId)
  if (!task) return failure({ code: "task-not-found", message: "Task not found." })

  return revised(
    document,
    command,
    "task-strictness-changed",
    `Set deadline strictness for “${task.title}” to ${command.deadlineStrictness}.`,
    {
      tasks: document.tasks.map((t) =>
        t.id === task.id
          ? { ...t, deadlineStrictness: command.deadlineStrictness, updatedAt: command.occurredAt }
          : t,
      ),
    },
  )
}

const setTaskSchedule = (
  document: PlannerDocument,
  command: Extract<PlannerCommand, { type: "set-task-schedule" }>,
): CommandResult => {
  const task = document.tasks.find((t) => t.id === command.taskId)
  if (!task) return failure({ code: "task-not-found", message: "Task not found." })

  return revised(
    document,
    command,
    "task-schedule-changed",
    `Updated schedule binding for “${task.title}”.`,
    {
      tasks: document.tasks.map((t) =>
        t.id === task.id
          ? { ...t, scheduleId: command.scheduleId, updatedAt: command.occurredAt }
          : t,
      ),
    },
  )
}

const setTaskNotes = (
  document: PlannerDocument,
  command: Extract<PlannerCommand, { type: "set-task-notes" }>,
): CommandResult => {
  const task = document.tasks.find((t) => t.id === command.taskId)
  if (!task) return failure({ code: "task-not-found", message: "Task not found." })

  return revised(
    document,
    command,
    "task-notes-updated",
    `Updated notes for “${task.title}”.`,
    {
      tasks: document.tasks.map((t) =>
        t.id === task.id ? { ...t, notes: command.notes, updatedAt: command.occurredAt } : t,
      ),
    },
  )
}

const setTaskRecurrence = (
  document: PlannerDocument,
  command: Extract<PlannerCommand, { type: "set-task-recurrence" }>,
): CommandResult => {
  const task = document.tasks.find((t) => t.id === command.taskId)
  if (!task) return failure({ code: "task-not-found", message: "Task not found." })

  return revised(
    document,
    command,
    "task-recurrence-updated",
    `Updated recurrence rule for “${task.title}”.`,
    {
      tasks: document.tasks.map((t) =>
        t.id === task.id
          ? {
              ...t,
              recurrence: command.recurrence,
              isRecurringParent: Boolean(command.recurrence),
              updatedAt: command.occurredAt,
            }
          : t,
      ),
    },
  )
}

const createFixedEvent = (
  document: PlannerDocument,
  command: Extract<PlannerCommand, { type: "create-fixed-event" }>,
): CommandResult => {
  const title = normaliseTitle(command.title)
  if (!title) {
    return invalidCommand("Event titles must contain between 1 and 200 characters.")
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

  return revised(document, command, "fixed-event-created", `Created fixed event “${title}”.`, {
    fixedEvents: [...document.fixedEvents, event],
  })
}

const deleteFixedEvent = (
  document: PlannerDocument,
  command: Extract<PlannerCommand, { type: "delete-fixed-event" }>,
): CommandResult => {
  const event = document.fixedEvents.find((candidate) => candidate.id === command.eventId)
  if (!event) {
    return failure({
      code: "fixed-event-not-found",
      message: "That fixed event no longer exists.",
    })
  }

  if (hasRevisionId(document, command.revisionId)) {
    return duplicateId()
  }

  return revised(document, command, "fixed-event-deleted", `Deleted fixed event “${event.title}”.`, {
    fixedEvents: document.fixedEvents.filter((candidate) => candidate.id !== command.eventId),
  })
}

const createTaskSession = (
  document: PlannerDocument,
  command: Extract<PlannerCommand, { type: "create-task-session" }>,
): CommandResult => {
  const task = document.tasks.find((candidate) => candidate.id === command.taskId)
  if (!task) {
    return failure({
      code: "task-not-found",
      message: "Cannot schedule a session for a task that does not exist.",
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
    locked: true,
    createdAt: command.occurredAt,
    updatedAt: command.occurredAt,
  }

  return revised(
    document,
    command,
    "task-session-created",
    `Scheduled session for task “${task.title}”.`,
    {
      taskSessions: [...document.taskSessions, session],
    },
  )
}

const deleteTaskSession = (
  document: PlannerDocument,
  command: Extract<PlannerCommand, { type: "delete-task-session" }>,
): CommandResult => {
  const session = document.taskSessions.find((candidate) => candidate.id === command.sessionId)
  if (!session) {
    return failure({
      code: "task-session-not-found",
      message: "That task session no longer exists.",
    })
  }

  if (hasRevisionId(document, command.revisionId)) {
    return duplicateId()
  }

  return revised(document, command, "task-session-deleted", "Deleted task session.", {
    taskSessions: document.taskSessions.filter((candidate) => candidate.id !== command.sessionId),
  })
}

const toggleTaskSessionLock = (
  document: PlannerDocument,
  command: Extract<PlannerCommand, { type: "toggle-task-session-lock" }>,
): CommandResult => {
  const session = document.taskSessions.find((s) => s.id === command.sessionId)
  if (!session) {
    return failure({
      code: "task-session-not-found",
      message: "That task session no longer exists.",
    })
  }

  if (hasRevisionId(document, command.revisionId)) {
    return duplicateId()
  }

  const nextLocked = !session.locked
  const action = nextLocked ? "Pinned" : "Unpinned"

  return revised(
    document,
    command,
    "task-session-lock-toggled",
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
  command: Extract<PlannerCommand, { type: "create-dependency" }>,
): CommandResult => {
  if (command.fromTaskId === command.toTaskId) {
    return invalidCommand("A task cannot depend on itself.")
  }

  const fromTask = document.tasks.find((t) => t.id === command.fromTaskId)
  const toTask = document.tasks.find((t) => t.id === command.toTaskId)

  if (!fromTask || !toTask) {
    return failure({
      code: "task-not-found",
      message: "Both dependent and prerequisite tasks must exist.",
    })
  }

  const alreadyExists = document.dependencies.some(
    (d) => d.fromTaskId === command.fromTaskId && d.toTaskId === command.toTaskId,
  )
  if (alreadyExists) {
    return invalidCommand("This dependency relationship already exists.")
  }

  if (
    hasDependencyCycle(document.dependencies, {
      fromTaskId: command.fromTaskId,
      toTaskId: command.toTaskId,
    })
  ) {
    return invalidCommand("Adding this dependency would create a circular dependency.")
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
    "dependency-created",
    `Set “${toTask.title}” to depend on “${fromTask.title}”.`,
    {
      dependencies: [...document.dependencies, dependency],
    },
  )
}

const deleteDependency = (
  document: PlannerDocument,
  command: Extract<PlannerCommand, { type: "delete-dependency" }>,
): CommandResult => {
  const dep = document.dependencies.find((d) => d.id === command.dependencyId)
  if (!dep) {
    return failure({
      code: "dependency-not-found",
      message: "That dependency no longer exists.",
    })
  }

  if (hasRevisionId(document, command.revisionId)) {
    return duplicateId()
  }

  return revised(
    document,
    command,
    "dependency-deleted",
    "Removed task dependency.",
    {
      dependencies: document.dependencies.filter((d) => d.id !== command.dependencyId),
    },
  )
}

const createSchedule = (
  document: PlannerDocument,
  command: Extract<PlannerCommand, { type: "create-schedule" }>,
): CommandResult => {
  const name = normaliseTitle(command.name)
  if (!name) return invalidCommand("Schedule name must contain between 1 and 200 characters.")

  if (hasId(document, command.id) || hasRevisionId(document, command.revisionId)) {
    return duplicateId()
  }

  const schedule: Schedule = {
    id: command.id,
    name,
    availability: { workingWindows: command.workingWindows },
    color: command.color,
    createdAt: command.occurredAt,
    updatedAt: command.occurredAt,
  }

  return revised(document, command, "schedule-created", `Created schedule “${name}”.`, {
    schedules: [...document.schedules, schedule],
  })
}

const updateSchedule = (
  document: PlannerDocument,
  command: Extract<PlannerCommand, { type: "update-schedule" }>,
): CommandResult => {
  const sched = document.schedules.find((s) => s.id === command.scheduleId)
  if (!sched) return failure({ code: "schedule-not-found", message: "Schedule not found." })

  const nextName = command.name ? normaliseTitle(command.name) : undefined
  const nextWindows = command.workingWindows ? { workingWindows: command.workingWindows } : sched.availability

  return revised(document, command, "schedule-updated", `Updated schedule “${sched.name}”.`, {
    schedules: document.schedules.map((s) => {
      if (s.id === sched.id) {
        return {
          ...s,
          name: nextName ?? s.name,
          availability: nextWindows,
          color: command.color !== undefined ? command.color : s.color,
          isDefault: command.isDefault !== undefined ? command.isDefault : s.isDefault,
          updatedAt: command.occurredAt,
        }
      }
      if (command.isDefault) {
        return { ...s, isDefault: false }
      }
      return s
    }),
  })
}

const deleteSchedule = (
  document: PlannerDocument,
  command: Extract<PlannerCommand, { type: "delete-schedule" }>,
): CommandResult => {
  const sched = document.schedules.find((s) => s.id === command.scheduleId)
  if (!sched) return failure({ code: "schedule-not-found", message: "Schedule not found." })
  if (document.schedules.length <= 1) return invalidCommand("Cannot delete the only remaining schedule.")

  return revised(document, command, "schedule-deleted", `Deleted schedule “${sched.name}”.`, {
    schedules: document.schedules.filter((s) => s.id !== command.scheduleId),
    tasks: document.tasks.map((t) => (t.scheduleId === command.scheduleId ? { ...t, scheduleId: undefined } : t)),
  })
}

const applyPlan = (
  document: PlannerDocument,
  command: Extract<PlannerCommand, { type: "apply-plan" }>,
): CommandResult => {
  if (hasRevisionId(document, command.revisionId)) {
    return duplicateId()
  }

  const previousSnapshot = JSON.stringify(document.taskSessions)

  return revised(
    document,
    command,
    "schedule-planned",
    `Applied reference schedule (${command.sessions.length} session(s) allocated).`,
    {
      taskSessions: command.sessions,
    },
    previousSnapshot,
  )
}

const undoLastPlan = (
  document: PlannerDocument,
  command: Extract<PlannerCommand, { type: "undo-last-plan" }>,
): CommandResult => {
  const targetRevision = [...document.revisions]
    .reverse()
    .find((r) => r.kind === "schedule-planned" && r.snapshot)

  if (!targetRevision || !targetRevision.snapshot) {
    return failure({
      code: "invalid-command",
      message: "No previous schedule plan to undo.",
    })
  }

  let restoredSessions: TaskSession[]
  try {
    restoredSessions = JSON.parse(targetRevision.snapshot) as TaskSession[]
  } catch {
    return invalidCommand("Failed to parse previous schedule snapshot.")
  }

  if (hasRevisionId(document, command.revisionId)) {
    return duplicateId()
  }

  return revised(
    document,
    command,
    "plan-undone",
    "Reverted to previous schedule.",
    {
      taskSessions: restoredSessions,
    },
  )
}

const repairScheduleCommand = (
  document: PlannerDocument,
  command: Extract<PlannerCommand, { type: "repair-schedule" }>,
): CommandResult => {
  if (hasRevisionId(document, command.revisionId)) {
    return duplicateId()
  }

  const snapshot = JSON.stringify(document.taskSessions)

  return revised(
    document,
    command,
    "schedule-repaired",
    "Repaired schedule and shifted overdue sessions forward.",
    {
      taskSessions: command.sessions,
    },
    snapshot,
  )
}

const updateAvailability = (
  document: PlannerDocument,
  command: Extract<PlannerCommand, { type: "update-availability" }>,
): CommandResult => {
  for (const win of command.workingWindows) {
    if (
      win.dayOfWeek < 1 ||
      win.dayOfWeek > 7 ||
      win.startHour < 0 ||
      win.endHour > 24 ||
      win.startHour >= win.endHour
    ) {
      return invalidCommand("Availability window hours must be valid (0-24) with start before end.")
    }
  }

  if (hasRevisionId(document, command.revisionId)) {
    return duplicateId()
  }

  return revised(
    document,
    command,
    "dependency-created",
    "Updated working availability hours.",
    {
      availability: {
        workingWindows: command.workingWindows,
      },
    },
  )
}

const updatePolicy = (
  document: PlannerDocument,
  command: Extract<PlannerCommand, { type: "update-policy" }>,
): CommandResult => {
  const allowedPresets: PolicyPreset[] = ["balanced", "focus", "deadline"]
  if (!allowedPresets.includes(command.policy.preset)) {
    return invalidCommand("Policy preset must be balanced, focus, or deadline.")
  }
  if (
    command.policy.maxDailyWorkMinutes !== undefined &&
    (!Number.isInteger(command.policy.maxDailyWorkMinutes) ||
      command.policy.maxDailyWorkMinutes < 30 ||
      command.policy.maxDailyWorkMinutes > 1440)
  ) {
    return invalidCommand("Max daily work minutes must be an integer between 30 and 1440.")
  }

  if (hasRevisionId(document, command.revisionId)) {
    return duplicateId()
  }

  return revised(
    document,
    command,
    "policy-updated",
    `Updated planning policy to ${command.policy.preset}.`,
    {
      policy: command.policy,
    },
  )
}

const recordProposalDecision = (
  document: PlannerDocument,
  command: Extract<PlannerCommand, { type: "record-proposal-decision" }>,
): CommandResult => {
  if (hasId(document, command.id) || hasRevisionId(document, command.revisionId)) {
    return duplicateId()
  }

  const kind = command.decision.accepted ? "proposal-accepted" : "proposal-rejected"
  const action = command.decision.accepted ? "Accepted" : "Dismissed"
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
      "projects" | "tasks" | "dependencies" | "availability" | "schedules" | "policy" | "fixedEvents" | "taskSessions" | "proposals"
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
      code: "invalid-command",
      message: "Commands need stable identifiers.",
    }
  }

  if (!isUtcTimestamp(command.occurredAt)) {
    return {
      code: "invalid-command",
      message: "Commands need a valid UTC timestamp.",
    }
  }

  if (command.reason !== undefined && !normaliseReason(command.reason)) {
    return {
      code: "invalid-command",
      message: "Reasons must contain between 1 and 300 characters when supplied.",
    }
  }

  return undefined
}

const validateTimeRange = (startAt: string, endAt: string): CommandFailure | undefined => {
  if (!isUtcTimestamp(startAt) || !isUtcTimestamp(endAt)) {
    return {
      code: "invalid-command",
      message: "Start and end times must be valid UTC timestamps.",
    }
  }

  if (Date.parse(startAt) >= Date.parse(endAt)) {
    return {
      code: "invalid-command",
      message: "Start time must be before end time.",
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
  (document.schedules && document.schedules.some((s) => s.id === id)) ||
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
  failure({ code: "invalid-command", message })

const duplicateId = (): CommandResult =>
  failure({
    code: "duplicate-id",
    message: "That identifier is already in use. Please try again.",
  })
