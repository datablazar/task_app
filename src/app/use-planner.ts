import { useCallback, useMemo, useState } from 'react'
import { createEmptyPlannerDocument } from '../domain/model'
import { createStableId } from './ids'
import type { PlannerWorkspace } from '../application/planner-workspace'
import type { PlannerDocument, Project } from '../domain/model'

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

export const usePlanner = ({
  workspace,
  createId = createStableId,
  now = () => new Date(),
}: UsePlannerOptions) => {
  const initial = useMemo(() => {
    const loaded = workspace.load()
    if (!loaded.ok) {
      return {
        document: createEmptyPlannerDocument(getLocalTimeZone()),
        notice: { tone: 'error' as const, message: loaded.error.message },
      }
    }
    return {
      document: loaded.value ?? createEmptyPlannerDocument(getLocalTimeZone()),
      notice: { tone: 'success' as const, message: 'Saved locally.' },
    }
  }, [workspace])

  const [document, setDocument] = useState<PlannerDocument>(initial.document)
  const [notice, setNotice] = useState<PlannerNotice>(initial.notice)

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
      setNotice({ tone: 'success', message: 'Task updated.' })
      return true
    },
    [createId, document, now, workspace],
  )

  const setTaskCompletion = useCallback(
    (taskId: string, completed: boolean): void => {
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
        return
      }
      setDocument(result.value.document)
      setNotice({ tone: 'success', message: 'Saved locally.' })
    },
    [createId, document, now, workspace],
  )

  const createFixedEvent = useCallback(
    (title: string, startAt: string, endAt: string): boolean => {
      const id = createId()
      const result = workspace.execute(document, {
        type: 'create-fixed-event',
        id,
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
      setNotice({ tone: 'success', message: 'Fixed event saved.' })
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
      setNotice({ tone: 'success', message: 'Fixed event deleted.' })
      return true
    },
    [createId, document, now, workspace],
  )

  const createTaskSession = useCallback(
    (taskId: string, startAt: string, endAt: string): boolean => {
      const id = createId()
      const result = workspace.execute(document, {
        type: 'create-task-session',
        id,
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
      setNotice({ tone: 'success', message: 'Session removed.' })
      return true
    },
    [createId, document, now, workspace],
  )

  const restore = useCallback(
    (raw: string): boolean => {
      const result = workspace.restore(raw)
      if (!result.ok) {
        setNotice({ tone: 'error', message: result.error.message })
        return false
      }
      setDocument(result.value)
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
    createFixedEvent,
    createProject,
    createSubtask,
    createTask,
    createTaskSession,
    deleteFixedEvent,
    deleteTaskSession,
    document,
    exportBackup,
    notice,
    restore,
    setTaskCompletion,
    updateTaskConstraints,
  }
}
