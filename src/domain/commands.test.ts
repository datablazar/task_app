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
})
