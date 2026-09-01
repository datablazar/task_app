import { describe, expect, it } from "vitest"
import { generateReferencePlan } from "./planner-engine"
import { createEmptyPlannerDocument } from "./model"
import type { PlannerDocument } from "./model"

describe("planner-engine priority and deadline strictness", () => {
  it("prioritizes ASAP tasks over HIGH and MEDIUM tasks when allocating schedule slots", () => {
    const doc: PlannerDocument = {
      ...createEmptyPlannerDocument("UTC"),
      projects: [{ id: "p1", title: "Project 1", createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z" }],
      tasks: [
        {
          id: "task-low",
          projectId: "p1",
          title: "Low priority task",
          completed: false,
          priority: "low",
          estimateMinutes: 60,
          createdAt: "2026-09-01T00:00:00.000Z",
          updatedAt: "2026-09-01T00:00:00.000Z",
        },
        {
          id: "task-asap",
          projectId: "p1",
          title: "ASAP task",
          completed: false,
          priority: "asap",
          estimateMinutes: 60,
          createdAt: "2026-09-01T01:00:00.000Z",
          updatedAt: "2026-09-01T01:00:00.000Z",
        },
        {
          id: "task-high",
          projectId: "p1",
          title: "High priority task",
          completed: false,
          priority: "high",
          estimateMinutes: 60,
          createdAt: "2026-09-01T02:00:00.000Z",
          updatedAt: "2026-09-01T02:00:00.000Z",
        },
      ],
    }

    const plan = generateReferencePlan(doc, { now: "2026-09-01T08:00:00.000Z" })
    expect(plan.success).toBe(true)
    expect(plan.sessions.length).toBe(3)

    // First scheduled session must be the ASAP task
    expect(plan.sessions[0].taskId).toBe("task-asap")
    // Second scheduled session must be the HIGH priority task
    expect(plan.sessions[1].taskId).toBe("task-high")
    // Third scheduled session must be the LOW priority task
    expect(plan.sessions[2].taskId).toBe("task-low")
  })

  it("prioritizes hard deadline urgency before soft target tasks of equal priority", () => {
    const doc: PlannerDocument = {
      ...createEmptyPlannerDocument("UTC"),
      projects: [{ id: "p1", title: "Project 1", createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z" }],
      tasks: [
        {
          id: "task-soft",
          projectId: "p1",
          title: "Soft target task",
          completed: false,
          priority: "high",
          deadlineStrictness: "soft",
          dueAt: "2026-09-02T18:00:00.000Z",
          estimateMinutes: 60,
          createdAt: "2026-09-01T00:00:00.000Z",
          updatedAt: "2026-09-01T00:00:00.000Z",
        },
        {
          id: "task-hard",
          projectId: "p1",
          title: "Hard deadline task",
          completed: false,
          priority: "high",
          deadlineStrictness: "hard",
          dueAt: "2026-09-02T18:00:00.000Z",
          estimateMinutes: 60,
          createdAt: "2026-09-01T01:00:00.000Z",
          updatedAt: "2026-09-01T01:00:00.000Z",
        },
      ],
    }

    const plan = generateReferencePlan(doc, { now: "2026-09-01T08:00:00.000Z" })
    expect(plan.success).toBe(true)
    expect(plan.sessions[0].taskId).toBe("task-hard")
    expect(plan.sessions[1].taskId).toBe("task-soft")
  })
})
