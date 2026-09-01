import { describe, expect, it } from "vitest"
import { executeCommand } from "./commands"
import { createEmptyPlannerDocument } from "./model"
import type { AvailabilityWindow, PlannerDocument } from "./model"

describe("schedules and availability management", () => {
  it("creates, updates, and deletes custom named schedules cleanly via command boundary", () => {
    let doc: PlannerDocument = createEmptyPlannerDocument("UTC")
    expect(doc.schedules?.length).toBe(1)
    expect(doc.schedules?.[0].name).toBe("Work")

    const customWindows: AvailabilityWindow[] = [
      { dayOfWeek: 1, startHour: 18, endHour: 22 },
      { dayOfWeek: 3, startHour: 18, endHour: 22 },
    ]

    // Create Evening Study schedule
    const r1 = executeCommand(doc, {
      type: "create-schedule",
      id: "sched-study",
      revisionId: "rev-1",
      occurredAt: "2026-09-01T00:00:00.000Z",
      name: "Evening Study",
      workingWindows: customWindows,
      color: "#8b5cf6",
    })
    expect(r1.ok).toBe(true)
    if (!r1.ok) return
    doc = r1.value.document

    expect(doc.schedules?.length).toBe(2)
    const studySched = doc.schedules?.find((s) => s.id === "sched-study")
    expect(studySched?.name).toBe("Evening Study")
    expect(studySched?.color).toBe("#8b5cf6")
    expect(studySched?.availability.workingWindows.length).toBe(2)

    // Update schedule
    const r2 = executeCommand(doc, {
      type: "update-schedule",
      id: "sched-study",
      revisionId: "rev-2",
      occurredAt: "2026-09-01T00:05:00.000Z",
      scheduleId: "sched-study",
      name: "Night Owls",
    })
    expect(r2.ok).toBe(true)
    if (!r2.ok) return
    doc = r2.value.document
    expect(doc.schedules?.find((s) => s.id === "sched-study")?.name).toBe("Night Owls")

    // Delete schedule
    const r3 = executeCommand(doc, {
      type: "delete-schedule",
      id: "sched-study",
      revisionId: "rev-3",
      occurredAt: "2026-09-01T00:10:00.000Z",
      scheduleId: "sched-study",
    })
    expect(r3.ok).toBe(true)
    if (!r3.ok) return
    doc = r3.value.document
    expect(doc.schedules?.find((s) => s.id === "sched-study")).toBeUndefined()
  })
})
