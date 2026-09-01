import type { RecurrenceRule, Task } from './model'

export const calculateRecurrenceDates = (
  rule: RecurrenceRule,
  horizonEnd: Date,
  _referenceDate?: Date,
): string[] => {
  const dates: string[] = []
  const start = new Date(rule.startDate)
  if (Number.isNaN(start.getTime())) return dates

  const maxDate = rule.endDate ? new Date(Math.min(new Date(rule.endDate).getTime(), horizonEnd.getTime())) : horizonEnd
  if (start.getTime() > maxDate.getTime()) return dates

  const interval = Math.max(1, rule.interval ?? 1)
  const maxInstances = 100 // Protection against runaway loops

  const current = new Date(start)

  switch (rule.frequency) {
    case 'DAILY': {
      while (current.getTime() <= maxDate.getTime() && dates.length < maxInstances) {
        dates.push(current.toISOString().slice(0, 10))
        current.setUTCDate(current.getUTCDate() + interval)
      }
      break
    }
    case 'WEEKLY':
    case 'BIWEEKLY': {
      const stepWeeks = rule.frequency === 'BIWEEKLY' ? 2 : interval
      const targetDays = rule.daysOfWeek && rule.daysOfWeek.length > 0
        ? rule.daysOfWeek
        : [start.getUTCDay() === 0 ? 7 : start.getUTCDay()] // 1 (Mon) - 7 (Sun)

      // Start from beginning of the start week (Monday)
      const weekStart = new Date(start)
      const day = weekStart.getUTCDay() === 0 ? 7 : weekStart.getUTCDay()
      weekStart.setUTCDate(weekStart.getUTCDate() - (day - 1))

      while (weekStart.getTime() <= maxDate.getTime() && dates.length < maxInstances) {
        for (const targetDay of targetDays) {
          const instance = new Date(weekStart)
          instance.setUTCDate(weekStart.getUTCDate() + (targetDay - 1))

          if (instance.getTime() >= start.getTime() && instance.getTime() <= maxDate.getTime()) {
            const dateStr = instance.toISOString().slice(0, 10)
            if (!dates.includes(dateStr)) {
              dates.push(dateStr)
            }
          }
        }
        weekStart.setUTCDate(weekStart.getUTCDate() + stepWeeks * 7)
      }
      break
    }
    case 'MONTHLY': {
      const dayOfMonth = start.getUTCDate()
      while (current.getTime() <= maxDate.getTime() && dates.length < maxInstances) {
        dates.push(current.toISOString().slice(0, 10))
        current.setUTCMonth(current.getUTCMonth() + interval, dayOfMonth)
      }
      break
    }
  }

  return dates.sort()
}

export const generateTasksFromRecurrenceRule = (
  rule: RecurrenceRule,
  existingTasks: Task[],
  horizonEnd: Date,
  createId: () => string,
  now: Date = new Date(),
): Task[] => {
  const dates = calculateRecurrenceDates(rule, horizonEnd, now)
  const existingInstanceDates = new Set(
    existingTasks
      .filter((t) => t.recurrenceRuleId === rule.id && t.recurrenceInstanceDate)
      .map((t) => t.recurrenceInstanceDate!),
  )

  const newTasks: Task[] = []
  for (const dateStr of dates) {
    if (!existingInstanceDates.has(dateStr)) {
      newTasks.push({
        id: createId(),
        projectId: rule.projectId,
        title: rule.title,
        description: rule.description,
        completed: false,
        estimateMinutes: rule.estimateMinutes,
        priority: rule.priority ?? 'MEDIUM',
        deadlineType: rule.deadlineType ?? 'SOFT',
        labels: rule.labels ? [...rule.labels] : [],
        scheduleId: rule.scheduleId,
        dueAt: `${dateStr}T17:00:00.000Z`,
        recurrenceRuleId: rule.id,
        recurrenceInstanceDate: dateStr,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      })
    }
  }

  return newTasks
}
