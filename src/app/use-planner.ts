import { useCallback, useMemo, useState } from 'react'
import { createEmptyPlannerDocument } from '../domain/model'
import { createMockupSeedDocument } from '../domain/seed-data'
import { createStableId } from './ids'
import { generateReferencePlan, repairSchedule } from '../domain/planner-engine'
import { defaultInterpretationService } from '../domain/interpretation'
import { parseQuickTaskInput } from '../domain/interpretation/nlp-parser'
import type { PlannerWorkspace } from '../application/planner-workspace'
import type {
  PlanningPolicy,
  PlanRisk,
  PlannerDocument,
  Project,
  ProposalCapability,
  ProposalProvenance,
} from '../domain/model'
import type {
  ProviderMode,
  TaskInterpretationResult,
} from '../domain/interpretation'

export interface PlannerNotice {
  tone: 'success' | 'error'
  message: string
}

interface UsePlannerOptions {
  workspace: PlannerWorkspace
  createId?: () => string
  now?: () => Date
  seedInitial?: boolean
}

const getLocalTimeZone = (): string =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

const PROVIDER_MODE_KEY = 'pa_ai_provider_mode'
const GEMINI_API_KEY = 'pa_gemini_api_key'

export const usePlanner = ({
  workspace,
  createId = createStableId,
  now = () => new Date(),
  seedInitial = false,
}: UsePlannerOptions) => {
  const initial = useMemo(() => {
    const loaded = workspace.load()
    if (!loaded.ok) {
      return {
        document: createEmptyPlannerDocument(getLocalTimeZone()),
        notice: { tone: 'error' as const, message: loaded.error.message },
      }
    }
    const defaultDoc = seedInitial
      ? createMockupSeedDocument(getLocalTimeZone(), now())
      : createEmptyPlannerDocument(getLocalTimeZone())
    return {
      document: loaded.value ?? defaultDoc,
      notice: { tone: 'success' as const, message: 'Saved locally.' },
    }
  }, [now, seedInitial, workspace])

  const [document, setDocument] = useState<PlannerDocument>(initial.document)
  const [notice, setNotice] = useState<PlannerNotice>(initial.notice)
  const [latestRisks, setLatestRisks] = useState<PlanRisk[]>([])

  const [providerMode, setProviderModeState] = useState<ProviderMode>(() => {
    try {
      return (localStorage.getItem(PROVIDER_MODE_KEY) as ProviderMode) || 'simulated-ai'
    } catch {
      return 'simulated-ai'
    }
  })

  const [apiKey, setApiKeyState] = useState<string>(() => {
    try {
      return localStorage.getItem(GEMINI_API_KEY) || ''
    } catch {
      return ''
    }
  })

  const setProviderMode = useCallback((mode: ProviderMode) => {
    setProviderModeState(mode)
    try {
      localStorage.setItem(PROVIDER_MODE_KEY, mode)
    } catch {
      // safe fallback
    }
  }, [])

  const setApiKey = useCallback((key: string) => {
    setApiKeyState(key)
    try {
      localStorage.setItem(GEMINI_API_KEY, key)
    } catch {
      // safe fallback
    }
  }, [])

  const createProject = useCallback(
    (title: string): Project | undefined => {
      const id = createId()
      const result = workspace.execute(document, {
        type: 'create-project',
        id,
        revisionId: createId(),
        occurredAt: now().toISOString(),
        title,
      })
      if (!result.ok) {
        setNotice({ tone: 'error', message: result.error.message })
        return undefined
      }
      setDocument(result.value.document)
      setNotice({ tone: 'success', message: 'Saved locally.' })
      return result.value.document.projects.find((project) => project.id === id)
    },
    [createId, document, now, workspace],
  )

  const createTask = useCallback(
    (projectId: string, title: string): boolean => {
      const result = workspace.execute(document, {
        type: 'create-task',
        id: createId(),
        revisionId: createId(),
        occurredAt: now().toISOString(),
        projectId,
        title,
      })
      if (!result.ok) {
        setNotice({ tone: 'error', message: result.error.message })
        return false
      }
      setDocument(result.value.document)
      setNotice({ tone: 'success', message: 'Saved locally.' })
      return true
    },
    [createId, document, now, workspace],
  )

  const createSubtask = useCallback(
    (projectId: string, parentTaskId: string, title: string): boolean => {
      const result = workspace.execute(document, {
        type: 'create-subtask',
        id: createId(),
        revisionId: createId(),
        occurredAt: now().toISOString(),
        projectId,
        parentTaskId,
        title,
      })
      if (!result.ok) {
        setNotice({ tone: 'error', message: result.error.message })
        return false
      }
      setDocument(result.value.document)
      setNotice({ tone: 'success', message: 'Saved locally.' })
      return true
    },
    [createId, document, now, workspace],
  )

  const updateTaskConstraints = useCallback(
    (
      taskId: string,
      constraints: {
        estimateMinutes?: number
        dueAt?: string
        earliestStartAt?: string
        notes?: string
      },
    ): boolean => {
      const result = workspace.execute(document, {
        type: 'update-task-constraints',
        id: taskId,
        revisionId: createId(),
        occurredAt: now().toISOString(),
        taskId,
        ...constraints,
      })
      if (!result.ok) {
        setNotice({ tone: 'error', message: result.error.message })
        return false
      }
      setDocument(result.value.document)
      setNotice({ tone: 'success', message: 'Task constraints updated.' })
      return true
    },
    [createId, document, now, workspace],
  )

  const setTaskCompletion = useCallback(
    (taskId: string, completed: boolean): boolean => {
      const result = workspace.execute(document, {
        type: 'set-task-completion',
        id: taskId,
        revisionId: createId(),
        occurredAt: now().toISOString(),
        taskId,
        completed,
      })
      if (!result.ok) {
        setNotice({ tone: 'error', message: result.error.message })
        return false
      }
      setDocument(result.value.document)
      setNotice({ tone: 'success', message: 'Saved locally.' })
      return true
    },
    [createId, document, now, workspace],
  )

  const createFixedEvent = useCallback(
    (title: string, startAt: string, endAt: string): boolean => {
      const result = workspace.execute(document, {
        type: 'create-fixed-event',
        id: createId(),
        revisionId: createId(),
        occurredAt: now().toISOString(),
        title,
        startAt,
        endAt,
      })
      if (!result.ok) {
        setNotice({ tone: 'error', message: result.error.message })
        return false
      }
      setDocument(result.value.document)
      setNotice({ tone: 'success', message: 'Fixed event scheduled.' })
      return true
    },
    [createId, document, now, workspace],
  )

  const deleteFixedEvent = useCallback(
    (eventId: string): boolean => {
      const result = workspace.execute(document, {
        type: 'delete-fixed-event',
        id: eventId,
        revisionId: createId(),
        occurredAt: now().toISOString(),
        eventId,
      })
      if (!result.ok) {
        setNotice({ tone: 'error', message: result.error.message })
        return false
      }
      setDocument(result.value.document)
      setNotice({ tone: 'success', message: 'Fixed event removed.' })
      return true
    },
    [createId, document, now, workspace],
  )

  const createTaskSession = useCallback(
    (taskId: string, startAt: string, endAt: string): boolean => {
      const result = workspace.execute(document, {
        type: 'create-task-session',
        id: createId(),
        revisionId: createId(),
        occurredAt: now().toISOString(),
        taskId,
        startAt,
        endAt,
      })
      if (!result.ok) {
        setNotice({ tone: 'error', message: result.error.message })
        return false
      }
      setDocument(result.value.document)
      setNotice({ tone: 'success', message: 'Task session scheduled.' })
      return true
    },
    [createId, document, now, workspace],
  )

  const deleteTaskSession = useCallback(
    (sessionId: string): boolean => {
      const result = workspace.execute(document, {
        type: 'delete-task-session',
        id: sessionId,
        revisionId: createId(),
        occurredAt: now().toISOString(),
        sessionId,
      })
      if (!result.ok) {
        setNotice({ tone: 'error', message: result.error.message })
        return false
      }
      setDocument(result.value.document)
      setNotice({ tone: 'success', message: 'Task session removed.' })
      return true
    },
    [createId, document, now, workspace],
  )

  const createDependency = useCallback(
    (fromTaskId: string, toTaskId: string): boolean => {
      const result = workspace.execute(document, {
        type: 'create-dependency',
        id: createId(),
        revisionId: createId(),
        occurredAt: now().toISOString(),
        fromTaskId,
        toTaskId,
      })
      if (!result.ok) {
        setNotice({ tone: 'error', message: result.error.message })
        return false
      }
      setDocument(result.value.document)
      setNotice({ tone: 'success', message: 'Dependency added.' })
      return true
    },
    [createId, document, now, workspace],
  )

  const deleteDependency = useCallback(
    (dependencyId: string): boolean => {
      const result = workspace.execute(document, {
        type: 'delete-dependency',
        id: dependencyId,
        revisionId: createId(),
        occurredAt: now().toISOString(),
        dependencyId,
      })
      if (!result.ok) {
        setNotice({ tone: 'error', message: result.error.message })
        return false
      }
      setDocument(result.value.document)
      setNotice({ tone: 'success', message: 'Dependency removed.' })
      return true
    },
    [createId, document, now, workspace],
  )

  const generateAndApplyPlan = useCallback((): {
    success: boolean
    risks: PlanRisk[]
    reasons: string[]
  } => {
    const plan = generateReferencePlan(document, { now: now().toISOString() })
    if (!plan.success) {
      setNotice({
        tone: 'error',
        message: plan.reasons[0] ?? 'Planning could not complete.',
      })
      setLatestRisks(plan.risks)
      return { success: false, risks: plan.risks, reasons: plan.reasons }
    }

    const result = workspace.execute(document, {
      type: 'apply-plan',
      id: createId(),
      revisionId: createId(),
      occurredAt: now().toISOString(),
      sessions: plan.sessions,
    })

    if (!result.ok) {
      setNotice({ tone: 'error', message: result.error.message })
      return { success: false, risks: plan.risks, reasons: plan.reasons }
    }

    setDocument(result.value.document)
    setLatestRisks(plan.risks)
    setNotice({
      tone: 'success',
      message: `Scheduled ${plan.sessions.length} session(s)${
        plan.risks.length > 0 ? ` with ${plan.risks.length} risk(s)` : ''
      }.`,
    })
    return { success: true, risks: plan.risks, reasons: plan.reasons }
  }, [createId, document, now, workspace])

  const undoLastPlan = useCallback((): boolean => {
    const result = workspace.execute(document, {
      type: 'undo-last-plan',
      id: createId(),
      revisionId: createId(),
      occurredAt: now().toISOString(),
    })
    if (!result.ok) {
      setNotice({ tone: 'error', message: result.error.message })
      return false
    }
    setDocument(result.value.document)
    setLatestRisks([])
    setNotice({ tone: 'success', message: 'Reverted to previous schedule.' })
    return true
  }, [createId, document, now, workspace])

  const canUndo = useMemo(
    () =>
      document.revisions.length > 0 &&
      document.revisions[document.revisions.length - 1]?.kind === 'schedule-planned',
    [document.revisions],
  )

  const toggleSessionLock = useCallback(
    (sessionId: string): boolean => {
      const result = workspace.execute(document, {
        type: 'toggle-task-session-lock',
        id: sessionId,
        revisionId: createId(),
        occurredAt: now().toISOString(),
        sessionId,
      })
      if (!result.ok) {
        setNotice({ tone: 'error', message: result.error.message })
        return false
      }
      setDocument(result.value.document)
      setNotice({ tone: 'success', message: 'Session pinned state updated.' })
      return true
    },
    [createId, document, now, workspace],
  )

  const updatePolicy = useCallback(
    (policy: PlanningPolicy): boolean => {
      const result = workspace.execute(document, {
        type: 'update-policy',
        id: createId(),
        revisionId: createId(),
        occurredAt: now().toISOString(),
        policy,
      })
      if (!result.ok) {
        setNotice({ tone: 'error', message: result.error.message })
        return false
      }
      setDocument(result.value.document)
      setNotice({ tone: 'success', message: `Planning mode set to ${policy.preset}.` })
      return true
    },
    [createId, document, now, workspace],
  )

  // AI Interpretation and Proposal Functions
  const interpretTask = useCallback(
    async (taskId: string): Promise<TaskInterpretationResult | null> => {
      const task = document.tasks.find((t) => t.id === taskId)
      if (!task) return null

      const provider = defaultInterpretationService.getProvider(providerMode)
      const result = await provider.interpretTask(task.title, {
        existingTasks: document.tasks,
        referenceDate: now(),
        apiKey,
      })

      return result
    },
    [apiKey, document.tasks, now, providerMode],
  )

  const acceptDuration = useCallback(
    (taskId: string, estimateMinutes: number, provenance: ProposalProvenance): boolean => {
      const task = document.tasks.find((t) => t.id === taskId)
      if (!task) return false

      const r1 = workspace.execute(document, {
        type: 'update-task-constraints',
        id: taskId,
        revisionId: createId(),
        occurredAt: now().toISOString(),
        taskId,
        estimateMinutes,
        dueAt: task.dueAt,
        earliestStartAt: task.earliestStartAt,
      })
      if (!r1.ok) {
        setNotice({ tone: 'error', message: r1.error.message })
        return false
      }

      const r2 = workspace.execute(r1.value.document, {
        type: 'record-proposal-decision',
        id: createId(),
        revisionId: createId(),
        occurredAt: now().toISOString(),
        decision: {
          id: createId(),
          taskId,
          capability: 'duration-estimate',
          provenance,
          confidence: 0.95,
          summary: `Set duration to ${estimateMinutes}m`,
          accepted: true,
          occurredAt: now().toISOString(),
        },
      })
      if (r2.ok) {
        setDocument(r2.value.document)
        setNotice({ tone: 'success', message: `Applied suggested duration of ${estimateMinutes}m.` })
        return true
      }
      return false
    },
    [createId, document, now, workspace],
  )

  const acceptDeadline = useCallback(
    (taskId: string, dueAt: string, provenance: ProposalProvenance): boolean => {
      const task = document.tasks.find((t) => t.id === taskId)
      if (!task) return false

      const r1 = workspace.execute(document, {
        type: 'update-task-constraints',
        id: taskId,
        revisionId: createId(),
        occurredAt: now().toISOString(),
        taskId,
        estimateMinutes: task.estimateMinutes,
        dueAt,
        earliestStartAt: task.earliestStartAt,
      })
      if (!r1.ok) {
        setNotice({ tone: 'error', message: r1.error.message })
        return false
      }

      const r2 = workspace.execute(r1.value.document, {
        type: 'record-proposal-decision',
        id: createId(),
        revisionId: createId(),
        occurredAt: now().toISOString(),
        decision: {
          id: createId(),
          taskId,
          capability: 'deadline-extract',
          provenance,
          confidence: 0.95,
          summary: `Set deadline to ${dueAt}`,
          accepted: true,
          occurredAt: now().toISOString(),
        },
      })
      if (r2.ok) {
        setDocument(r2.value.document)
        setNotice({ tone: 'success', message: 'Applied suggested deadline.' })
        return true
      }
      return false
    },
    [createId, document, now, workspace],
  )

  const acceptSubtasks = useCallback(
    (
      projectId: string,
      parentTaskId: string,
      subtaskTitles: string[],
      provenance: ProposalProvenance,
    ): boolean => {
      let currentDoc = document
      for (const title of subtaskTitles) {
        const res = workspace.execute(currentDoc, {
          type: 'create-subtask',
          id: createId(),
          revisionId: createId(),
          occurredAt: now().toISOString(),
          projectId,
          parentTaskId,
          title,
        })
        if (!res.ok) {
          setNotice({ tone: 'error', message: res.error.message })
          return false
        }
        currentDoc = res.value.document
      }

      const decRes = workspace.execute(currentDoc, {
        type: 'record-proposal-decision',
        id: createId(),
        revisionId: createId(),
        occurredAt: now().toISOString(),
        decision: {
          id: createId(),
          taskId: parentTaskId,
          capability: 'subtask-decomposition',
          provenance,
          confidence: 0.95,
          summary: `Added ${subtaskTitles.length} subtask(s)`,
          accepted: true,
          occurredAt: now().toISOString(),
        },
      })
      if (decRes.ok) {
        setDocument(decRes.value.document)
        setNotice({ tone: 'success', message: `Added ${subtaskTitles.length} subtask(s).` })
        return true
      }
      return false
    },
    [createId, document, now, workspace],
  )

  const acceptDependency = useCallback(
    (
      dependentTaskId: string,
      prerequisiteTaskId: string,
      provenance: ProposalProvenance,
    ): boolean => {
      const r1 = workspace.execute(document, {
        type: 'create-dependency',
        id: createId(),
        revisionId: createId(),
        occurredAt: now().toISOString(),
        fromTaskId: prerequisiteTaskId,
        toTaskId: dependentTaskId,
      })
      if (!r1.ok) {
        setNotice({ tone: 'error', message: r1.error.message })
        return false
      }

      const r2 = workspace.execute(r1.value.document, {
        type: 'record-proposal-decision',
        id: createId(),
        revisionId: createId(),
        occurredAt: now().toISOString(),
        decision: {
          id: createId(),
          taskId: dependentTaskId,
          capability: 'dependency-infer',
          provenance,
          confidence: 0.9,
          summary: `Added prerequisite dependency`,
          accepted: true,
          occurredAt: now().toISOString(),
        },
      })
      if (r2.ok) {
        setDocument(r2.value.document)
        setNotice({ tone: 'success', message: 'Dependency linked.' })
        return true
      }
      return false
    },
    [createId, document, now, workspace],
  )

  const dismissProposal = useCallback(
    (taskId: string, capability: ProposalCapability, provenance: ProposalProvenance): boolean => {
      const res = workspace.execute(document, {
        type: 'record-proposal-decision',
        id: createId(),
        revisionId: createId(),
        occurredAt: now().toISOString(),
        decision: {
          id: createId(),
          taskId,
          capability,
          provenance,
          confidence: 0.5,
          summary: `Dismissed ${capability} proposal`,
          accepted: false,
          occurredAt: now().toISOString(),
        },
      })
      if (res.ok) {
        setDocument(res.value.document)
        setNotice({ tone: 'success', message: 'Proposal dismissed.' })
        return true
      }
      return false
    },
    [createId, document, now, workspace],
  )

  const createQuickTask = useCallback(
    (input: string, fallbackProjectId?: string): boolean => {
      const parsed = parseQuickTaskInput(input, document.projects, now())
      const targetProjectId = parsed.projectId ?? fallbackProjectId ?? document.projects[0]?.id
      if (!targetProjectId) {
        setNotice({ tone: 'error', message: 'Create a project first before adding tasks.' })
        return false
      }

      const taskId = createId()
      const r1 = workspace.execute(document, {
        type: 'create-task',
        id: taskId,
        revisionId: createId(),
        occurredAt: now().toISOString(),
        projectId: targetProjectId,
        title: parsed.cleanedTitle,
      })
      if (!r1.ok) {
        setNotice({ tone: 'error', message: r1.error.message })
        return false
      }

      let currentDoc = r1.value.document

      if (parsed.estimateMinutes || parsed.dueAt) {
        const r2 = workspace.execute(currentDoc, {
          type: 'update-task-constraints',
          id: taskId,
          revisionId: createId(),
          occurredAt: now().toISOString(),
          taskId,
          estimateMinutes: parsed.estimateMinutes,
          dueAt: parsed.dueAt,
        })
        if (r2.ok) {
          currentDoc = r2.value.document
        }
      }

      setDocument(currentDoc)
      setNotice({ tone: 'success', message: `Task “${parsed.cleanedTitle}” added.` })
      return true
    },
    [createId, document, now, workspace],
  )

  const hasOverdueSessions = useMemo(() => {
    const nowMs = now().getTime()
    const taskMap = new Map(document.tasks.map((t) => [t.id, t]))
    return document.taskSessions.some((session) => {
      const isPast = Date.parse(session.endAt) < nowMs
      const task = taskMap.get(session.taskId)
      return isPast && !task?.completed && !session.locked
    })
  }, [document.taskSessions, document.tasks, now])

  const repairAndReschedule = useCallback((): {
    success: boolean
    repairedCount: number
    risks: PlanRisk[]
  } => {
    const repairResult = repairSchedule(document, { now: now().toISOString() })
    if (repairResult.repairedCount === 0) {
      setNotice({ tone: 'success', message: 'Schedule is already up to date.' })
      return { success: true, repairedCount: 0, risks: [] }
    }

    const commandResult = workspace.execute(document, {
      type: 'repair-schedule',
      id: createId(),
      revisionId: createId(),
      occurredAt: now().toISOString(),
      sessions: repairResult.sessions,
    })

    if (!commandResult.ok) {
      setNotice({ tone: 'error', message: commandResult.error.message })
      return { success: false, repairedCount: 0, risks: repairResult.risks }
    }

    setDocument(commandResult.value.document)
    setLatestRisks(repairResult.risks)
    setNotice({
      tone: 'success',
      message: `Repaired schedule: moved ${repairResult.repairedCount} overdue session(s) forward.`,
    })
    return {
      success: true,
      repairedCount: repairResult.repairedCount,
      risks: repairResult.risks,
    }
  }, [createId, document, now, workspace])

  const restore = useCallback(
    (raw: string): boolean => {
      const result = workspace.restore(raw)
      if (!result.ok) {
        setNotice({ tone: 'error', message: result.error.message })
        return false
      }
      setDocument(result.value)
      setLatestRisks([])
      setNotice({ tone: 'success', message: 'Backup restored locally.' })
      return true
    },
    [workspace],
  )

  const exportBackup = useCallback((): string | undefined => {
    const result = workspace.export(document)
    if (!result.ok) {
      setNotice({ tone: 'error', message: result.error.message })
      return undefined
    }
    setNotice({ tone: 'success', message: 'Backup ready to download.' })
    return result.value
  }, [document, workspace])

  return {
    acceptDeadline,
    acceptDependency,
    acceptDuration,
    acceptSubtasks,
    apiKey,
    canUndo,
    createDependency,
    createFixedEvent,
    createProject,
    createQuickTask,
    createSubtask,
    createTask,
    createTaskSession,
    deleteDependency,
    deleteFixedEvent,
    deleteTaskSession,
    dismissProposal,
    document,
    exportBackup,
    generateAndApplyPlan,
    hasOverdueSessions,
    interpretTask,
    notice,
    providerMode,
    repairAndReschedule,
    restore,
    risks: latestRisks,
    setApiKey,
    setProviderMode,
    setTaskCompletion,
    toggleSessionLock,
    undoLastPlan,
    updatePolicy,
    updateTaskConstraints,
  }
}
