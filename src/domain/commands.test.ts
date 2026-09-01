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
})
