import { getTopologicalOrder, hasDependencyCycle } from './dependency-graph'
import type { Dependency, PlannerDocument, PlanRisk, TaskSession } from './model'

export interface PlanOptions {
  now: string // ISO UTC timestamp
  horizonDays?: number // default 7 days
}

export interface PlanOutput {
  success: boolean
  sessions: TaskSession[]
  unscheduledTasks: { taskId: string; remainingMinutes: number }[]
  risks: PlanRisk[]
  reasons: string[]
}

interface WorkingSlot {
  startAt: string
  endAt: string
  durationMinutes: number
}

export const generateReferencePlan = (
  document: PlannerDocument,
  options: PlanOptions,
): PlanOutput => {
  const reasons: string[] = []
  const risks: PlanRisk[] = []
  const unscheduledTasks: { taskId: string; remainingMinutes: number }[] = []

  // Check for dependency cycles first
  if (hasDependencyCycle(document.dependencies)) {
    return {
      success: false,
      sessions: [],
      unscheduledTasks: [],
      risks: [
        {
          taskId: '',
          kind: 'unscheduled-work',
          message: 'Planning halted: Circular dependencies detected in the task graph.',
        },
      ],
      reasons: ['Cannot allocate time because tasks have circular dependencies.'],
    }
  }

  const uncompletedTasks = document.tasks.filter((task) => !task.completed)
  if (uncompletedTasks.length === 0) {
    return {
      success: true,
      sessions: [],
      unscheduledTasks: [],
      risks: [],
      reasons: ['All tasks are complete. No sessions needed.'],
    }
  }

  // Topological sorting
  const { sortedTasks } = getTopologicalOrder(uncompletedTasks, document.dependencies)

  // Prioritize tasks within topological levels:
  // 1. Earlier deadlines first
  // 2. More downstream dependents first
  // 3. Earlier creation time first
  const dependentCountMap = new Map<string, number>()
  for (const dep of document.dependencies) {
    dependentCountMap.set(dep.fromTaskId, (dependentCountMap.get(dep.fromTaskId) ?? 0) + 1)
  }

  const prioritizedTasks = [...sortedTasks].sort((a, b) => {
    // If a depends on b, b must come first
    if (isPrerequisite(b.id, a.id, document.dependencies)) return 1
    if (isPrerequisite(a.id, b.id, document.dependencies)) return -1

    // Deadlines
    if (a.dueAt && b.dueAt) {
      const diff = Date.parse(a.dueAt) - Date.parse(b.dueAt)
      if (diff !== 0) return diff
    } else if (a.dueAt && !b.dueAt) {
      return -1
    } else if (!a.dueAt && b.dueAt) {
      return 1
    }

    // Criticality (number of dependents)
    const depA = dependentCountMap.get(a.id) ?? 0
    const depB = dependentCountMap.get(b.id) ?? 0
    if (depA !== depB) {
      return depB - depA
    }

    // Creation order
    return a.createdAt.localeCompare(b.createdAt)
  })

  // Generate working time slots across horizon
  const horizonDays = options.horizonDays ?? 7
  const availableSlots = generateAvailableSlots(
    document,
    options.now,
    horizonDays,
  )

  const sessions: TaskSession[] = []
  const taskCompletionTime = new Map<string, string>()
  let sessionCounter = 0

  for (const task of prioritizedTasks) {
    const totalDuration = task.estimateMinutes ?? 60
    let remainingMinutes = totalDuration

    // Compute earliest possible start instant based on now, task constraint, and prerequisites
    let minStartMs = Date.parse(options.now)
    if (task.earliestStartAt) {
      minStartMs = Math.max(minStartMs, Date.parse(task.earliestStartAt))
    }

    // Must start after all prerequisite tasks finish
    const prerequisites = document.dependencies
      .filter((d) => d.toTaskId === task.id)
      .map((d) => d.fromTaskId)

    for (const prereqId of prerequisites) {
      const prereqFinish = taskCompletionTime.get(prereqId)
      if (prereqFinish) {
        minStartMs = Math.max(minStartMs, Date.parse(prereqFinish))
      }
    }

    let lastSessionEnd: string | null = null

    // Allocate available slots
    for (let i = 0; i < availableSlots.length && remainingMinutes > 0; i++) {
      const slot = availableSlots[i]
      const slotStartMs = Date.parse(slot.startAt)

      if (slotStartMs < minStartMs) {
        continue
      }

      const allocatedMinutes = Math.min(remainingMinutes, slot.durationMinutes)
      const sessionStartAt = slot.startAt
      const sessionEndMs = slotStartMs + allocatedMinutes * 60 * 1000
      const sessionEndAt = new Date(sessionEndMs).toISOString()

      sessionCounter += 1
      sessions.push({
        id: `plan-session-${sessionCounter}`,
        taskId: task.id,
        startAt: sessionStartAt,
        endAt: sessionEndAt,
        createdAt: options.now,
        updatedAt: options.now,
      })

      remainingMinutes -= allocatedMinutes
      lastSessionEnd = sessionEndAt

      // Update or remove slot
      if (allocatedMinutes === slot.durationMinutes) {
        availableSlots.splice(i, 1)
        i--
      } else {
        slot.startAt = sessionEndAt
        slot.durationMinutes -= allocatedMinutes
      }
    }

    if (lastSessionEnd) {
      taskCompletionTime.set(task.id, lastSessionEnd)
    }

    if (remainingMinutes > 0) {
      unscheduledTasks.push({ taskId: task.id, remainingMinutes })
      risks.push({
        taskId: task.id,
        kind: 'unscheduled-work',
        message: `Task “${task.title}” could not be fully scheduled (${remainingMinutes}m remaining).`,
      })
      reasons.push(
        `Task “${task.title}” has ${remainingMinutes}m unscheduled due to working capacity limits.`,
      )
    } else if (lastSessionEnd && task.dueAt) {
      if (Date.parse(lastSessionEnd) > Date.parse(task.dueAt)) {
        const deficitMs = Date.parse(lastSessionEnd) - Date.parse(task.dueAt)
        const deficitMinutes = Math.ceil(deficitMs / (60 * 1000))
        risks.push({
          taskId: task.id,
          kind: 'deadline-missed',
          message: `Task “${task.title}” misses its deadline by ${deficitMinutes}m.`,
          dueAt: task.dueAt,
          deficitMinutes,
        })
        reasons.push(
          `Task “${task.title}” scheduled to complete after its deadline (${task.dueAt}).`,
        )
      } else {
        reasons.push(`Scheduled task “${task.title}” safely before its deadline.`)
      }
    } else {
      reasons.push(`Allocated session(s) for task “${task.title}”.`)
    }
  }

  return {
    success: true,
    sessions,
    unscheduledTasks,
    risks,
    reasons,
  }
}

