import { describe, expect, it } from "vitest"
import { computeNextRecurrenceDate, generateRecurringTaskInstances } from "./recurring-engine"
import type { Task } from "./model"

describe("recurring-engine", () => {
  it("computes next recurrence dates correctly for daily, weekly, biweekly, and monthly cadences", () => {
    const base = new Date("2026-09-01T09:00:00.000Z")

    const daily = computeNextRecurrenceDate(base, { frequency: "daily", interval: 1 })
    expect(daily.toISOString()).toBe("2026-09-02T09:00:00.000Z")

    const weekly = computeNextRecurrenceDate(base, { frequency: "weekly", interval: 1 })
    expect(weekly.toISOString()).toBe("2026-09-08T09:00:00.000Z")

    const biweekly = computeNextRecurrenceDate(base, { frequency: "biweekly", interval: 1 })
    expect(biweekly.toISOString()).toBe("2026-09-15T09:00:00.000Z")

    const monthly = computeNextRecurrenceDate(base, { frequency: "monthly", interval: 1 })
    expect(monthly.toISOString()).toBe("2026-10-01T09:00:00.000Z")
  })

  it("generates 90-day future instances without creating duplicate instances", () => {
    const baseDate = new Date("2026-09-01T09:00:00.000Z")
    let idCounter = 100
    const createId = () => `inst-${idCounter++}`

    const parentTask: Task = {
      id: "task-rec-1",
      projectId: "proj-1",
      title: "Weekly Status Review",
      completed: false,
      estimateMinutes: 30,
      dueAt: "2026-09-01T17:00:00.000Z",
      isRecurringParent: true,
      recurrence: {
        frequency: "weekly",
        interval: 1,
      },
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
    }

    // First expansion: should generate ~12 weekly instances over 90 days
    const pass1 = generateRecurringTaskInstances([parentTask], baseDate, 90, createId)
    expect(pass1.newInstances.length).toBeGreaterThanOrEqual(12)
    expect(pass1.newInstances.length).toBeLessThanOrEqual(14)
    expect(pass1.newInstances[0].recurringParentId).toBe("task-rec-1")
    expect(pass1.newInstances[0].title).toBe("Weekly Status Review")

    // Second expansion with existing instances: should produce 0 duplicates
    const allTasks = [parentTask, ...pass1.newInstances]
    const pass2 = generateRecurringTaskInstances(allTasks, baseDate, 90, createId)
    expect(pass2.newInstances.length).toBe(0)
  })
})
