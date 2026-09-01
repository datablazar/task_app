export const PLANNER_SCHEMA_VERSION = 3 as const

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
}

export interface PlannerDocument {
  schemaVersion: typeof PLANNER_SCHEMA_VERSION
  timeZone: string
  revision: number
  projects: Project[]
  tasks: Task[]
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
  fixedEvents: [],
  taskSessions: [],
  revisions: [],
})
