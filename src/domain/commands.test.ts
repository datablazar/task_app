import { describe, expect, it } from 'vitest'
import { executeCommand } from './commands'
import { createEmptyPlannerDocument } from './model'

const firstMoment = '2026-09-01T09:00:00.000Z'
const secondMoment = '2026-09-01T09:01:00.000Z'

describe('executeCommand', () => {
  it('creates a project and task with revisioned, non-replanning results', () => {
    const empty = createEmptyPlannerDocument()
    const projectResult = executeCommand(empty, {
      type: 'create-project',
      id: 'project-1',
      revisionId: 'revision-1',
      occurredAt: firstMoment,
      title: '  Prepare autumn course  ',
    })

    expect(projectResult).toMatchObject({
      ok: true,
      value: {
        replanningRequired: false,
        revision: { number: 1, kind: 'project-created' },
      },
    })
    if (!projectResult.ok) {
      throw new Error(projectResult.error.message)
    }

    const taskResult = executeCommand(projectResult.value.document, {
      type: 'create-task',
      id: 'task-1',
      revisionId: 'revision-2',
      occurredAt: secondMoment,
      projectId: 'project-1',
      title: 'Outline week one',
    })

    expect(taskResult).toMatchObject({
      ok: true,
      value: {
        document: {
          revision: 2,
          projects: [{ id: 'project-1', title: 'Prepare autumn course' }],
          tasks: [{ id: 'task-1', projectId: 'project-1', completed: false }],
        },
        revision: { number: 2, kind: 'task-created' },
      },
    })
    expect(empty).toEqual(createEmptyPlannerDocument())
  })

  it('rejects a task for a missing project without changing the source document', () => {
    const empty = createEmptyPlannerDocument()

    const result = executeCommand(empty, {
      type: 'create-task',
      id: 'task-1',
      revisionId: 'revision-1',
      occurredAt: firstMoment,
      projectId: 'missing-project',
      title: 'Outline week one',
    })

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'project-not-found',
        message: 'Choose an existing project before adding a task.',
      },
    })
    expect(empty).toEqual(createEmptyPlannerDocument())
  })

  it('creates and deletes a fixed event with correct revision records', () => {
    const empty = createEmptyPlannerDocument()
    const createResult = executeCommand(empty, {
      type: 'create-fixed-event',
      id: 'event-1',
      revisionId: 'revision-1',
      occurredAt: firstMoment,
      title: 'Department Seminar',
      startAt: '2026-09-01T10:00:00.000Z',
      endAt: '2026-09-01T11:00:00.000Z',
    })

    expect(createResult).toMatchObject({
      ok: true,
      value: {
        document: {
          revision: 1,
          fixedEvents: [
            {
              id: 'event-1',
              title: 'Department Seminar',
              startAt: '2026-09-01T10:00:00.000Z',
              endAt: '2026-09-01T11:00:00.000Z',
            },
          ],
        },
        revision: { number: 1, kind: 'fixed-event-created' },
      },
    })
    if (!createResult.ok) throw new Error('Expected successful event creation')

    const deleteResult = executeCommand(createResult.value.document, {
      type: 'delete-fixed-event',
      id: 'event-1',
      revisionId: 'revision-2',
      occurredAt: secondMoment,
      eventId: 'event-1',
    })

    expect(deleteResult).toMatchObject({
      ok: true,
      value: {
        document: {
          revision: 2,
          fixedEvents: [],
        },
        revision: { number: 2, kind: 'fixed-event-deleted' },
      },
    })
  })

  it('schedules and deletes a task session with validation', () => {
    const empty = createEmptyPlannerDocument()
    const projResult = executeCommand(empty, {
      type: 'create-project',
      id: 'proj-1',
      revisionId: 'rev-1',
      occurredAt: firstMoment,
      title: 'Course Prep',
    })
    if (!projResult.ok) throw new Error('Project creation failed')

    const taskResult = executeCommand(projResult.value.document, {
      type: 'create-task',
      id: 'task-1',
      revisionId: 'rev-2',
      occurredAt: firstMoment,
      projectId: 'proj-1',
      title: 'Draft slides',
    })
    if (!taskResult.ok) throw new Error('Task creation failed')

    // Invalid: start time >= end time
    const invalidTimeResult = executeCommand(taskResult.value.document, {
      type: 'create-task-session',
      id: 'session-1',
      revisionId: 'rev-3',
      occurredAt: secondMoment,
      taskId: 'task-1',
      startAt: '2026-09-01T14:00:00.000Z',
      endAt: '2026-09-01T13:00:00.000Z',
    })
    expect(invalidTimeResult).toEqual({
      ok: false,
      error: {
        code: 'invalid-command',
        message: 'Start time must be before end time.',
      },
    })

    // Valid session
    const sessionResult = executeCommand(taskResult.value.document, {
      type: 'create-task-session',
      id: 'session-1',
      revisionId: 'rev-3',
      occurredAt: secondMoment,
      taskId: 'task-1',
      startAt: '2026-09-01T14:00:00.000Z',
      endAt: '2026-09-01T15:00:00.000Z',
    })
    expect(sessionResult).toMatchObject({
      ok: true,
      value: {
        document: {
          taskSessions: [{ id: 'session-1', taskId: 'task-1' }],
        },
        revision: { number: 3, kind: 'task-session-created' },
      },
    })
    if (!sessionResult.ok) throw new Error('Session creation failed')

    // Delete session
    const deleteSessionResult = executeCommand(sessionResult.value.document, {
      type: 'delete-task-session',
      id: 'session-1',
      revisionId: 'rev-4',
      occurredAt: secondMoment,
      sessionId: 'session-1',
    })
    expect(deleteSessionResult).toMatchObject({
      ok: true,
      value: {
        document: {
          taskSessions: [],
        },
        revision: { number: 4, kind: 'task-session-deleted' },
      },
    })
  })

  it('creates subtasks and enforces hierarchy rules', () => {
    const empty = createEmptyPlannerDocument()
    const p1 = executeCommand(empty, {
      type: 'create-project',
      id: 'proj-1',
      revisionId: 'rev-1',
      occurredAt: firstMoment,
      title: 'Project 1',
    })
    if (!p1.ok) throw new Error()

    const t1 = executeCommand(p1.value.document, {
      type: 'create-task',
      id: 'task-1',
      revisionId: 'rev-2',
      occurredAt: firstMoment,
      projectId: 'proj-1',
      title: 'Main Task',
    })
    if (!t1.ok) throw new Error()

    // Valid subtask
    const subtaskResult = executeCommand(t1.value.document, {
      type: 'create-subtask',
      id: 'subtask-1',
      revisionId: 'rev-3',
      occurredAt: secondMoment,
      projectId: 'proj-1',
      parentTaskId: 'task-1',
      title: 'Step 1',
    })
    expect(subtaskResult).toMatchObject({
      ok: true,
      value: {
        document: {
          tasks: [
            { id: 'task-1', title: 'Main Task' },
            { id: 'subtask-1', parentTaskId: 'task-1', title: 'Step 1' },
          ],
        },
        revision: { number: 3, kind: 'subtask-created' },
      },
    })
    if (!subtaskResult.ok) throw new Error()

    // Cannot nest under a subtask
    const nestedResult = executeCommand(subtaskResult.value.document, {
      type: 'create-subtask',
      id: 'subtask-2',
      revisionId: 'rev-4',
      occurredAt: secondMoment,
      projectId: 'proj-1',
      parentTaskId: 'subtask-1',
      title: 'Nested Step',
    })
    expect(nestedResult).toEqual({
      ok: false,
      error: {
        code: 'invalid-command',
        message: 'Subtasks cannot be nested under another subtask.',
      },
    })

    // Cannot attach to missing parent
    const missingParentResult = executeCommand(subtaskResult.value.document, {
      type: 'create-subtask',
      id: 'subtask-3',
      revisionId: 'rev-5',
      occurredAt: secondMoment,
      projectId: 'proj-1',
      parentTaskId: 'non-existent',
      title: 'Ghost Step',
    })
    expect(missingParentResult).toEqual({
      ok: false,
      error: {
        code: 'parent-task-not-found',
        message: 'Choose an existing parent task before adding a subtask.',
      },
    })
  })

  it('updates task constraints with validation', () => {
    const empty = createEmptyPlannerDocument()
    const p1 = executeCommand(empty, {
      type: 'create-project',
      id: 'proj-1',
      revisionId: 'rev-1',
      occurredAt: firstMoment,
      title: 'Project 1',
    })
    if (!p1.ok) throw new Error()

    const t1 = executeCommand(p1.value.document, {
      type: 'create-task',
      id: 'task-1',
      revisionId: 'rev-2',
      occurredAt: firstMoment,
      projectId: 'proj-1',
      title: 'Main Task',
    })
    if (!t1.ok) throw new Error()

    // Invalid estimate minutes
    const badEstimate = executeCommand(t1.value.document, {
      type: 'update-task-constraints',
      id: 'task-1',
      revisionId: 'rev-3',
      occurredAt: secondMoment,
      taskId: 'task-1',
      estimateMinutes: -10,
    })
    expect(badEstimate).toEqual({
      ok: false,
      error: {
        code: 'invalid-command',
        message: 'Estimated duration must be an integer between 1 and 1440 minutes.',
      },
    })

    // Invalid earliest >= due
    const badRange = executeCommand(t1.value.document, {
      type: 'update-task-constraints',
      id: 'task-1',
      revisionId: 'rev-3',
      occurredAt: secondMoment,
      taskId: 'task-1',
      earliestStartAt: '2026-09-05T12:00:00.000Z',
      dueAt: '2026-09-02T12:00:00.000Z',
    })
    expect(badRange).toEqual({
      ok: false,
      error: {
        code: 'invalid-command',
        message: 'Earliest start time must be before the due date.',
      },
    })

    // Valid constraints
    const validUpdate = executeCommand(t1.value.document, {
      type: 'update-task-constraints',
      id: 'task-1',
      revisionId: 'rev-3',
      occurredAt: secondMoment,
      taskId: 'task-1',
      estimateMinutes: 45,
      dueAt: '2026-09-10T18:00:00.000Z',
    })
    expect(validUpdate).toMatchObject({
      ok: true,
      value: {
        document: {
          tasks: [
            {
              id: 'task-1',
              estimateMinutes: 45,
              dueAt: '2026-09-10T18:00:00.000Z',
            },
          ],
        },
        revision: { number: 3, kind: 'task-constraints-updated' },
      },
    })
  })

  it('creates, validates, and deletes dependencies with cycle protection', () => {
    const empty = createEmptyPlannerDocument()
    const p1 = executeCommand(empty, {
      type: 'create-project',
      id: 'proj-1',
      revisionId: 'rev-1',
      occurredAt: firstMoment,
      title: 'Project 1',
    })
    if (!p1.ok) throw new Error()

    const t1 = executeCommand(p1.value.document, {
      type: 'create-task',
      id: 'task-1',
      revisionId: 'rev-2',
      occurredAt: firstMoment,
      projectId: 'proj-1',
      title: 'Task 1',
    })
    const t2 = executeCommand(t1.ok ? t1.value.document : empty, {
      type: 'create-task',
      id: 'task-2',
      revisionId: 'rev-3',
      occurredAt: firstMoment,
      projectId: 'proj-1',
      title: 'Task 2',
    })
    if (!t2.ok) throw new Error()

    // Cannot self-depend
    const selfDep = executeCommand(t2.value.document, {
      type: 'create-dependency',
      id: 'dep-1',
      revisionId: 'rev-4',
      occurredAt: secondMoment,
      fromTaskId: 'task-1',
      toTaskId: 'task-1',
    })
    expect(selfDep).toEqual({
      ok: false,
      error: { code: 'invalid-command', message: 'A task cannot depend on itself.' },
    })

    // Valid dependency: Task 2 depends on Task 1
    const dep1 = executeCommand(t2.value.document, {
      type: 'create-dependency',
      id: 'dep-1',
      revisionId: 'rev-4',
      occurredAt: secondMoment,
      fromTaskId: 'task-1',
      toTaskId: 'task-2',
    })
    expect(dep1).toMatchObject({
      ok: true,
      value: {
        document: {
          dependencies: [{ id: 'dep-1', fromTaskId: 'task-1', toTaskId: 'task-2' }],
        },
        revision: { number: 4, kind: 'dependency-created' },
      },
    })
    if (!dep1.ok) throw new Error()

    // Cycle: Task 1 depends on Task 2 (would create cycle Task 1 -> Task 2 -> Task 1)
    const cycleDep = executeCommand(dep1.value.document, {
      type: 'create-dependency',
      id: 'dep-2',
      revisionId: 'rev-5',
      occurredAt: secondMoment,
      fromTaskId: 'task-2',
      toTaskId: 'task-1',
    })
    expect(cycleDep).toEqual({
      ok: false,
      error: {
        code: 'invalid-command',
        message: 'Adding this dependency would create a circular dependency.',
      },
    })

    // Delete dependency
    const delDep = executeCommand(dep1.value.document, {
      type: 'delete-dependency',
      id: 'dep-1',
      revisionId: 'rev-5',
      occurredAt: secondMoment,
      dependencyId: 'dep-1',
    })
    expect(delDep).toMatchObject({
      ok: true,
      value: {
        document: {
          dependencies: [],
        },
        revision: { number: 5, kind: 'dependency-deleted' },
      },
    })
  })

  it('applies reference plans and performs exact undo', () => {
    const empty = createEmptyPlannerDocument()
    const p1 = executeCommand(empty, {
      type: 'create-project',
      id: 'proj-1',
      revisionId: 'rev-1',
      occurredAt: firstMoment,
      title: 'Project 1',
    })
    const t1 = executeCommand(p1.ok ? p1.value.document : empty, {
      type: 'create-task',
      id: 'task-1',
      revisionId: 'rev-2',
      occurredAt: firstMoment,
      projectId: 'proj-1',
      title: 'Task 1',
    })
    if (!t1.ok) throw new Error()

    const initialSessions = t1.value.document.taskSessions

    // Apply plan
    const plannedSessions = [
      {
        id: 'session-plan-1',
        taskId: 'task-1',
        startAt: '2026-09-01T09:00:00.000Z',
        endAt: '2026-09-01T10:00:00.000Z',
        createdAt: secondMoment,
        updatedAt: secondMoment,
      },
    ]
    const planApplied = executeCommand(t1.value.document, {
      type: 'apply-plan',
      id: 'plan-cmd-1',
      revisionId: 'rev-3',
      occurredAt: secondMoment,
      sessions: plannedSessions,
    })
    expect(planApplied).toMatchObject({
      ok: true,
      value: {
        document: {
          taskSessions: plannedSessions,
        },
        revision: { number: 3, kind: 'schedule-planned' },
      },
    })
    if (!planApplied.ok) throw new Error()

    // Exact undo
    const undone = executeCommand(planApplied.value.document, {
      type: 'undo-last-plan',
      id: 'undo-cmd-1',
      revisionId: 'rev-4',
      occurredAt: secondMoment,
    })
    expect(undone).toMatchObject({
      ok: true,
      value: {
        document: {
          taskSessions: initialSessions,
        },
        revision: { number: 4, kind: 'plan-undone' },
      },
    })
  })

  it('updates planning policy and toggles session lock state', () => {
    const empty = createEmptyPlannerDocument()
    const p1 = executeCommand(empty, {
      type: 'create-project',
      id: 'proj-1',
      revisionId: 'rev-1',
      occurredAt: firstMoment,
      title: 'Project 1',
    })
    const t1 = executeCommand(p1.ok ? p1.value.document : empty, {
      type: 'create-task',
      id: 'task-1',
      revisionId: 'rev-2',
      occurredAt: firstMoment,
      projectId: 'proj-1',
      title: 'Task 1',
    })
    const s1 = executeCommand(t1.ok ? t1.value.document : empty, {
      type: 'create-task-session',
      id: 'session-1',
      revisionId: 'rev-3',
      occurredAt: firstMoment,
      taskId: 'task-1',
      startAt: '2026-09-01T09:00:00.000Z',
      endAt: '2026-09-01T10:00:00.000Z',
    })
    if (!s1.ok) throw new Error()

    // Toggle lock state
    const lockToggled = executeCommand(s1.value.document, {
      type: 'toggle-task-session-lock',
      id: 'session-1',
      revisionId: 'rev-4',
      occurredAt: secondMoment,
      sessionId: 'session-1',
    })
    expect(lockToggled).toMatchObject({
      ok: true,
      value: {
        document: {
          taskSessions: [{ id: 'session-1', locked: false }],
        },
        revision: { number: 4, kind: 'task-session-lock-toggled' },
      },
    })

    // Update policy
    const policyUpdated = executeCommand(s1.value.document, {
      type: 'update-policy',
      id: 'pol-1',
      revisionId: 'rev-5',
      occurredAt: secondMoment,
      policy: {
        preset: 'focus',
        maxDailyWorkMinutes: 240,
        preferredTime: 'morning',
      },
    })
    expect(policyUpdated).toMatchObject({
      ok: true,
      value: {
        document: {
          policy: {
            preset: 'focus',
            maxDailyWorkMinutes: 240,
            preferredTime: 'morning',
          },
        },
        revision: { number: 4, kind: 'policy-updated' },
      },
    })
  })

  it('updates task priority, deadlineType, labels, and description with validation', () => {
    const empty = createEmptyPlannerDocument()
    const p1 = executeCommand(empty, {
      type: 'create-project',
      id: 'proj-1',
      revisionId: 'rev-1',
      occurredAt: firstMoment,
      title: 'Project 1',
    })
    if (!p1.ok) throw new Error()

    const t1 = executeCommand(p1.value.document, {
      type: 'create-task',
      id: 'task-1',
      revisionId: 'rev-2',
      occurredAt: firstMoment,
      projectId: 'proj-1',
      title: 'Main Task',
    })
    if (!t1.ok) throw new Error()

    // Valid metadata update
    const updated = executeCommand(t1.value.document, {
      type: 'update-task-constraints',
      id: 'task-1',
      revisionId: 'rev-3',
      occurredAt: secondMoment,
      taskId: 'task-1',
      priority: 'ASAP',
      deadlineType: 'HARD',
      description: 'Critical launch blocker',
      labels: ['release', 'frontend'],
      dueAt: '2026-09-02T18:00:00.000Z',
    })

    expect(updated).toMatchObject({
      ok: true,
      value: {
        document: {
          tasks: [
            {
              id: 'task-1',
              priority: 'ASAP',
              deadlineType: 'HARD',
              description: 'Critical launch blocker',
              labels: ['release', 'frontend'],
            },
          ],
        },
      },
    })

    // Invalid priority
    const badPriority = executeCommand(t1.value.document, {
      type: 'update-task-constraints',
      id: 'task-1',
      revisionId: 'rev-4',
      occurredAt: secondMoment,
      taskId: 'task-1',
      priority: 'INVALID' as any,
    })
    expect(badPriority).toEqual({
      ok: false,
      error: { code: 'invalid-command', message: 'Priority must be ASAP, HIGH, MEDIUM, or LOW.' },
    })

    // Invalid deadline type
    const badDeadlineType = executeCommand(t1.value.document, {
      type: 'update-task-constraints',
      id: 'task-1',
      revisionId: 'rev-4',
      occurredAt: secondMoment,
      taskId: 'task-1',
      deadlineType: 'INVALID' as any,
    })
    expect(badDeadlineType).toEqual({
      ok: false,
      error: { code: 'invalid-command', message: 'Deadline type must be HARD, SOFT, or NONE.' },
    })
  })

  it('moves a task and its child subtasks to another project', () => {
    const empty = createEmptyPlannerDocument()
    const p1 = executeCommand(empty, {
      type: 'create-project',
      id: 'proj-1',
      revisionId: 'rev-1',
      occurredAt: firstMoment,
      title: 'Project 1',
    })
    if (!p1.ok) throw new Error()

    const p2 = executeCommand(p1.value.document, {
      type: 'create-project',
      id: 'proj-2',
      revisionId: 'rev-2',
      occurredAt: firstMoment,
      title: 'Project 2',
    })
    if (!p2.ok) throw new Error()

    const t1 = executeCommand(p2.value.document, {
      type: 'create-task',
      id: 'task-1',
      revisionId: 'rev-3',
      occurredAt: firstMoment,
      projectId: 'proj-1',
      title: 'Task in P1',
    })
    if (!t1.ok) throw new Error()

    const sub1 = executeCommand(t1.value.document, {
      type: 'create-subtask',
      id: 'subtask-1',
      revisionId: 'rev-4',
      occurredAt: firstMoment,
      projectId: 'proj-1',
      parentTaskId: 'task-1',
      title: 'Subtask of Task 1',
    })
    if (!sub1.ok) throw new Error()

    // Move task-1 to proj-2
    const moved = executeCommand(sub1.value.document, {
      type: 'move-task',
      id: 'move-1',
      revisionId: 'rev-5',
      occurredAt: secondMoment,
      taskId: 'task-1',
      targetProjectId: 'proj-2',
    })

    expect(moved).toMatchObject({
      ok: true,
      value: {
        document: {
          tasks: [
            { id: 'task-1', projectId: 'proj-2' },
            { id: 'subtask-1', projectId: 'proj-2', parentTaskId: 'task-1' },
          ],
        },
        revision: { number: 5, kind: 'task-moved' },
      },
    })

    // Error on same project
    const sameProj = executeCommand(sub1.value.document, {
      type: 'move-task',
      id: 'move-2',
      revisionId: 'rev-6',
      occurredAt: secondMoment,
      taskId: 'task-1',
      targetProjectId: 'proj-1',
    })
    expect(sameProj).toEqual({
      ok: false,
      error: { code: 'invalid-command', message: 'Task is already in the target project.' },
    })

    // Error on missing target project
    const missingProj = executeCommand(sub1.value.document, {
      type: 'move-task',
      id: 'move-3',
      revisionId: 'rev-6',
      occurredAt: secondMoment,
      taskId: 'task-1',
      targetProjectId: 'ghost-project',
    })
    expect(missingProj).toEqual({
      ok: false,
      error: { code: 'project-not-found', message: 'The target project does not exist.' },
    })
  })
})