const isPrerequisite = (
  candidatePrereqId: string,
  targetId: string,
  dependencies: Dependency[],
): boolean => {
  const visited = new Set<string>()
  const queue = [targetId]

  while (queue.length > 0) {
    const current = queue.shift()!
    if (current === candidatePrereqId) return true
    if (!visited.has(current)) {
      visited.add(current)
      const directPrereqs = dependencies
        .filter((d) => d.toTaskId === current)
        .map((d) => d.fromTaskId)
      queue.push(...directPrereqs)
    }
  }

  return false
}

const generateAvailableSlots = (
  document: PlannerDocument,
  nowIso: string,
  horizonDays: number,
): WorkingSlot[] => {
  const slots: WorkingSlot[] = []
  const startDate = new Date(nowIso)
  startDate.setUTCHours(0, 0, 0, 0)
  const nowMs = Date.parse(nowIso)

  const workingWindowsByDay = new Map<number, { startHour: number; endHour: number }[]>()
  for (const win of document.availability.workingWindows) {
    const list = workingWindowsByDay.get(win.dayOfWeek) ?? []
    list.push({ startHour: win.startHour, endHour: win.endHour })
    workingWindowsByDay.set(win.dayOfWeek, list)
  }

  for (let dayOffset = 0; dayOffset < horizonDays; dayOffset++) {
    const currentDay = new Date(startDate)
    currentDay.setUTCDate(startDate.getUTCDate() + dayOffset)

    // JS getUTCDay: 0=Sun, 1=Mon, ..., 6=Sat -> convert to 1=Mon..7=Sun
    const jsDay = currentDay.getUTCDay()
    const isoDayOfWeek = jsDay === 0 ? 7 : jsDay

    const windows = workingWindowsByDay.get(isoDayOfWeek) ?? []
    for (const win of windows) {
      for (let hour = win.startHour; hour < win.endHour; hour++) {
        const slotStart = new Date(Date.UTC(
          currentDay.getUTCFullYear(),
          currentDay.getUTCMonth(),
          currentDay.getUTCDate(),
          hour,
          0,
          0,
        ))
        const slotEnd = new Date(Date.UTC(
          currentDay.getUTCFullYear(),
          currentDay.getUTCMonth(),
          currentDay.getUTCDate(),
          hour + 1,
          0,
          0,
        ))

        const slotStartMs = slotStart.getTime()
        const slotEndMs = slotEnd.getTime()

        // Skip past slots
        if (slotEndMs <= nowMs) {
          continue
        }

        // Adjust slot if now is in the middle of it
        const effectiveStartMs = Math.max(slotStartMs, nowMs)
        const effectiveDuration = Math.round((slotEndMs - effectiveStartMs) / (60 * 1000))

        if (effectiveDuration <= 0) continue

        const effectiveStart = new Date(effectiveStartMs).toISOString()
        const effectiveEnd = slotEnd.toISOString()

        // Check collision with fixed events
        const overlapsFixed = document.fixedEvents.some((event) => {
          const evStart = Date.parse(event.startAt)
          const evEnd = Date.parse(event.endAt)
          return effectiveStartMs < evEnd && slotEndMs > evStart
        })

        if (!overlapsFixed) {
          slots.push({
            startAt: effectiveStart,
            endAt: effectiveEnd,
            durationMinutes: effectiveDuration,
          })
        }
      }
    }
  }

  return slots
}
