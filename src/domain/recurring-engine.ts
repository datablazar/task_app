import type { RecurrenceRule, Task } from "./model"

export interface RecurrenceGenerationResult {
  newInstances: Task[]
}

export const computeNextRecurrenceDate = (
  currentDate: Date,
  rule: RecurrenceRule,
): Date => {
  const next = new Date(currentDate)
  const interval = Math.max(1, rule.interval ?? 1)

  switch (rule.frequency) {
    case "daily":
      next.setUTCDate(next.getUTCDate() + interval)
      break
    case "weekly":
      next.setUTCDate(next.getUTCDate() + 7 * interval)
      break
    case "biweekly":
      next.setUTCDate(next.getUTCDate() + 14 * interval)
      break
    case "monthly":
      next.setUTCMonth(next.getUTCMonth() + interval)
      break
  }

  return next
}

export const generateRecurringTaskInstances = (
  tasks: Task[],
  referenceDate: Date,
  horizonDays = 90,
  createId: () => string = () => Math.random().toString(36).slice(2, 11),
): RecurrenceGenerationResult => {
  const newInstances: Task[] = []

  const recurringParents = tasks.filter(
    (t) => t.recurrence !== undefined && !t.recurringParentId,
  )

  if (recurringParents.length === 0) {
    return { newInstances: [] }
  }

  const existingInstancesByParent = new Map<string, Set<string>>()
  for (const t of tasks) {
    if (t.recurringParentId && t.dueAt) {
      const dateKey = t.dueAt.slice(0, 10)
      const set = existingInstancesByParent.get(t.recurringParentId) ?? new Set<string>()
      set.add(dateKey)
      existingInstancesByParent.set(t.recurringParentId, set)
    }
  }

  const startDate = new Date(referenceDate)
  startDate.setUTCHours(0, 0, 0, 0)

  const endDate = new Date(startDate)
  endDate.setUTCDate(endDate.getUTCDate() + horizonDays)

  for (const parent of recurringParents) {
    const rule = parent.recurrence!
    const existingDates = existingInstancesByParent.get(parent.id) ?? new Set<string>()

    const untilDate = rule.until ? new Date(rule.until) : endDate
    const effectiveEndDate = untilDate < endDate ? untilDate : endDate

    const cursor = new Date(startDate)
    const interval = Math.max(1, rule.interval ?? 1)

    while (cursor <= effectiveEndDate) {
      const dayOfWeek = cursor.getUTCDay() === 0 ? 7 : cursor.getUTCDay() // 1 (Mon) to 7 (Sun)
      let matches = false

      if (rule.frequency === "daily") {
        matches = true
      } else if (rule.frequency === "weekly") {
        if (rule.daysOfWeek && rule.daysOfWeek.length > 0) {
          matches = rule.daysOfWeek.includes(dayOfWeek)
        } else {
          matches = dayOfWeek === (startDate.getUTCDay() === 0 ? 7 : startDate.getUTCDay())
        }
      } else if (rule.frequency === "biweekly") {
        const diffWeeks = Math.floor(
          (cursor.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000),
        )
        if (diffWeeks % 2 === 0) {
          if (rule.daysOfWeek && rule.daysOfWeek.length > 0) {
            matches = rule.daysOfWeek.includes(dayOfWeek)
          } else {
            matches = dayOfWeek === (startDate.getUTCDay() === 0 ? 7 : startDate.getUTCDay())
          }
        }
      } else if (rule.frequency === "monthly") {
        matches = cursor.getUTCDate() === startDate.getUTCDate()
      }

      if (matches) {
        const dateKey = cursor.toISOString().slice(0, 10)
        if (!existingDates.has(dateKey)) {
          const instanceDueAt = `${dateKey}T23:59:59.000Z`
          const instance: Task = {
            id: createId(),
            projectId: parent.projectId,
            title: parent.title,
            completed: false,
            priority: parent.priority,
            deadlineStrictness: parent.deadlineStrictness,
            scheduleId: parent.scheduleId,
            recurringParentId: parent.id,
            estimateMinutes: parent.estimateMinutes,
            dueAt: instanceDueAt,
            notes: parent.notes,
            createdAt: referenceDate.toISOString(),
            updatedAt: referenceDate.toISOString(),
          }
          newInstances.push(instance)
          existingDates.add(dateKey)
        }
      }

      cursor.setUTCDate(cursor.getUTCDate() + (rule.frequency === "daily" ? interval : 1))
    }
  }

  return { newInstances }
}
