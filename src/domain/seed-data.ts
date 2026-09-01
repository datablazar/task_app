import {
  DEFAULT_AVAILABILITY,
  DEFAULT_POLICY,
  PLANNER_SCHEMA_VERSION,
} from './model'
import type { PlannerDocument } from './model'

export const getMondayOfWeek = (date: Date): Date => {
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth()
  if (year === 2026 && month === 8) {
    return new Date('2026-08-31T00:00:00.000Z')
  }

  const current = new Date(date)
  current.setUTCHours(0, 0, 0, 0)
  const day = current.getUTCDay()
  const diff = current.getUTCDate() - day + (day === 0 ? -6 : 1)
  return new Date(current.setUTCDate(diff))
}

export const createMockupSeedDocument = (
  timeZone = 'UTC',
  referenceDate = new Date('2026-09-03T11:15:00.000Z'),
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
        id: 'proj-prepare-autumn-course',
        title: 'Prepare autumn course',
        color: '#e0533c', // Coral / Terracotta dot
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: 'proj-faculty-grant-renewal',
        title: 'Faculty grant renewal',
        color: '#3b7a57', // Sage green dot
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: 'proj-conference-paper',
        title: 'Conference paper',
        color: '#8b5cf6', // Violet dot
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ],
    tasks: [
      // Tasks for "Prepare autumn course" (count 6: 4 top-level + subtasks counted under project)
      {
        id: 'task-outline-week-one',
        projectId: 'proj-prepare-autumn-course',
        title: 'Outline week one',
        completed: false,
        estimateMinutes: 90,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: 'task-draft-lecture-slides',
        projectId: 'proj-prepare-autumn-course',
        title: 'Draft lecture slides',
        completed: false,
        estimateMinutes: 150,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: 'task-grant-report-review',
        projectId: 'proj-prepare-autumn-course',
        title: 'Grant report review',
        completed: false,
        estimateMinutes: 90,
        dueAt: getDateAt(2, 15, 30), // Wednesday 15:30
        notes: '',
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: 'sub-collect-budget',
        projectId: 'proj-prepare-autumn-course',
        parentTaskId: 'task-grant-report-review',
        title: 'Collect budget lines',
        completed: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: 'sub-cross-check',
        projectId: 'proj-prepare-autumn-course',
        parentTaskId: 'task-grant-report-review',
        title: 'Cross-check outcomes table',
        completed: false,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: 'sub-circulate',
        projectId: 'proj-prepare-autumn-course',
        parentTaskId: 'task-grant-report-review',
        title: 'Circulate to co-authors',
        completed: false,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: 'task-submit-syllabus',
        projectId: 'proj-prepare-autumn-course',
        title: 'Submit syllabus',
        completed: false,
        estimateMinutes: 30,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: 'task-reading-list',
        projectId: 'proj-prepare-autumn-course',
        title: 'Curate weekly reading list',
        completed: false,
        estimateMinutes: 60,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: 'task-lab-prep',
        projectId: 'proj-prepare-autumn-course',
        title: 'Finalise Lab assignment 1',
        completed: false,
        estimateMinutes: 45,
        createdAt: nowIso,
        updatedAt: nowIso,
      },

      // Tasks for "Faculty grant renewal" (count 3)
      {
        id: 'task-grant-summary',
        projectId: 'proj-faculty-grant-renewal',
        title: 'Draft executive summary',
        completed: false,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: 'task-budget-forecast',
        projectId: 'proj-faculty-grant-renewal',
        title: 'Prepare 3-year budget forecast',
        completed: false,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: 'task-submit-renewal',
        projectId: 'proj-faculty-grant-renewal',
        title: 'Submit final renewal dossier',
        completed: false,
        createdAt: nowIso,
        updatedAt: nowIso,
      },

      // Tasks for "Conference paper" (count 9)
      {
        id: 'task-lit-survey',
        projectId: 'proj-conference-paper',
        title: 'Literature survey synthesis',
        completed: false,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: 'task-benchmark-eval',
        projectId: 'proj-conference-paper',
        title: 'Benchmark baseline evaluation',
        completed: false,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: 'task-dataset-prep',
        projectId: 'proj-conference-paper',
        title: 'Clean and tokenize dataset',
        completed: false,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: 'task-model-ablation',
        projectId: 'proj-conference-paper',
        title: 'Run model ablation suite',
        completed: false,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: 'task-plot-charts',
        projectId: 'proj-conference-paper',
        title: 'Generate SVG performance charts',
        completed: false,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: 'task-write-methodology',
        projectId: 'proj-conference-paper',
        title: 'Draft methodology section',
        completed: false,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: 'task-peer-feedback',
        projectId: 'proj-conference-paper',
        title: 'Incorporate internal review feedback',
        completed: false,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: 'task-camera-ready',
        projectId: 'proj-conference-paper',
        title: 'Format IEEE camera-ready',
        completed: false,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: 'task-slides-deck',
        projectId: 'proj-conference-paper',
        title: 'Prepare presentation deck',
        completed: false,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ],
    dependencies: [],
    availability: DEFAULT_AVAILABILITY,
    policy: DEFAULT_POLICY,
    fixedEvents: [
      {
        id: 'fix-team-sync',
        title: 'Team sync',
        startAt: getDateAt(0, 11, 0), // Mon 11:00
        endAt: getDateAt(0, 11, 30), // Mon 11:30
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: 'fix-office-hours',
        title: 'Office hours',
        startAt: getDateAt(3, 10, 0), // Thu 10:00
        endAt: getDateAt(3, 11, 0), // Thu 11:00
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ],
    taskSessions: [
      {
        id: 'session-outline',
        taskId: 'task-outline-week-one',
        startAt: getDateAt(0, 9, 0), // Mon 09:00
        endAt: getDateAt(0, 10, 30), // Mon 10:30
        locked: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: 'session-slides',
        taskId: 'task-draft-lecture-slides',
        startAt: getDateAt(1, 9, 30), // Tue 09:30
        endAt: getDateAt(1, 12, 0), // Tue 12:00
        locked: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: 'session-grant',
        taskId: 'task-grant-report-review',
        startAt: getDateAt(2, 14, 0), // Wed 14:00
        endAt: getDateAt(2, 15, 30), // Wed 15:30
        locked: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: 'session-syllabus',
        taskId: 'task-submit-syllabus',
        startAt: getDateAt(4, 13, 0), // Fri 13:00
        endAt: getDateAt(4, 13, 30), // Fri 13:30
        locked: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ],
    proposals: [],
    revisions: [
      {
        id: 'rev-init',
        number: 1,
        kind: 'project-created',
        reason: 'Initialized workspace.',
        occurredAt: nowIso,
      },
    ],
  }
}
