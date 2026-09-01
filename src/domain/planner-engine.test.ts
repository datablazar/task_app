import { describe, expect, it } from 'vitest'
import { createEmptyPlannerDocument } from './model'
import { generateReferencePlan, repairSchedule } from './planner-engine'
import type { Dependency, FixedEvent, PlannerDocument, Task } from './model'

describe('planner-engine', () => {
  const baseDocument: PlannerDocument = {
    ...createEmptyPlannerDocument('Europe/London'),
    projects: [
      {
        id: 'p1',
        title: 'Project 1',
        createdAt: '2026-09-01T09:00:00.000Z',
        updatedAt: '2026-09-01T09:00:00.000Z',
      },
    ],
  }

  it('satisfies determinism invariant: produces identical schedules on repeated runs', () => {
    const tasks: Task[] = [
      {
        id: 'task-1',
        projectId: 'p1',
        title: 'Design architecture',
        completed: false,
        estimateMinutes: 120,
        createdAt: '2026-09-01T09:00:00.000Z',
        updatedAt: '2026-09-01T09:00:00.000Z',
      },
      {
        id: 'task-2',
        projectId: 'p1',
        title: 'Implement prototype',
        completed: false,
        estimateMinutes: 60,
        createdAt: '2026-09-01T09:01:00.000Z',
        updatedAt: '2026-09-01T09:01:00.000Z',
      },
    ]

    const doc: PlannerDocument = { ...baseDocument, tasks }
    const now = '2026-09-01T09:00:00.000Z' // Tuesday 9am

    const plan1 = generateReferencePlan(doc, { now })
    const plan2 = generateReferencePlan(doc, { now })

    expect(plan1.success).toBe(true)
    expect(plan1.sessions).toEqual(plan2.sessions)
    expect(plan1.risks).toEqual(plan2.risks)
  })

  it('satisfies non-overlap and collision invariant: never overlaps with fixed events', () => {
    const tasks: Task[] = [
      {
        id: 'task-1',
        projectId: 'p1',
        title: 'Deep work task',
        completed: false,
        estimateMinutes: 120,
        createdAt: '2026-09-01T09:00:00.000Z',
        updatedAt: '2026-09-01T09:00:00.000Z',
      },
    ]

    // Fixed event occupying 09:00-10:00 on Tuesday 2026-09-01
    const fixedEvents: FixedEvent[] = [
      {
        id: 'fixed-1',
        title: 'Staff Meeting',
        startAt: '2026-09-01T09:00:00.000Z',
        endAt: '2026-09-01T10:00:00.000Z',
        createdAt: '2026-09-01T08:00:00.000Z',
        updatedAt: '2026-09-01T08:00:00.000Z',
      },
    ]

    const doc: PlannerDocument = { ...baseDocument, tasks, fixedEvents }
    const now = '2026-09-01T09:00:00.000Z'

    const plan = generateReferencePlan(doc, { now })
    expect(plan.success).toBe(true)

    // Verify no session starts during 09:00-10:00
    for (const session of plan.sessions) {
      expect(Date.parse(session.startAt) >= Date.parse('2026-09-01T10:00:00.000Z')).toBe(true)
    }
  })

  it('satisfies dependency order invariant: dependent task is strictly scheduled after prerequisite', () => {
    const tasks: Task[] = [
      {
        id: 'task-A',
        projectId: 'p1',
        title: 'Task A (Prerequisite)',
        completed: false,
        estimateMinutes: 60,
        createdAt: '2026-09-01T09:00:00.000Z',
        updatedAt: '2026-09-01T09:00:00.000Z',
      },
      {
        id: 'task-B',
        projectId: 'p1',
        title: 'Task B (Dependent)',
        completed: false,
        estimateMinutes: 60,
        createdAt: '2026-09-01T09:01:00.000Z',
        updatedAt: '2026-09-01T09:01:00.000Z',
      },
    ]

    const dependencies: Dependency[] = [
      {
        id: 'dep-1',
        fromTaskId: 'task-A',
        toTaskId: 'task-B',
        createdAt: '2026-09-01T09:00:00.000Z',
      },
    ]

    const doc: PlannerDocument = { ...baseDocument, tasks, dependencies }
    const now = '2026-09-01T09:00:00.000Z'

    const plan = generateReferencePlan(doc, { now })
    expect(plan.success).toBe(true)

    const sessionA = plan.sessions.find((s) => s.taskId === 'task-A')
    const sessionB = plan.sessions.find((s) => s.taskId === 'task-B')

    expect(sessionA).toBeDefined()
    expect(sessionB).toBeDefined()
    expect(Date.parse(sessionB!.startAt) >= Date.parse(sessionA!.endAt)).toBe(true)
  })

  it('surfaces explicit PlanRisk when a deadline cannot be met', () => {
    const tasks: Task[] = [
      {
        id: 'task-urgent',
        projectId: 'p1',
        title: 'Urgent task with past/tight deadline',
        completed: false,
        estimateMinutes: 180,
        dueAt: '2026-09-01T10:00:00.000Z', // 10:00am deadline but takes 3 hours (finishes at 12:00)
        createdAt: '2026-09-01T09:00:00.000Z',
        updatedAt: '2026-09-01T09:00:00.000Z',
      },
    ]

    const doc: PlannerDocument = { ...baseDocument, tasks }
    const now = '2026-09-01T09:00:00.000Z'

    const plan = generateReferencePlan(doc, { now })
    expect(plan.success).toBe(true)
    expect(plan.risks).toHaveLength(1)
    expect(plan.risks[0]).toMatchObject({
      taskId: 'task-urgent',
      kind: 'deadline-missed',
    })
  })

  it('halts and returns risk if circular dependency exists', () => {
    const tasks: Task[] = [
      {
        id: 'task-1',
        projectId: 'p1',
        title: 'Task 1',
        completed: false,
        createdAt: '2026-09-01T09:00:00.000Z',
        updatedAt: '2026-09-01T09:00:00.000Z',
      },
    ]

    const dependencies: Dependency[] = [
      {
        id: 'dep-loop',
        fromTaskId: 'task-1',
        toTaskId: 'task-1',
        createdAt: '2026-09-01T09:00:00.000Z',
      },
    ]

    const doc: PlannerDocument = { ...baseDocument, tasks, dependencies }
    const plan = generateReferencePlan(doc, { now: '2026-09-01T09:00:00.000Z' })

    expect(plan.success).toBe(false)
    expect(plan.risks[0]?.message).toContain('Circular dependencies detected')
  })

  it('repairSchedule recovers past uncompleted sessions and reschedules them forward', () => {
    const tasks: Task[] = [
      {
        id: 'task-overdue',
        projectId: 'p1',
        title: 'Task Overdue',
        completed: false,
        estimateMinutes: 60,
        createdAt: '2026-08-31T08:00:00.000Z',
        updatedAt: '2026-08-31T08:00:00.000Z',
      },
    ]

    // Past session ended at 10:00 on Monday
    const staleSession = {
      id: 'session-past-1',
      taskId: 'task-overdue',
      startAt: '2026-08-31T09:00:00.000Z',
      endAt: '2026-08-31T10:00:00.000Z',
      createdAt: '2026-08-31T08:00:00.000Z',
      updatedAt: '2026-08-31T08:00:00.000Z',
    }

    const doc: PlannerDocument = {
      ...baseDocument,
      tasks,
      taskSessions: [staleSession],
    }

    // Now is Monday 14:00 (past the session)
    const now = '2026-08-31T14:00:00.000Z'

    const repair = repairSchedule(doc, { now })
    expect(repair.repairedCount).toBe(1)
    expect(repair.sessions).toHaveLength(1)
    // Rescheduled session must start at or after 14:00
    expect(Date.parse(repair.sessions[0].startAt)).toBeGreaterThanOrEqual(Date.parse(now))
  })

  it('schedules higher priority tasks before lower priority tasks', () => {
    const tasks: Task[] = [
      {
        id: 'task-low',
        projectId: 'p1',
        title: 'Low Priority Task',
        completed: false,
        priority: 'LOW',
        estimateMinutes: 60,
        createdAt: '2026-09-01T08:00:00.000Z',
        updatedAt: '2026-09-01T08:00:00.000Z',
      },
      {
        id: 'task-asap',
        projectId: 'p1',
        title: 'ASAP Priority Task',
        completed: false,
        priority: 'ASAP',
        estimateMinutes: 60,
        createdAt: '2026-09-01T08:30:00.000Z',
        updatedAt: '2026-09-01T08:30:00.000Z',
      },
      {
        id: 'task-high',
        projectId: 'p1',
        title: 'High Priority Task',
        completed: false,
        priority: 'HIGH',
        estimateMinutes: 60,
        createdAt: '2026-09-01T08:15:00.000Z',
        updatedAt: '2026-09-01T08:15:00.000Z',
      },
    ]

    const doc: PlannerDocument = { ...baseDocument, tasks }
    const now = '2026-09-01T09:00:00.000Z'

    const plan = generateReferencePlan(doc, { now })
    expect(plan.success).toBe(true)
    expect(plan.sessions).toHaveLength(3)

    // ASAP should be scheduled first (09:00), High second (10:00), Low third (11:00)
    expect(plan.sessions[0].taskId).toBe('task-asap')
    expect(plan.sessions[1].taskId).toBe('task-high')
    expect(plan.sessions[2].taskId).toBe('task-low')
  })

  it('prioritizes imminent HARD deadlines before soft deadlines', () => {
    const tasks: Task[] = [
      {
        id: 'task-soft',
        projectId: 'p1',
        title: 'Soft deadline task',
        completed: false,
        priority: 'HIGH',
        deadlineType: 'SOFT',
        dueAt: '2026-09-03T17:00:00.000Z',
        estimateMinutes: 60,
        createdAt: '2026-09-01T08:00:00.000Z',
        updatedAt: '2026-09-01T08:00:00.000Z',
      },
      {
        id: 'task-hard',
        projectId: 'p1',
        title: 'Imminent hard deadline task',
        completed: false,
        priority: 'MEDIUM',
        deadlineType: 'HARD',
        dueAt: '2026-09-01T11:00:00.000Z', // Today 11am!
        estimateMinutes: 60,
        createdAt: '2026-09-01T08:30:00.000Z',
        updatedAt: '2026-09-01T08:30:00.000Z',
      },
    ]

    const doc: PlannerDocument = { ...baseDocument, tasks }
    const now = '2026-09-01T09:00:00.000Z'

    const plan = generateReferencePlan(doc, { now })
    expect(plan.success).toBe(true)
    expect(plan.sessions[0].taskId).toBe('task-hard')
    expect(plan.sessions[1].taskId).toBe('task-soft')
  })
})
