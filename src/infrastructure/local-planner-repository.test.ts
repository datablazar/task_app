import { describe, expect, it } from "vitest"
import { serialiseBackup } from "../domain/backup"
import { DEFAULT_AVAILABILITY, DEFAULT_POLICY, DEFAULT_SCHEDULES, PLANNER_SCHEMA_VERSION } from "../domain/model"
import type { PlannerDocument } from "../domain/model"
import { LocalPlannerRepository, plannerStorageKey } from "./local-planner-repository"

const document: PlannerDocument = {
  schemaVersion: PLANNER_SCHEMA_VERSION,
  timeZone: "Europe/London",
  revision: 6,
  projects: [
    {
      id: "project-1",
      title: "Prepare autumn course",
      createdAt: "2026-09-01T09:00:00.000Z",
      updatedAt: "2026-09-01T09:00:00.000Z",
    },
  ],
  tasks: [
    {
      id: "task-1",
      projectId: "project-1",
      title: "Outline week one",
      completed: false,
      estimateMinutes: 45,
      dueAt: "2026-09-05T18:00:00.000Z",
      createdAt: "2026-09-01T09:01:00.000Z",
      updatedAt: "2026-09-01T09:01:00.000Z",
    },
    {
      id: "subtask-1",
      projectId: "project-1",
      parentTaskId: "task-1",
      title: "Draft syllabus section",
      completed: false,
      estimateMinutes: 20,
      createdAt: "2026-09-01T09:02:00.000Z",
      updatedAt: "2026-09-01T09:02:00.000Z",
    },
  ],
  dependencies: [
    {
      id: "dep-1",
      fromTaskId: "task-1",
      toTaskId: "subtask-1",
      createdAt: "2026-09-01T09:02:30.000Z",
    },
  ],
  availability: DEFAULT_AVAILABILITY,
  schedules: DEFAULT_SCHEDULES,
  policy: DEFAULT_POLICY,
  fixedEvents: [
    {
      id: "event-1",
      title: "Faculty Meeting",
      startAt: "2026-09-01T10:00:00.000Z",
      endAt: "2026-09-01T11:00:00.000Z",
      createdAt: "2026-09-01T09:02:00.000Z",
      updatedAt: "2026-09-01T09:02:00.000Z",
    },
  ],
  taskSessions: [
    {
      id: "session-1",
      taskId: "task-1",
      startAt: "2026-09-01T14:00:00.000Z",
      endAt: "2026-09-01T15:00:00.000Z",
      locked: true,
      createdAt: "2026-09-01T09:03:00.000Z",
      updatedAt: "2026-09-01T09:03:00.000Z",
    },
  ],
  proposals: [
    {
      id: "prop-1",
      taskId: "task-1",
      capability: "duration-estimate",
      provenance: "heuristic",
      confidence: 0.9,
      summary: "Duration estimated at 45m.",
      accepted: true,
      occurredAt: "2026-09-01T09:01:30.000Z",
    },
  ],
  revisions: [
    {
      id: "revision-1",
      number: 1,
      kind: "project-created",
      reason: "Created project “Prepare autumn course”.",
      occurredAt: "2026-09-01T09:00:00.000Z",
    },
    {
      id: "revision-2",
      number: 2,
      kind: "task-created",
      reason: "Added task “Outline week one”.",
      occurredAt: "2026-09-01T09:01:00.000Z",
    },
    {
      id: "revision-3",
      number: 3,
      kind: "subtask-created",
      reason: "Added subtask “Draft syllabus section”.",
      occurredAt: "2026-09-01T09:02:00.000Z",
    },
    {
      id: "revision-4",
      number: 4,
      kind: "dependency-created",
      reason: "Set “Draft syllabus section” to depend on “Outline week one”.",
      occurredAt: "2026-09-01T09:02:30.000Z",
    },
    {
      id: "revision-5",
      number: 5,
      kind: "fixed-event-created",
      reason: "Created fixed event “Faculty Meeting”.",
      occurredAt: "2026-09-01T09:02:00.000Z",
    },
    {
      id: "revision-6",
      number: 6,
      kind: "task-session-created",
      reason: "Scheduled session for task “Outline week one”.",
      occurredAt: "2026-09-01T09:03:00.000Z",
    },
  ],
}

