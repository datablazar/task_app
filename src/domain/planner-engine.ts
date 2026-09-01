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
  dayKey: string // YYYY-MM-DD
  startAt: string
  endAt: string
  durationMinutes: number
  isMorning: boolean
}

export const generateReferencePlan = (
  document: PlannerDocument,
  options: PlanOptions,
): PlanOutput => {
  const reasons: string[] = []
  const risks: PlanRisk[] = []
  const unscheduledTasks: { taskId: string; remainingMinutes: number }[] = []

  // 1. Cycle safety check
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
      sessions: document.taskSessions.filter((s) => s.locked),
      unscheduledTasks: [],
      risks: [],
      reasons: ['All tasks are complete. No new sessions needed.'],
    }
  }

  // 2. Preserve locked sessions and calculate existing planned time per task
  const lockedSessions = document.taskSessions.filter((s) => s.locked)
  const lockedMinutesByTask = new Map<string, number>()
  const taskCompletionTime = new Map<string, string>()

  for (const session of lockedSessions) {
    const duration = Math.round(
      (Date.parse(session.endAt) - Date.parse(session.startAt)) / (60 * 1000),
    )
    lockedMinutesByTask.set(
      session.taskId,
      (lockedMinutesByTask.get(session.taskId) ?? 0) + duration,
    )
    const currentLatest = taskCompletionTime.get(session.taskId)
    if (!currentLatest || Date.parse(session.endAt) > Date.parse(currentLatest)) {
      taskCompletionTime.set(session.taskId, session.endAt)
    }
  }

  // 3. Topological sorting
  const { sortedTasks } = getTopologicalOrder(uncompletedTasks, document.dependencies)

  // 4. Task Prioritization:
  // - Due date urgency
  // - Criticality (number of downstream dependents)
  // - Creation order (FIFO determinism)
  const dependentCountMap = new Map<string, number>()
  for (const dep of document.dependencies) {
    dependentCountMap.set(dep.fromTaskId, (dependentCountMap.get(dep.fromTaskId) ?? 0) + 1)
  }

  const prioritizedTasks = [...sortedTasks].sort((a, b) => {
    if (isPrerequisite(b.id, a.id, document.dependencies)) return 1
    if (isPrerequisite(a.id, b.id, document.dependencies)) return -1

    if (a.dueAt && b.dueAt) {
      const diff = Date.parse(a.dueAt) - Date.parse(b.dueAt)
      if (diff !== 0) return diff
    } else if (a.dueAt && !b.dueAt) {
      return -1
    } else if (!a.dueAt && b.dueAt) {
      return 1
    }

    const depA = dependentCountMap.get(a.id) ?? 0
    const depB = dependentCountMap.get(b.id) ?? 0
    if (depA !== depB) {
      return depB - depA
    }

    return a.createdAt.localeCompare(b.createdAt)
  })

  // 5. Generate available working slots (excluding fixed events & locked sessions)
  const horizonDays = options.horizonDays ?? 7
  const availableSlots = generateAvailableSlots(
    document,
    options.now,
    horizonDays,
    lockedSessions,
  )

  const plannedSessions: TaskSession[] = [...lockedSessions]
  let sessionCounter = lockedSessions.length

  const policy = document.policy
  const maxDailyMinutes = policy.maxDailyWorkMinutes ?? 360
  const dailyWorkloadMinutes = new Map<string, number>()

  // Initialize daily workload from locked sessions
  for (const s of lockedSessions) {
    const dayKey = s.startAt.slice(0, 10)
    const dur = Math.round((Date.parse(s.endAt) - Date.parse(s.startAt)) / (60 * 1000))
    dailyWorkloadMinutes.set(dayKey, (dailyWorkloadMinutes.get(dayKey) ?? 0) + dur)
  }

  // 6. Allocate tasks into slots based on policy preset
  for (const task of prioritizedTasks) {
    const totalEstimate = task.estimateMinutes ?? 60
    const alreadyAllocated = lockedMinutesByTask.get(task.id) ?? 0
    let remainingMinutes = Math.max(0, totalEstimate - alreadyAllocated)

    if (remainingMinutes === 0) {
      reasons.push(`Task “${task.title}” is fully satisfied by locked sessions.`)
      continue
    }

    let minStartMs = Date.parse(options.now)
    if (task.earliestStartAt) {
      minStartMs = Math.max(minStartMs, Date.parse(task.earliestStartAt))
    }

    const prerequisites = document.dependencies
      .filter((d) => d.toTaskId === task.id)
      .map((d) => d.fromTaskId)

    for (const prereqId of prerequisites) {
      const prereqFinish = taskCompletionTime.get(prereqId)
      if (prereqFinish) {
        minStartMs = Math.max(minStartMs, Date.parse(prereqFinish))
      }
    }

    let lastSessionEnd: string | null = taskCompletionTime.get(task.id) ?? null
    let sessionsAllocatedCount = 0

    // Two-pass allocation for balanced policy:
    // Pass 1: Allocate up to daily cap (maxDailyWorkMinutes).
    // Pass 2 (fallback): If remaining work exists, spill over without capping to avoid missing deadlines or work.
    const maxPasses = policy.preset === 'balanced' ? 2 : 1

    for (let pass = 1; pass <= maxPasses && remainingMinutes > 0; pass++) {
      for (let i = 0; i < availableSlots.length && remainingMinutes > 0; i++) {
        const slot = availableSlots[i]
        const slotStartMs = Date.parse(slot.startAt)

        if (slotStartMs < minStartMs) {
          continue
        }

        const currentDayWorkload = dailyWorkloadMinutes.get(slot.dayKey) ?? 0
        if (pass === 1 && policy.preset === 'balanced' && currentDayWorkload >= maxDailyMinutes) {
          // Skip slot on full day during pass 1 to balance load across other days
          continue
        }

        // Calculate allocation duration
        let availableInDay = slot.durationMinutes
        if (pass === 1 && policy.preset === 'balanced') {
          const allowanceLeft = Math.max(0, maxDailyMinutes - currentDayWorkload)
          availableInDay = Math.min(availableInDay, allowanceLeft)
          if (availableInDay <= 0) continue
        }

        const allocatedMinutes = Math.min(remainingMinutes, availableInDay)
        const sessionStartAt = slot.startAt
        const sessionEndMs = slotStartMs + allocatedMinutes * 60 * 1000
        const sessionEndAt = new Date(sessionEndMs).toISOString()

        sessionCounter += 1
        plannedSessions.push({
          id: `plan-session-${sessionCounter}`,
          taskId: task.id,
          startAt: sessionStartAt,
          endAt: sessionEndAt,
          locked: false,
          createdAt: options.now,
          updatedAt: options.now,
        })

        sessionsAllocatedCount += 1
        remainingMinutes -= allocatedMinutes
        lastSessionEnd = sessionEndAt

        dailyWorkloadMinutes.set(
          slot.dayKey,
          (dailyWorkloadMinutes.get(slot.dayKey) ?? 0) + allocatedMinutes,
        )

        // Consume slot
        if (allocatedMinutes === slot.durationMinutes) {
          availableSlots.splice(i, 1)
          i--
        } else {
          slot.startAt = sessionEndAt
          slot.durationMinutes -= allocatedMinutes
        }
      }
    }

    if (lastSessionEnd) {
      taskCompletionTime.set(task.id, lastSessionEnd)
    }

    // Diagnostics & Risks
    if (remainingMinutes > 0) {
      unscheduledTasks.push({ taskId: task.id, remainingMinutes })
      risks.push({
        taskId: task.id,
        kind: 'unscheduled-work',
        message: `Task “${task.title}” could not be fully scheduled (${remainingMinutes}m remaining).`,
      })
      reasons.push(
        `Task “${task.title}” has ${remainingMinutes}m unscheduled due to total horizon capacity.`,
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
        reasons.push(
          `Scheduled task “${task.title}” (${sessionsAllocatedCount} session(s)) safely before its deadline under ${policy.preset} policy.`,
        )
      }
    } else {
      reasons.push(
        `Scheduled task “${task.title}” (${sessionsAllocatedCount} session(s)) under ${policy.preset} policy.`,
      )
    }
  }

  // Sort all final sessions chronologically
  plannedSessions.sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt))

  return {
    success: true,
    sessions: plannedSessions,
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
  lockedSessions: TaskSession[],
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

  // Combine fixed events and locked sessions as hard calendar commitments
  const hardCommitments = [
    ...document.fixedEvents.map((e) => ({
      startMs: Date.parse(e.startAt),
      endMs: Date.parse(e.endAt),
    })),
    ...lockedSessions.map((s) => ({
      startMs: Date.parse(s.startAt),
      endMs: Date.parse(s.endAt),
    })),
  ]

  for (let dayOffset = 0; dayOffset < horizonDays; dayOffset++) {
    const currentDay = new Date(startDate)
    currentDay.setUTCDate(startDate.getUTCDate() + dayOffset)
    const dayKey = currentDay.toISOString().slice(0, 10)

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

        if (slotEndMs <= nowMs) {
          continue
        }

        const effectiveStartMs = Math.max(slotStartMs, nowMs)
        const effectiveDuration = Math.round((slotEndMs - effectiveStartMs) / (60 * 1000))

        if (effectiveDuration <= 0) continue

        const overlapsCommitment = hardCommitments.some((commitment) => {
          return effectiveStartMs < commitment.endMs && slotEndMs > commitment.startMs
        })

        if (!overlapsCommitment) {
          slots.push({
            dayKey,
            startAt: new Date(effectiveStartMs).toISOString(),
            endAt: slotEnd.toISOString(),
            durationMinutes: effectiveDuration,
            isMorning: hour < 13,
          })
        }
      }
    }
  }

  // If policy specifies preferredTime, sort slots to prioritize preferred half-day while maintaining chronological order within each day
  if (document.policy.preferredTime && document.policy.preferredTime !== 'any') {
    const preferMorning = document.policy.preferredTime === 'morning'
    slots.sort((a, b) => {
      if (a.dayKey !== b.dayKey) {
        return a.dayKey.localeCompare(b.dayKey)
      }
      if (a.isMorning === preferMorning && b.isMorning !== preferMorning) return -1
      if (a.isMorning !== preferMorning && b.isMorning === preferMorning) return 1
      return Date.parse(a.startAt) - Date.parse(b.startAt)
    })
  }

  return slots
}
