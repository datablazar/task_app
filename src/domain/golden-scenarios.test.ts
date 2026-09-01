import { describe, expect, it } from 'vitest'
import { createEmptyPlannerDocument } from './model'
import { generateReferencePlan } from './planner-engine'
import type { Dependency, FixedEvent, PlannerDocument, Task, TaskSession } from './model'

describe('golden-scenarios: Planning Quality & Representative Workloads', () => {
  const baseDocument: PlannerDocument = {
    ...createEmptyPlannerDocument('Europe/London'),
    projects: [
      {
        id: 'p1',
        title: 'Academic Term Prep',
        createdAt: '2026-09-01T08:00:00.000Z',
        updatedAt: '2026-09-01T08:00:00.000Z',
      },
    ],
  }

  it('Scenario 1: Academic course preparation with research, dependencies, deadlines and fixed office hours', () => {
    // Monday 2026-08-31 09:00 UTC
    const now = '2026-08-31T09:00:00.000Z'

    const tasks: Task[] = [
      {
        id: 't-lit',
        projectId: 'p1',
        title: 'Literature Review',
        completed: false,
        estimateMinutes: 180, // 3 hours
        createdAt: '2026-08-31T08:00:00.000Z',
        updatedAt: '2026-08-31T08:00:00.000Z',
      },
      {
        id: 't-syl',
        projectId: 'p1',
        title: 'Write Syllabus',
        completed: false,
        estimateMinutes: 120, // 2 hours
        dueAt: '2026-09-02T17:00:00.000Z', // Wednesday 17:00 deadline
        createdAt: '2026-08-31T08:01:00.000Z',
        updatedAt: '2026-08-31T08:01:00.000Z',
      },
      {
        id: 't-pset',
        projectId: 'p1',
        title: 'Design Problem Set 1',
        completed: false,
        estimateMinutes: 120, // 2 hours
        dueAt: '2026-09-04T17:00:00.000Z', // Friday 17:00 deadline
        createdAt: '2026-08-31T08:02:00.000Z',
        updatedAt: '2026-08-31T08:02:00.000Z',
      },
    ]

    const dependencies: Dependency[] = [
      {
        id: 'dep-1',
        fromTaskId: 't-lit',
        toTaskId: 't-syl',
        createdAt: '2026-08-31T08:05:00.000Z',
      },
      {
        id: 'dep-2',
        fromTaskId: 't-syl',
        toTaskId: 't-pset',
        createdAt: '2026-08-31T08:06:00.000Z',
      },
    ]

    const fixedEvents: FixedEvent[] = [
      {
        id: 'ev-fac',
        title: 'Faculty Committee',
        startAt: '2026-08-31T10:00:00.000Z', // Mon 10:00 - 12:00
        endAt: '2026-08-31T12:00:00.000Z',
        createdAt: '2026-08-31T08:00:00.000Z',
        updatedAt: '2026-08-31T08:00:00.000Z',
      },
      {
        id: 'ev-oh',
        title: 'Student Office Hours',
        startAt: '2026-09-02T14:00:00.000Z', // Wed 14:00 - 16:00
        endAt: '2026-09-02T16:00:00.000Z',
        createdAt: '2026-08-31T08:00:00.000Z',
        updatedAt: '2026-08-31T08:00:00.000Z',
      },
    ]

    const doc: PlannerDocument = {
      ...baseDocument,
      tasks,
      dependencies,
      fixedEvents,
      policy: { preset: 'balanced', maxDailyWorkMinutes: 360 },
    }

    const plan = generateReferencePlan(doc, { now })

    expect(plan.success).toBe(true)
    expect(plan.risks).toEqual([]) // Zero deadline misses

    // Invariant: Zero collisions with fixed events
    for (const session of plan.sessions) {
      for (const event of fixedEvents) {
        const sStart = Date.parse(session.startAt)
        const sEnd = Date.parse(session.endAt)
        const eStart = Date.parse(event.startAt)
        const eEnd = Date.parse(event.endAt)
        expect(sStart < eEnd && sEnd > eStart).toBe(false)
      }
    }

    // Invariant: Dependency order (Literature -> Syllabus -> Problem Set)
    const litSessions = plan.sessions.filter((s) => s.taskId === 't-lit')
    const sylSessions = plan.sessions.filter((s) => s.taskId === 't-syl')
    const psetSessions = plan.sessions.filter((s) => s.taskId === 't-pset')

    const lastLitEnd = Math.max(...litSessions.map((s) => Date.parse(s.endAt)))
    const firstSylStart = Math.min(...sylSessions.map((s) => Date.parse(s.startAt)))
    const lastSylEnd = Math.max(...sylSessions.map((s) => Date.parse(s.endAt)))
    const firstPsetStart = Math.min(...psetSessions.map((s) => Date.parse(s.startAt)))

    expect(firstSylStart).toBeGreaterThanOrEqual(lastLitEnd)
    expect(firstPsetStart).toBeGreaterThanOrEqual(lastSylEnd)
  })

  it('Scenario 2: Multi-stage software release sprint with strict deadline', () => {
    const now = '2026-08-31T09:00:00.000Z' // Monday 9am

    const tasks: Task[] = [
      {
        id: 't-spec',
        projectId: 'p1',
        title: 'Technical Specification',
        completed: false,
        estimateMinutes: 60,
        createdAt: '2026-08-31T08:00:00.000Z',
        updatedAt: '2026-08-31T08:00:00.000Z',
      },
      {
        id: 't-api',
        projectId: 'p1',
        title: 'Backend API Implementation',
        completed: false,
        estimateMinutes: 120,
        createdAt: '2026-08-31T08:01:00.000Z',
        updatedAt: '2026-08-31T08:01:00.000Z',
      },
      {
        id: 't-ui',
        projectId: 'p1',
        title: 'Frontend Client Implementation',
        completed: false,
        estimateMinutes: 120,
        createdAt: '2026-08-31T08:02:00.000Z',
        updatedAt: '2026-08-31T08:02:00.000Z',
      },
      {
        id: 't-e2e',
        projectId: 'p1',
        title: 'E2E Testing & Release Tag',
        completed: false,
        estimateMinutes: 60,
        dueAt: '2026-09-04T17:00:00.000Z', // Friday 17:00 release deadline
        createdAt: '2026-08-31T08:03:00.000Z',
        updatedAt: '2026-08-31T08:03:00.000Z',
      },
    ]

    const dependencies: Dependency[] = [
      { id: 'd1', fromTaskId: 't-spec', toTaskId: 't-api', createdAt: '2026-08-31T08:05:00.000Z' },
      { id: 'd2', fromTaskId: 't-api', toTaskId: 't-ui', createdAt: '2026-08-31T08:05:00.000Z' },
      { id: 'd3', fromTaskId: 't-ui', toTaskId: 't-e2e', createdAt: '2026-08-31T08:05:00.000Z' },
    ]

    const doc: PlannerDocument = { ...baseDocument, tasks, dependencies }
    const plan = generateReferencePlan(doc, { now })

    expect(plan.success).toBe(true)
    expect(plan.risks).toHaveLength(0)

    // Total 6 hours allocated
    const totalMinutes = plan.sessions.reduce((acc, s) => {
      return acc + (Date.parse(s.endAt) - Date.parse(s.startAt)) / (60 * 1000)
    }, 0)
    expect(totalMinutes).toBe(360)
  })

  it('Scenario 3: Load balance distributes workload evenly across working days under balanced policy', () => {
    const now = '2026-08-31T09:00:00.000Z' // Monday 9am

    // 4 tasks of 120 minutes each (8 hours total)
    const tasks: Task[] = [
      {
        id: 't-1',
        projectId: 'p1',
        title: 'Task 1',
        completed: false,
        estimateMinutes: 120,
        createdAt: '2026-08-31T08:00:00.000Z',
        updatedAt: '2026-08-31T08:00:00.000Z',
      },
      {
        id: 't-2',
        projectId: 'p1',
        title: 'Task 2',
        completed: false,
        estimateMinutes: 120,
        createdAt: '2026-08-31T08:01:00.000Z',
        updatedAt: '2026-08-31T08:01:00.000Z',
      },
      {
        id: 't-3',
        projectId: 'p1',
        title: 'Task 3',
        completed: false,
        estimateMinutes: 120,
        createdAt: '2026-08-31T08:02:00.000Z',
        updatedAt: '2026-08-31T08:02:00.000Z',
      },
      {
        id: 't-4',
        projectId: 'p1',
        title: 'Task 4',
        completed: false,
        estimateMinutes: 120,
        createdAt: '2026-08-31T08:03:00.000Z',
        updatedAt: '2026-08-31T08:03:00.000Z',
      },
    ]

    // Cap at 240 min (4h) per day
    const doc: PlannerDocument = {
      ...baseDocument,
      tasks,
      policy: { preset: 'balanced', maxDailyWorkMinutes: 240 },
    }

    const plan = generateReferencePlan(doc, { now })
    expect(plan.success).toBe(true)

    // Calculate daily workload in minutes
    const dayTotals = new Map<string, number>()
    for (const session of plan.sessions) {
      const day = session.startAt.slice(0, 10)
      const dur = (Date.parse(session.endAt) - Date.parse(session.startAt)) / (60 * 1000)
      dayTotals.set(day, (dayTotals.get(day) ?? 0) + dur)
    }

    // Expect work to be split across at least 2 days (Mon and Tue), each at 240 min
    expect(dayTotals.get('2026-08-31')).toBe(240) // Monday: 4 hours
    expect(dayTotals.get('2026-09-01')).toBe(240) // Tuesday: 4 hours
  })

  it('Scenario 4: User locked sessions remain strictly preserved during automatic replanning', () => {
    const now = '2026-08-31T09:00:00.000Z'

    const tasks: Task[] = [
      {
        id: 't-focus',
        projectId: 'p1',
        title: 'Core Algorithm',
        completed: false,
        estimateMinutes: 120,
        createdAt: '2026-08-31T08:00:00.000Z',
        updatedAt: '2026-08-31T08:00:00.000Z',
      },
    ]

    // User pinned a session on Tuesday 14:00 - 15:00
    const lockedSession: TaskSession = {
      id: 'session-pinned-1',
      taskId: 't-focus',
      startAt: '2026-09-01T14:00:00.000Z',
      endAt: '2026-09-01T15:00:00.000Z',
      locked: true,
      createdAt: '2026-08-31T08:00:00.000Z',
      updatedAt: '2026-08-31T08:00:00.000Z',
    }

    const doc: PlannerDocument = {
      ...baseDocument,
      tasks,
      taskSessions: [lockedSession],
    }

    const plan = generateReferencePlan(doc, { now })
    expect(plan.success).toBe(true)

    // The pinned session must exist in the output plan unchanged
    const foundLocked = plan.sessions.find((s) => s.id === 'session-pinned-1')
    expect(foundLocked).toBeDefined()
    expect(foundLocked?.locked).toBe(true)
    expect(foundLocked?.startAt).toBe('2026-09-01T14:00:00.000Z')

    // Remaining 60m should be scheduled in an available slot (e.g. Monday morning)
    const remainingSession = plan.sessions.find((s) => s.id !== 'session-pinned-1')
    expect(remainingSession).toBeDefined()
    expect(remainingSession?.taskId).toBe('t-focus')
    const remainingDuration =
      (Date.parse(remainingSession!.endAt) - Date.parse(remainingSession!.startAt)) / (60 * 1000)
    expect(remainingDuration).toBe(60)
  })
})
