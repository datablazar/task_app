import { useCallback, useMemo, useState } from 'react'
import { createEmptyPlannerDocument } from '../domain/model'
import { createStableId } from './ids'
import { generateReferencePlan, repairSchedule } from '../domain/planner-engine'
import { defaultInterpretationService } from '../domain/interpretation'
import { parseQuickTaskInput } from '../domain/interpretation/nlp-parser'
import type { PlannerWorkspace } from '../application/planner-workspace'
import type {
  AvailabilityWindow,
  DeadlineType,
  PlanningPolicy,
  PlanRisk,
  PlannerDocument,
  Project,
  ProposalCapability,
  ProposalProvenance,
  RecurrenceRule,
  TaskPriority,
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
}

const getLocalTimeZone = (): string =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

const PROVIDER_MODE_KEY = 'pa_ai_provider_mode'
const GEMINI_API_KEY = 'pa_gemini_api_key'

export const usePlanner = ({
  workspace,
  createId = createStableId,
  now = () => new Date(),
}: UsePlannerOptions) => {
  const [document, setDocument] = useState<PlannerDocument>(() => {
    const loaded = workspace.load()
    if (loaded.ok && loaded.value) {
      return loaded.value
    }
    return createEmptyPlannerDocument(getLocalTimeZone())
  })

  const [providerMode, setProviderModeState] = useState<ProviderMode>(() => {
    try {
      const saved = localStorage.getItem(PROVIDER_MODE_KEY)
      if (saved === 'simulated-ai' || saved === 'heuristic' || saved === 'gemini-api') {
        return saved
      }
    } catch {
      // Fallback
    }
    return 'heuristic'
  })

  const [apiKey, setApiKeyState] = useState<string>(() => {
    try {
      return localStorage.getItem(GEMINI_API_KEY) || ''
    } catch {
      return ''
    }
  })

  const [notice, setNotice] = useState<PlannerNotice>({
    tone: 'success',
    message: 'Saved locally.',
  })
  const [latestRisks, setLatestRisks] = useState<PlanRisk[]>([])

  const setProviderMode = useCallback((mode: ProviderMode) => {
    setProviderModeState(mode)
    try {
      localStorage.setItem(PROVIDER_MODE_KEY, mode)
    } catch {
      // ignore
    }
  }, [])

  const setApiKey = useCallback((key: string) => {
    setApiKeyState(key)
    try {
      localStorage.setItem(GEMINI_API_KEY, key)
    } catch {
      // ignore
    }
  }, [])

  const createProject = useCallback(
    (title: string): Project | null => {
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
        return null
      }
      setDocument(result.value.document)
      setNotice({ tone: 'success', message: 'Saved locally.' })
      return result.value.document.projects.find((p) => p.id === id) ?? null
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
        priority?: TaskPriority
        deadlineType?: DeadlineType
        description?: string
        labels?: string[]
        scheduleId?: string
        targetProjectId?: string
      },
    ): boolean => {
      let currentDoc = document
      const task = currentDoc.tasks.find((t) => t.id === taskId)
      if (!task) return false

      if (
        constraints.targetProjectId &&
        constraints.targetProjectId !== task.projectId
      ) {
        const moveResult = workspace.execute(currentDoc, {
          type: 'move-task',
          id: createId(),
          revisionId: createId(),
          occurredAt: now().toISOString(),
          taskId,
          targetProjectId: constraints.targetProjectId,
        })
        if (!moveResult.ok) {
          setNotice({ tone: 'error', message: moveResult.error.message })
          return false
        }
        currentDoc = moveResult.value.document
      }

      const result = workspace.execute(currentDoc, {
        type: 'update-task-constraints',
        id: taskId,
        revisionId: createId(),
        occurredAt: now().toISOString(),
        taskId,
        estimateMinutes: constraints.estimateMinutes,
        dueAt: constraints.dueAt,
        earliestStartAt: constraints.earliestStartAt,
        priority: constraints.priority,
        deadlineType: constraints.deadlineType,
        description: constraints.description,
        labels: constraints.labels,
        scheduleId: constraints.scheduleId,
      })
      if (!result.ok) {
        setNotice({ tone: 'error', message: result.error.message })
        return false
      }
      setDocument(result.value.document)
      setNotice({ tone: 'success', message: 'Task details updated.' })
      return true
    },
    [createId, document, now, workspace],
  )

  const createSchedule = useCallback(
    (title: string, workingWindows: AvailabilityWindow[], isDefault?: boolean): boolean => {
      const result = workspace.execute(document, {
        type: 'create-schedule',
        id: createId(),
        revisionId: createId(),
        occurredAt: now().toISOString(),
        title,
        workingWindows,
        isDefault,
      })
      if (!result.ok) {
        setNotice({ tone: 'error', message: result.error.message })
        return false
      }
      setDocument(result.value.document)
      setNotice({ tone: 'success', message: `Schedule “${title}” created.` })
      return true
    },
    [createId, document, now, workspace],
  )

  const updateSchedule = useCallback(
    (
      scheduleId: string,
      updates: {
        title?: string
        workingWindows?: AvailabilityWindow[]
        isDefault?: boolean
      },
    ): boolean => {
      const result = workspace.execute(document, {
        type: 'update-schedule',
        id: scheduleId,
        revisionId: createId(),
        occurredAt: now().toISOString(),
        scheduleId,
        ...updates,
      })
      if (!result.ok) {
        setNotice({ tone: 'error', message: result.error.message })
        return false
      }
      setDocument(result.value.document)
      setNotice({ tone: 'success', message: 'Schedule updated.' })
      return true
    },
    [createId, document, now, workspace],
  )

  const deleteSchedule = useCallback(
    (scheduleId: string): boolean => {
      const result = workspace.execute(document, {
        type: 'delete-schedule',
        id: scheduleId,
        revisionId: createId(),
        occurredAt: now().toISOString(),
        scheduleId,
      })
      if (!result.ok) {
        setNotice({ tone: 'error', message: result.error.message })
        return false
      }
      setDocument(result.value.document)
      setNotice({ tone: 'success', message: 'Schedule deleted.' })
      return true
    },
    [createId, document, now, workspace],
  )

  const setDefaultSchedule = useCallback(
    (scheduleId: string): boolean => {
      const result = workspace.execute(document, {
        type: 'set-default-schedule',
        id: scheduleId,
        revisionId: createId(),
        occurredAt: now().toISOString(),
        scheduleId,
      })
      if (!result.ok) {
        setNotice({ tone: 'error', message: result.error.message })
        return false
      }
      setDocument(result.value.document)
      setNotice({ tone: 'success', message: 'Default schedule updated.' })
      return true
    },
    [createId, document, now, workspace],
  )

  const createRecurrenceRule = useCallback(
    (rule: Omit<RecurrenceRule, 'createdAt' | 'updatedAt'>, horizonDays?: number): boolean => {
      const result = workspace.execute(document, {
        type: 'create-recurrence-rule',
        id: rule.id || createId(),
        revisionId: createId(),
        occurredAt: now().toISOString(),
        rule,
        horizonDays,
      })
      if (!result.ok) {
        setNotice({ tone: 'error', message: result.error.message })
        return false
      }
      setDocument(result.value.document)
      setNotice({ tone: 'success', message: `Recurring rule for “${rule.title}” created and pre-generated.` })
      return true
    },
    [createId, document, now, workspace],
  )

  const updateRecurrenceRule = useCallback(
    (
      ruleId: string,
      updates: Partial<Omit<RecurrenceRule, 'id' | 'createdAt' | 'updatedAt'>>,
    ): boolean => {
      const result = workspace.execute(document, {
        type: 'update-recurrence-rule',
        id: ruleId,
        revisionId: createId(),
        occurredAt: now().toISOString(),
        ruleId,
        updates,
      })
      if (!result.ok) {
        setNotice({ tone: 'error', message: result.error.message })
        return false
      }
      setDocument(result.value.document)
      setNotice({ tone: 'success', message: 'Recurring rule updated.' })
      return true
    },
    [createId, document, now, workspace],
  )

  const deleteRecurrenceRule = useCallback(
    (ruleId: string, deleteFutureTasks?: boolean): boolean => {
      const result = workspace.execute(document, {
        type: 'delete-recurrence-rule',
        id: ruleId,
        revisionId: createId(),
        occurredAt: now().toISOString(),
        ruleId,
        deleteFutureTasks,
      })
      if (!result.ok) {
        setNotice({ tone: 'error', message: result.error.message })
        return false
      }
      setDocument(result.value.document)
      setNotice({ tone: 'success', message: 'Recurring rule deleted.' })
      return true
    },
    [createId, document, now, workspace],
  )

  const generateRecurringTasks = useCallback(
    (horizonDays?: number): boolean => {
      const result = workspace.execute(document, {
        type: 'generate-recurring-tasks',
        id: createId(),
        revisionId: createId(),
        occurredAt: now().toISOString(),
        horizonDays,
      })
      if (!result.ok) {
        setNotice({ tone: 'error', message: result.error.message })
        return false
      }
      setDocument(result.value.document)
      setNotice({ tone: 'success', message: 'Recurring tasks generated.' })
      return true
    },
    [createId, document, now, workspace],
  )

  const moveTask = useCallback(
    (taskId: string, targetProjectId: string): boolean => {
      const result = workspace.execute(document, {
        type: 'move-task',
        id: createId(),
        revisionId: createId(),
        occurredAt: now().toISOString(),
        taskId,
        targetProjectId,
      })
      if (!result.ok) {
        setNotice({ tone: 'error', message: result.error.message })
        return false
      }
      setDocument(result.value.document)
      setNotice({ tone: 'success', message: 'Task moved to project.' })
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
      const parsed = parseQuickTaskInput(input, document.projects, now(), document.schedules)
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

      if (
        parsed.estimateMinutes ||
        parsed.dueAt ||
        parsed.priority ||
        parsed.deadlineType ||
        parsed.scheduleId ||
        (parsed.labels && parsed.labels.length > 0)
      ) {
        const r2 = workspace.execute(currentDoc, {
          type: 'update-task-constraints',
          id: taskId,
          revisionId: createId(),
          occurredAt: now().toISOString(),
          taskId,
          estimateMinutes: parsed.estimateMinutes,
          dueAt: parsed.dueAt,
          priority: parsed.priority,
          deadlineType: parsed.deadlineType,
          labels: parsed.labels,
          scheduleId: parsed.scheduleId,
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
    createRecurrenceRule,
    createSchedule,
    createSubtask,
    createTask,
    createTaskSession,
    deleteDependency,
    deleteFixedEvent,
    deleteRecurrenceRule,
    deleteSchedule,
    deleteTaskSession,
    dismissProposal,
    document,
    exportBackup,
    generateAndApplyPlan,
    generateRecurringTasks,
    hasOverdueSessions,
    interpretTask,
    moveTask,
    notice,
    providerMode,
    repairAndReschedule,
    restore,
    risks: latestRisks,
    setApiKey,
    setDefaultSchedule,
    setProviderMode,
    setTaskCompletion,
    toggleSessionLock,
    undoLastPlan,
    updatePolicy,
    updateRecurrenceRule,
    updateSchedule,
    updateTaskConstraints,
  }
}
