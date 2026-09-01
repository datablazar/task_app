import type { Dependency, Task } from './model'

export const hasDependencyCycle = (
  dependencies: Dependency[],
  newEdge?: { fromTaskId: string; toTaskId: string },
): boolean => {
  if (newEdge && newEdge.fromTaskId === newEdge.toTaskId) {
    return true
  }

  const adj = new Map<string, string[]>()
  const allNodes = new Set<string>()

  const addEdge = (from: string, to: string) => {
    allNodes.add(from)
    allNodes.add(to)
    const list = adj.get(from) ?? []
    list.push(to)
    adj.set(from, list)
  }

  for (const dep of dependencies) {
    addEdge(dep.fromTaskId, dep.toTaskId)
  }

  if (newEdge) {
    addEdge(newEdge.fromTaskId, newEdge.toTaskId)
  }

  // 0 = unvisited, 1 = visiting, 2 = visited
  const state = new Map<string, number>()

  const dfs = (node: string): boolean => {
    state.set(node, 1)
    const neighbors = adj.get(node) ?? []
    for (const neighbor of neighbors) {
      const neighborState = state.get(neighbor) ?? 0
      if (neighborState === 1) {
        return true // Cycle detected
      }
      if (neighborState === 0 && dfs(neighbor)) {
        return true
      }
    }
    state.set(node, 2)
    return false
  }

  for (const node of allNodes) {
    if ((state.get(node) ?? 0) === 0) {
      if (dfs(node)) {
        return true
      }
    }
  }

  return false
}

export const getTopologicalOrder = (
  tasks: Task[],
  dependencies: Dependency[],
): { sortedTasks: Task[]; hasCycle: boolean } => {
  const inDegree = new Map<string, number>()
  const adj = new Map<string, string[]>()
  const taskMap = new Map(tasks.map((t) => [t.id, t]))

  for (const task of tasks) {
    inDegree.set(task.id, 0)
    adj.set(task.id, [])
  }

  for (const dep of dependencies) {
    if (taskMap.has(dep.fromTaskId) && taskMap.has(dep.toTaskId)) {
      const currentIn = inDegree.get(dep.toTaskId) ?? 0
      inDegree.set(dep.toTaskId, currentIn + 1)
      const outgoing = adj.get(dep.fromTaskId) ?? []
      outgoing.push(dep.toTaskId)
      adj.set(dep.fromTaskId, outgoing)
    }
  }

  const queue: string[] = []
  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) {
      queue.push(id)
    }
  }

  const sortedTasks: Task[] = []
  while (queue.length > 0) {
    const currentId = queue.shift()!
    const task = taskMap.get(currentId)
    if (task) {
      sortedTasks.push(task)
    }
    const neighbors = adj.get(currentId) ?? []
    for (const neighbor of neighbors) {
      const nextDeg = (inDegree.get(neighbor) ?? 1) - 1
      inDegree.set(neighbor, nextDeg)
      if (nextDeg === 0) {
        queue.push(neighbor)
      }
    }
  }

  return {
    sortedTasks,
    hasCycle: sortedTasks.length < tasks.length,
  }
}