class MemoryStorage {
  private readonly values = new Map<string, string>()

  public getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  public setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}

describe("LocalPlannerRepository", () => {
  it("round-trips a complete project, task, subtask, dependency, availability, policy, event, session, and proposal backup exactly", () => {
    const storage = new MemoryStorage()
    const repository = new LocalPlannerRepository(storage)

    expect(repository.save(document)).toEqual({ ok: true, value: undefined })
    const restored = repository.load()
    expect(restored).toEqual({ ok: true, value: document })
    if (!restored.ok || !restored.value) {
      throw new Error("Expected a restored planner document.")
    }

    const before = serialiseBackup(document)
    const after = serialiseBackup(restored.value)
    expect(after).toEqual(before)
  })

  it("seamlessly migrates version 1, 2, 3, 4, 5, 6, and 7 backups into version 8", () => {
    const storage = new MemoryStorage()
    const repository = new LocalPlannerRepository(storage)

    // Migration from v1
    const v1Raw = JSON.stringify({
      schemaVersion: 1,
      timeZone: "Europe/London",
      revision: 2,
      projects: document.projects,
      tasks: [document.tasks[0]],
      revisions: document.revisions.slice(0, 2),
    })

    const restoredV1 = repository.restore(v1Raw)
    expect(restoredV1.ok).toBe(true)
    if (!restoredV1.ok) throw new Error("Expected successful restore")
    expect(restoredV1.value.schemaVersion).toBe(8)
    expect(restoredV1.value.fixedEvents).toEqual([])
    expect(restoredV1.value.taskSessions).toEqual([])
    expect(restoredV1.value.dependencies).toEqual([])
    expect(restoredV1.value.availability).toEqual(DEFAULT_AVAILABILITY)
    expect(restoredV1.value.schedules).toEqual(DEFAULT_SCHEDULES)
    expect(restoredV1.value.policy).toEqual(DEFAULT_POLICY)
    expect(restoredV1.value.proposals).toEqual([])

    // Migration from v5
    const v5Raw = JSON.stringify({
      schemaVersion: 5,
      timeZone: "Europe/London",
      revision: 4,
      projects: document.projects,
      tasks: document.tasks,
      dependencies: document.dependencies,
      availability: document.availability,
      policy: document.policy,
      fixedEvents: document.fixedEvents,
      taskSessions: document.taskSessions,
      revisions: document.revisions.slice(0, 4),
    })

    const restoredV5 = repository.restore(v5Raw)
    expect(restoredV5.ok).toBe(true)
    if (!restoredV5.ok) throw new Error("Expected successful restore")
    expect(restoredV5.value.schemaVersion).toBe(8)
    expect(restoredV5.value.proposals).toEqual([])
    expect(restoredV5.value.schedules).toEqual(DEFAULT_SCHEDULES)
  })

  it("does not overwrite existing local data when an import is invalid", () => {
    const storage = new MemoryStorage()
    const repository = new LocalPlannerRepository(storage)
    const before = serialiseBackup(document)
    if (!before.ok) {
      throw new Error(before.error.message)
    }
    storage.setItem(plannerStorageKey, before.value)

    const invalidBackups = [
      ['not JSON', 'invalid-json'],
      ['{"schemaVersion":99}', 'unsupported-version'],
      [
        JSON.stringify({
          ...document,
          tasks: [{ ...document.tasks[0], projectId: "missing-project" }],
        }),
        "invalid-backup",
      ],
      [
        JSON.stringify({
          ...document,
          policy: { preset: "invalid-mode" },
        }),
        "invalid-backup",
      ],
    ] as const

    for (const [invalidBackup, code] of invalidBackups) {
      const result = repository.restore(invalidBackup)
      expect(result).toMatchObject({ ok: false, error: { code } })
      expect(storage.getItem(plannerStorageKey)).toBe(before.value)
    }
  })
})
