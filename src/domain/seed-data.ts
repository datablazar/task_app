import {
  DEFAULT_AVAILABILITY,
  DEFAULT_POLICY,
  DEFAULT_SCHEDULES,
  PLANNER_SCHEMA_VERSION,
} from "./model"
import type { PlannerDocument } from "./model"

export const getMondayOfWeek = (date: Date): Date => {
  const current = new Date(date)
  current.setUTCHours(0, 0, 0, 0)
  const day = current.getUTCDay()
  const diff = current.getUTCDate() - day + (day === 0 ? -6 : 1)
  return new Date(current.setUTCDate(diff))
}

export const createMockupSeedDocument = (
  timeZone = "UTC",
  referenceDate = new Date("2026-09-03T11:15:00.000Z"),
): PlannerDocument => {
  const monday = getMondayOfWeek(referenceDate)

  const getDateAt = (dayOffset: number, hour: number, minute: number): string => {
    const d = new Date(monday)
    d.setUTCDate(monday.getUTCDate() + dayOffset)
    d.setUTCHours(hour, minute, 0, 0)
    return d.toISOString()
  }

  const nowIso = referenceDate.toISOString()

  return {
    schemaVersion: PLANNER_SCHEMA_VERSION,
    timeZone,
    revision: 1,
    projects: [
      {
        id: "proj-autumn",
        title: "Prepare autumn course",
        color: "#e0533c",
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: "proj-grant",
        title: "Faculty grant renewal",
        color: "#3b7a57",
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: "proj-paper",
        title: "Conference paper",
        color: "#8b5cf6",
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ],
    tasks: [
      // Autumn course tasks (6)
      {
        id: "task-outline-w1",
        projectId: "proj-autumn",
        title: "Outline week one",
        completed: false,
        estimateMinutes: 90,
        priority: "high",
        deadlineStrictness: "soft",
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: "task-draft-slides",
        projectId: "proj-autumn",
        title: "Draft lecture slides",
        completed: false,
        estimateMinutes: 150,
        priority: "medium",
        deadlineStrictness: "soft",
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: "task-syllabus",
        projectId: "proj-autumn",
        title: "Submit syllabus",
        completed: false,
        estimateMinutes: 30,
        priority: "high",
        deadlineStrictness: "hard",
        dueAt: getDateAt(4, 18, 0),
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: "task-reading-list",
        projectId: "proj-autumn",
        title: "Reading list compilation",
        completed: false,
        estimateMinutes: 60,
        priority: "low",
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: "task-lab-handout",
        projectId: "proj-autumn",
        title: "Lab assignment handout",
        completed: false,
        estimateMinutes: 90,
        priority: "medium",
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: "task-guest-speaker",
        projectId: "proj-autumn",
        title: "Invite guest speakers",
        completed: false,
        estimateMinutes: 45,
        priority: "low",
        createdAt: nowIso,
        updatedAt: nowIso,
      },

      // Grant renewal tasks (3) + subtasks
      {
        id: "task-grant-review",
        projectId: "proj-grant",
        title: "Grant report review",
        completed: false,
        estimateMinutes: 90,
        priority: "asap",
        deadlineStrictness: "hard",
        dueAt: getDateAt(2, 17, 0), // Wednesday due
        notes: "Key deadline for faculty submission. Ensure budget tables match latest allocation.",
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: "subtask-budget-lines",
        projectId: "proj-grant",
        parentTaskId: "task-grant-review",
        title: "Collect budget lines",
        completed: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: "subtask-outcomes-table",
        projectId: "proj-grant",
        parentTaskId: "task-grant-review",
        title: "Cross-check outcomes table",
        completed: false,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: "subtask-coauthors",
        projectId: "proj-grant",
        parentTaskId: "task-grant-review",
        title: "Circulate to co-authors",
        completed: false,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: "task-budget-reconciliation",
        projectId: "proj-grant",
        title: "Budget reconciliation",
        completed: false,
        estimateMinutes: 60,
        priority: "high",
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: "task-exec-summary",
        projectId: "proj-grant",
        title: "Executive summary draft",
        completed: false,
        estimateMinutes: 90,
        priority: "medium",
        createdAt: nowIso,
        updatedAt: nowIso,
      },

      // Conference paper tasks (9)
      {
        id: "task-lit-review",
        projectId: "proj-paper",
        title: "Literature review section",
        completed: false,
        estimateMinutes: 120,
        priority: "medium",
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: "task-methodology",
        projectId: "proj-paper",
        title: "Methodology description",
        completed: false,
        estimateMinutes: 90,
        priority: "medium",
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: "task-benchmarks",
        projectId: "proj-paper",
        title: "Run benchmark evaluations",
        completed: false,
        estimateMinutes: 180,
        priority: "high",
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: "task-figures",
        projectId: "proj-paper",
        title: "Generate SVG figures & diagrams",
        completed: false,
        estimateMinutes: 60,
        priority: "low",
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: "task-abstract",
        projectId: "proj-paper",
        title: "Draft abstract & intro",
        completed: false,
        estimateMinutes: 60,
        priority: "medium",
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: "task-related-work",
        projectId: "proj-paper",
        title: "Related work comparisons",
        completed: false,
        estimateMinutes: 75,
        priority: "low",
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: "task-results-analysis",
        projectId: "proj-paper",
        title: "Statistical results analysis",
        completed: false,
        estimateMinutes: 120,
        priority: "high",
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: "task-proofread",
        projectId: "proj-paper",
        title: "Peer proofreading & formatting",
        completed: false,
        estimateMinutes: 60,
        priority: "low",
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: "task-camera-ready",
        projectId: "proj-paper",
        title: "Prepare camera-ready PDF",
        completed: false,
        estimateMinutes: 45,
        priority: "medium",
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ],
    dependencies: [
      {
        id: "dep-slides-after-outline",
        fromTaskId: "task-outline-w1",
        toTaskId: "task-draft-slides",
        createdAt: nowIso,
      },
      {
        id: "dep-results-after-benchmarks",
        fromTaskId: "task-benchmarks",
        toTaskId: "task-results-analysis",
        createdAt: nowIso,
      },
    ],
    availability: DEFAULT_AVAILABILITY,
    schedules: DEFAULT_SCHEDULES,
    policy: DEFAULT_POLICY,
    fixedEvents: [
      {
        id: "fixed-team-sync",
        title: "Team sync",
        startAt: getDateAt(0, 11, 0), // Mon 11:00
        endAt: getDateAt(0, 11, 30),
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: "fixed-office-hours",
        title: "Office hours",
        startAt: getDateAt(2, 10, 0), // Wed 10:00
        endAt: getDateAt(2, 11, 0),
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ],
    taskSessions: [
      {
        id: "session-outline-w1",
        taskId: "task-outline-w1",
        startAt: getDateAt(0, 9, 0), // Mon 09:00 - 10:30
        endAt: getDateAt(0, 10, 30),
        locked: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: "session-draft-slides",
        taskId: "task-draft-slides",
        startAt: getDateAt(1, 9, 30), // Tue 09:30 - 12:00
        endAt: getDateAt(1, 12, 0),
        locked: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: "session-syllabus",
        taskId: "task-syllabus",
        startAt: getDateAt(4, 13, 0), // Fri 13:00 - 13:30
        endAt: getDateAt(4, 13, 30),
        locked: false,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: "session-grant-review",
        taskId: "task-grant-review",
        startAt: getDateAt(2, 14, 0), // Wed 14:00 - 15:30
        endAt: getDateAt(2, 15, 30),
        locked: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ],
    proposals: [],
    revisions: [
      {
        id: "rev-seed-1",
        number: 1,
        kind: "schedule-planned",
        reason: "Initial workspace seed loaded.",
        occurredAt: nowIso,
      },
    ],
  }
}
