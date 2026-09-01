export const PLANNER_SCHEMA_VERSION = 8 as const

export type RevisionKind =
  | 'project-created'
  | 'task-created'
  | 'subtask-created'
  | 'task-completion-changed'
  | 'task-constraints-updated'
  | 'task-metadata-updated'
  | 'task-moved'
  | 'schedule-created'
  | 'schedule-updated'
  | 'schedule-deleted'
  | 'default-schedule-changed'
  | 'recurrence-rule-created'
  | 'recurrence-rule-updated'
  | 'recurrence-rule-deleted'
  | 'recurring-tasks-generated'
  | 'fixed-event-created'
  | 'fixed-event-deleted'
  | 'task-session-created'
  | 'task-session-deleted'
  | 'task-session-lock-toggled'
  | 'dependency-created'
  | 'dependency-deleted'
  | 'schedule-planned'
  | 'plan-undone'
  | 'policy-updated'
  | 'proposal-accepted'
  | 'proposal-rejected'
  | 'schedule-repaired'

export type PolicyPreset = 'balanced' | 'focus' | 'deadline'

export interface PlanningPolicy {
  preset: PolicyPreset
  maxDailyWorkMinutes?: number // Default 360 (6 hours)
  preferredTime?: 'morning' | 'afternoon' | 'any'
}

export const DEFAULT_POLICY: PlanningPolicy = {
  preset: 'balanced',
  maxDailyWorkMinutes: 360,
  preferredTime: 'any',
}

export type TaskPriority = 'ASAP' | 'HIGH' | 'MEDIUM' | 'LOW'
export type DeadlineType = 'HARD' | 'SOFT' | 'NONE'

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
  description?: string
  completed: boolean
  priority?: TaskPriority
  deadlineType?: DeadlineType
  labels?: string[]
  estimateMinutes?: number
  dueAt?: string
  earliestStartAt?: string
  scheduleId?: string
  recurrenceRuleId?: string
  recurrenceInstanceDate?: string
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

export interface Schedule {
  id: string
  title: string
  isDefault: boolean
  workingWindows: AvailabilityWindow[]
  createdAt: string
  updatedAt: string
}

export const DEFAULT_SCHEDULES: Schedule[] = [
  {
    id: 'sched-work',
    title: 'Work Hours',
    isDefault: true,
    workingWindows: [
      { dayOfWeek: 1, startHour: 9, endHour: 17 }, // Monday
      { dayOfWeek: 2, startHour: 9, endHour: 17 }, // Tuesday
      { dayOfWeek: 3, startHour: 9, endHour: 17 }, // Wednesday
      { dayOfWeek: 4, startHour: 9, endHour: 17 }, // Thursday
      { dayOfWeek: 5, startHour: 9, endHour: 17 }, // Friday
    ],
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'sched-personal',
    title: 'Personal',
    isDefault: false,
    workingWindows: [
      { dayOfWeek: 1, startHour: 17, endHour: 21 },
      { dayOfWeek: 2, startHour: 17, endHour: 21 },
      { dayOfWeek: 3, startHour: 17, endHour: 21 },
      { dayOfWeek: 4, startHour: 17, endHour: 21 },
      { dayOfWeek: 5, startHour: 17, endHour: 21 },
      { dayOfWeek: 6, startHour: 10, endHour: 18 }, // Saturday
      { dayOfWeek: 7, startHour: 10, endHour: 18 }, // Sunday
    ],
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  },
]

export const DEFAULT_AVAILABILITY: Availability = {
  workingWindows: DEFAULT_SCHEDULES[0].workingWindows,
}

export type RecurrenceFrequency = 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY'

export interface RecurrenceRule {
  id: string
  projectId: string
  title: string
  description?: string
  estimateMinutes?: number
  priority?: TaskPriority
  deadlineType?: DeadlineType
  labels?: string[]
  scheduleId?: string
  frequency: RecurrenceFrequency
  daysOfWeek?: number[] // 1-7 for weekly/biweekly
  interval?: number     // e.g. every 1 week, every 2 weeks
  startDate: string     // ISO string
  endDate?: string      // optional ISO string
  createdAt: string
  updatedAt: string
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
  locked?: boolean
  createdAt: string
  updatedAt: string
}

export type ProposalCapability =
  | 'duration-estimate'
  | 'subtask-decomposition'
  | 'deadline-extract'
  | 'dependency-infer'

export type ProposalProvenance = 'heuristic' | 'simulated-ai' | 'gemini-api'

export interface ProposalDecision {
  id: string
  taskId: string
  capability: ProposalCapability
  provenance: ProposalProvenance
  confidence: number // 0.0 to 1.0
  summary: string
  accepted: boolean
  occurredAt: string
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
  schedules: Schedule[]
  recurrenceRules: RecurrenceRule[]
  availability: Availability
  policy: PlanningPolicy
  fixedEvents: FixedEvent[]
  taskSessions: TaskSession[]
  proposals: ProposalDecision[]
  revisions: Revision[]
}

export const createEmptyPlannerDocument = (timeZone = 'UTC'): PlannerDocument => ({
  schemaVersion: PLANNER_SCHEMA_VERSION,
  timeZone,
  revision: 0,
  projects: [],
  tasks: [],
  dependencies: [],
  schedules: DEFAULT_SCHEDULES,
  recurrenceRules: [],
  availability: DEFAULT_AVAILABILITY,
  policy: DEFAULT_POLICY,
  fixedEvents: [],
  taskSessions: [],
  proposals: [],
  revisions: [],
})
