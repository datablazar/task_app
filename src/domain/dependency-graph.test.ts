import { describe, expect, it } from 'vitest'
import { getTopologicalOrder, hasDependencyCycle } from './dependency-graph'
import type { Dependency, Task } from './model'

describe('dependency-graph', () => {
  it('detects direct self-loops and circular relationships', () => {
    // Self-loop
    expect(hasDependencyCycle([], { fromTaskId: 'task-1', toTaskId: 'task-1' })).toBe(true)

    // Direct cycle A -> B -> A
    const depAB: Dependency = {
      id: 'dep-1',
      fromTaskId: 'task-A',
      toTaskId: 'task-B',
      createdAt: '2026-09-01T09:00:00.000Z',
    }
    expect(hasDependencyCycle([depAB], { fromTaskId: 'task-B', toTaskId: 'task-A' })).toBe(true)

    // Multi-node cycle A -> B -> C -> A
    const depBC: Dependency = {
      id: 'dep-2',
      fromTaskId: 'task-B',
      toTaskId: 'task-C',
      createdAt: '2026-09-01T09:00:00.000Z',
    }
    expect(
      hasDependencyCycle([depAB, depBC], { fromTaskId: 'task-C', toTaskId: 'task-A' }),
    ).toBe(true)

    // Non-cycle valid DAG: A -> B, A -> C, B -> D, C -> D
    const depAC: Dependency = {
      id: 'dep-3',
      fromTaskId: 'task-A',
      toTaskId: 'task-C',
      createdAt: '2026-09-01T09:00:00.000Z',
    }
    const depBD: Dependency = {
      id: 'dep-4',
      fromTaskId: 'task-B',
      toTaskId: 'task-D',
      createdAt: '2026-09-01T09:00:00.000Z',
    }
    expect(
      hasDependencyCycle([depAB, depAC, depBD], { fromTaskId: 'task-C', toTaskId: 'task-D' }),
    ).toBe(false)
  })

  it('orders tasks topologically and detects cycles in task sets', () => {
    const tasks: Task[] = [
      {
        id: 'task-C',
        projectId: 'p1',
        title: 'Review',
        completed: false,
        createdAt: '2026-09-01T09:00:00.000Z',
        updatedAt: '2026-09-01T09:00:00.000Z',
      },
      {
        id: 'task-A',
        projectId: 'p1',
        title: 'Draft',
        completed: false,
        createdAt: '2026-09-01T09:00:00.000Z',
        updatedAt: '2026-09-01T09:00:00.000Z',
      },
      {
        id: 'task-B',
        projectId: 'p1',
        title: 'Edit',
        completed: false,
        createdAt: '2026-09-01T09:00:00.000Z',
        updatedAt: '2026-09-01T09:00:00.000Z',
      },
    ]

    // A -> B -> C
    const dependencies: Dependency[] = [
      {
        id: 'dep-1',
        fromTaskId: 'task-A',
        toTaskId: 'task-B',
        createdAt: '2026-09-01T09:00:00.000Z',
      },
      {
        id: 'dep-2',
        fromTaskId: 'task-B',
        toTaskId: 'task-C',
        createdAt: '2026-09-01T09:00:00.000Z',
      },
    ]

    const result = getTopologicalOrder(tasks, dependencies)
    expect(result.hasCycle).toBe(false)
    expect(result.sortedTasks.map((t) => t.id)).toEqual(['task-A', 'task-B', 'task-C'])
  })
})
