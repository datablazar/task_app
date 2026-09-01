export const PLANNER_SCHEMA_VERSION = 4 as const

export type RevisionKind =
  | 'project-created'
  | 'task-created'
  | 'subtask-created'
  | 'task-completion-changed'
  | 'task-constraints-updated'
  | 'fixed-event-created'
  | 'fixed-event-deleted'
  | 'task-session-created'
  | 'task-session-deleted'
  | 'dependency-created'
  | 'dependency-deleted'
  | 'schedule-planned'
  | 'plan-undone'

export interface Project {
  id: string
  title: string
  createdAt: string
  updatedAt: string
}

export interface Task {
  id: string
  projectId: string
  parentTaskId?: string
  title: string
  completed: boolean
  estimateMinutes?: number
  dueAt?: string
  earliestStartAt?: string
  createdAt: string
  updatedAt: string
}

export interface Dependency {
  id: string
  fromTaskId: string // Prerequisite task (must finish first)
  toTaskId: string   // Dependent task
  createdAt: string
}

export interface AvailabilityWindow {
  dayOfWeek: number // 1 (Mon) to 7 (Sun)
  startHour: number // 0-23
  endHour: number   // 1-24 (startHour < endHour)
}

export interface Availability {
  workingWindows: AvailabilityWindow[]
}

export const DEFAULT_AVAILABILITY: Availability = {
  workingWindows: [
    { dayOfWeek: 1, startHour: 9, endHour: 17 }, // Monday
    { dayOfWeek: 2, startHour: 9, endHour: 17 }, // Tuesday
    { dayOfWeek: 3, startHour: 9, endHour: 17 }, // Wednesday
    { dayOfWeek: 4, startHour: 9, endHour: 17 }, // Thursday
    { dayOfWeek: 5, startHour: 9, endHour: 17 }, // Friday
  ],
}

export interface PlanRisk {
  taskId: string
  kind: 'deadline-missed' | 'unscheduled-work'
  message: string
  dueAt?: string
  deficitMinutes?: number
}

export interface FixedEvent {
  id: string
  title: string
  startAt: string
  endAt: string
  createdAt: string
  updatedAt: string
}

export interface TaskSession {
  id: string
  taskId: string
  startAt: string
  endAt: string
  createdAt: string
  updatedAt: string
}

export interface Revision {
  id: string
  number: number
  kind: RevisionKind
  reason: string
  occurredAt: string
  snapshot?: string // serialized previous document snapshot for exact undo
}

export interface PlannerDocument {
  schemaVersion: typeof PLANNER_SCHEMA_VERSION
  timeZone: string
  revision: number
  projects: Project[]
  tasks: Task[]
  dependencies: Dependency[]
  availability: Availability
  fixedEvents: FixedEvent[]
  taskSessions: TaskSession[]
  revisions: Revision[]
}

export const createEmptyPlannerDocument = (timeZone = 'UTC'): PlannerDocument => ({
  schemaVersion: PLANNER_SCHEMA_VERSION,
  timeZone,
  revision: 0,
  projects: [],
  tasks: [],
  dependencies: [],
  availability: DEFAULT_AVAILABILITY,
  fixedEvents: [],
  taskSessions: [],
  revisions: [],
})
