import type { FormEvent } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { BackupControls } from './backup-controls'
import type { Dependency, Project, Task, TaskSession } from '../../domain/model'

interface TaskPanelProps {
  focusToken: number
  hidden: boolean
  onCreateTask: (projectId: string, title: string) => boolean
  onCreateSubtask?: (projectId: string, parentTaskId: string, title: string) => boolean
  onUpdateTaskConstraints?: (
    taskId: string,
    constraints: { estimateMinutes?: number; dueAt?: string; earliestStartAt?: string },
  ) => boolean
  onCreateDependency?: (fromTaskId: string, toTaskId: string) => boolean
  onDeleteDependency?: (dependencyId: string) => boolean
  onExport: () => void
  onImport: (file: File) => void
  onSelectTaskId?: (taskId: string) => void
  onSetTaskCompletion: (taskId: string, completed: boolean) => void
  onTriggerAi?: (task: Task) => void
  project: Project | undefined
  selectedTaskId?: string | null
  taskSessions?: TaskSession[]
  dependencies?: Dependency[]
  tasks: Task[]
}

export const TaskPanel = ({
  focusToken,
  hidden,
  onCreateTask,
  onCreateSubtask,
  onUpdateTaskConstraints,
  onCreateDependency,
  onDeleteDependency,
  onExport,
  onImport,
  onSelectTaskId,
  onSetTaskCompletion,
  onTriggerAi,
  project,
  selectedTaskId,
  taskSessions = [],
  dependencies = [],
  tasks,
}: TaskPanelProps) => {
  const [title, setTitle] = useState('')
  const [activeSubtaskParentId, setActiveSubtaskParentId] = useState<string | null>(null)
  const [subtaskTitle, setSubtaskTitle] = useState('')
  const headingRef = useRef<HTMLHeadingElement>(null)

  // The panel stays mounted at all times (so a closed draft isn't lost).
  // `focusToken` only increments at the moment of a real desktop-open
  // action (see planner-app.tsx), so it never fires from a resize or from
  // the always-on mobile layout the way a derived `isDesktop && isOpen`
  // boolean would.
  useEffect(() => {
    if (focusToken > 0) {
      headingRef.current?.focus()
    }
  }, [focusToken])

  // Constraint editing state
  const [editingConstraintTaskId, setEditingConstraintTaskId] = useState<string | null>(null)
  const [editMinutes, setEditMinutes] = useState<string>('')
  const [editDueAt, setEditDueAt] = useState<string>('')
  const [selectedPrereqId, setSelectedPrereqId] = useState<string>('')

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (project && onCreateTask(project.id, title)) {
      setTitle('')
    }
  }

  const submitSubtask = (event: FormEvent<HTMLFormElement>, parentId: string) => {
    event.preventDefault()
    if (project && onCreateSubtask && onCreateSubtask(project.id, parentId, subtaskTitle)) {
      setSubtaskTitle('')
      setActiveSubtaskParentId(null)
    }
  }

  const openConstraintEditor = (task: Task) => {
    setEditingConstraintTaskId(task.id)
    setEditMinutes(task.estimateMinutes ? String(task.estimateMinutes) : '')
    setEditDueAt(task.dueAt ? task.dueAt.slice(0, 10) : '')
    setSelectedPrereqId('')
  }

  const submitConstraints = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingConstraintTaskId) return

    if (onUpdateTaskConstraints) {
      const parsedMinutes = editMinutes.trim() ? parseInt(editMinutes, 10) : undefined
      const parsedDueAt = editDueAt.trim()
        ? new Date(`${editDueAt.trim()}T23:59:59.000Z`).toISOString()
        : undefined

      onUpdateTaskConstraints(editingConstraintTaskId, {
        estimateMinutes: parsedMinutes,
        dueAt: parsedDueAt,
      })
    }

    if (selectedPrereqId && onCreateDependency) {
      onCreateDependency(selectedPrereqId, editingConstraintTaskId)
    }

    setEditingConstraintTaskId(null)
  }

  const sessionCountByTask = useMemo(() => {
    const map = new Map<string, number>()
    for (const session of taskSessions) {
      map.set(session.taskId, (map.get(session.taskId) ?? 0) + 1)
    }
    return map
  }, [taskSessions])

  const taskMap = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks])

  const prerequisitesByTaskId = useMemo(() => {
    const map = new Map<string, { dependencyId: string; fromTask: Task }[]>()
    for (const dep of dependencies) {
      const from = taskMap.get(dep.fromTaskId)
      if (from) {
        const list = map.get(dep.toTaskId) ?? []
        list.push({ dependencyId: dep.id, fromTask: from })
        map.set(dep.toTaskId, list)
      }
    }
    return map
  }, [dependencies, taskMap])

  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'scheduled' | 'due-soon' | 'completed'>('all')

  const filteredTopLevelTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (t.parentTaskId) return false

      if (searchQuery.trim()) {
        const matchesQuery = t.title.toLowerCase().includes(searchQuery.toLowerCase().trim())
        if (!matchesQuery) return false
      }

      const sessionCount = sessionCountByTask.get(t.id) ?? 0
      switch (filterStatus) {
        case 'active':
          return !t.completed
        case 'completed':
          return t.completed
        case 'scheduled':
          return sessionCount > 0
        case 'due-soon':
          return Boolean(t.dueAt) && !t.completed
        case 'all':
        default:
          return true
      }
    })
  }, [filterStatus, searchQuery, sessionCountByTask, tasks])

  const subtasksByParent = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const task of tasks) {
      if (task.parentTaskId) {
        const list = map.get(task.parentTaskId) ?? []
        list.push(task)
        map.set(task.parentTaskId, list)
      }
    }
    return map
  }, [tasks])

  const renderTaskItem = (task: Task, isSubtask = false) => {
    const sessionCount = sessionCountByTask.get(task.id) ?? 0
    const isSelected = selectedTaskId === task.id
    const childSubtasks = subtasksByParent.get(task.id) ?? []
    const prereqs = prerequisitesByTaskId.get(task.id) ?? []

    return (
      <li key={task.id} className={isSubtask ? 'subtask-item' : 'task-item'}>
        <div className={`task-card ${isSelected ? 'is-selected' : ''}`}>
          <div className="task-card__main">
            <label className={task.completed ? 'task-row is-completed' : 'task-row'}>
              <input
                checked={task.completed}
                onChange={(event) => onSetTaskCompletion(task.id, event.target.checked)}
                type="checkbox"
              />
              <span
                className="task-title"
                onClick={() => onSelectTaskId?.(task.id)}
                style={{ cursor: 'pointer' }}
              >
                {task.title}
              </span>
              <span className="visually-hidden">
                {task.completed ? 'Completed' : 'Open'} {isSubtask ? 'subtask' : 'task'}
              </span>
            </label>

            <div className="task-card__meta">
              {task.estimateMinutes ? (
                <span className="task-constraint-badge" title="Estimated duration">
                  ⏱ {task.estimateMinutes}m
                </span>
              ) : null}

              {task.dueAt ? (
                <span className="task-constraint-badge" title="Deadline">
                  📅 {new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(task.dueAt))}
                </span>
              ) : null}

              {prereqs.map((prereq) => (
                <span className="task-constraint-badge" key={prereq.dependencyId} title="Prerequisite task">
                  🔗 After: {prereq.fromTask.title}
                  {onDeleteDependency ? (
                    <button
                      aria-label={`Remove dependency on ${prereq.fromTask.title}`}
                      className="task-dep-remove"
                      onClick={() => onDeleteDependency(prereq.dependencyId)}
                      type="button"
                    >
                      ×
                    </button>
                  ) : null}
                </span>
              ))}

              {sessionCount > 0 ? (
                <span className="task-badge" title={`${sessionCount} session(s) scheduled`}>
                  {sessionCount} scheduled
                </span>
              ) : null}

              {onTriggerAi && !isSubtask ? (
                <button
                  aria-label={`AI assistance for ${task.title}`}
                  className="task-ai-btn"
                  onClick={() => onTriggerAi(task)}
                  title="AI Assist & Proposals"
                  type="button"
                >
                  ✨ AI
                </button>
              ) : null}

              <button
                aria-label={`Edit constraints for ${task.title}`}
                className="task-edit-btn"
                onClick={() => openConstraintEditor(task)}
                type="button"
              >
                Details
              </button>
            </div>
          </div>

          {!isSubtask ? (
            <div className="subtasks-container">
              {childSubtasks.length > 0 ? (
                <ul className="subtask-list">
                  {childSubtasks.map((subtask) => renderTaskItem(subtask, true))}
                </ul>
              ) : null}

              {activeSubtaskParentId === task.id ? (
                <form
                  className="subtask-form"
                  onSubmit={(e) => submitSubtask(e, task.id)}
                >
                  <label className="visually-hidden" htmlFor={`subtask-input-${task.id}`}>
                    Add subtask to {task.title}
                  </label>
                  <input
                    id={`subtask-input-${task.id}`}
                    maxLength={200}
                    onChange={(e) => setSubtaskTitle(e.target.value)}
                    placeholder="Add a subtask"
                    value={subtaskTitle}
                  />
                  <div className="subtask-form__actions">
                    <button
                      className="text-button"
                      onClick={() => setActiveSubtaskParentId(null)}
                      type="button"
                    >
                      Cancel
                    </button>
                    <button className="button button--primary button--small" type="submit">
                      Add
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  className="add-subtask-toggle"
                  onClick={() => {
                    setActiveSubtaskParentId(task.id)
                    setSubtaskTitle('')
                  }}
                  type="button"
                >
                  + Add subtask
                </button>
              )}
            </div>
          ) : null}
        </div>
      </li>
    )
  }

  const editingTask = editingConstraintTaskId
    ? tasks.find((t) => t.id === editingConstraintTaskId)
    : null

  const availablePrereqOptions = useMemo(() => {
    if (!editingTask) return []
    const existingPrereqIds = new Set(
      dependencies.filter((d) => d.toTaskId === editingTask.id).map((d) => d.fromTaskId),
    )
    return tasks.filter(
      (t) => t.id !== editingTask.id && !existingPrereqIds.has(t.id),
    )
  }, [dependencies, editingTask, tasks])

  return (
    <aside aria-labelledby="selected-project-heading" className="task-panel" hidden={hidden}>
      {project ? (
        <>
          <h2 id="selected-project-heading" ref={headingRef} tabIndex={-1}>
            {project.title}
          </h2>
          <section aria-labelledby="tasks-heading" className="tasks-section">
            <div className="tasks-section__header">
              <h3 id="tasks-heading">Tasks</h3>
              <div className="task-search-wrapper">
                <input
                  aria-label="Search tasks"
                  className="task-search-input"
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter tasks..."
                  type="search"
                  value={searchQuery}
                />
              </div>
            </div>

            <div className="task-filter-chips" role="group" aria-label="Filter tasks by status">
              <button
                className={`task-filter-chip ${filterStatus === 'all' ? 'is-active' : ''}`}
                onClick={() => setFilterStatus('all')}
                type="button"
              >
                All
              </button>
              <button
                className={`task-filter-chip ${filterStatus === 'active' ? 'is-active' : ''}`}
                onClick={() => setFilterStatus('active')}
                type="button"
              >
                Active
              </button>
              <button
                className={`task-filter-chip ${filterStatus === 'scheduled' ? 'is-active' : ''}`}
                onClick={() => setFilterStatus('scheduled')}
                type="button"
              >
                Scheduled
              </button>
              <button
                className={`task-filter-chip ${filterStatus === 'due-soon' ? 'is-active' : ''}`}
                onClick={() => setFilterStatus('due-soon')}
                type="button"
              >
                Due Soon
              </button>
              <button
                className={`task-filter-chip ${filterStatus === 'completed' ? 'is-active' : ''}`}
                onClick={() => setFilterStatus('completed')}
                type="button"
              >
                Done
              </button>
            </div>

            {filteredTopLevelTasks.length > 0 ? (
              <ul className="task-list">
                {filteredTopLevelTasks.map((task) => renderTaskItem(task, false))}
              </ul>
            ) : (
              <p className="empty-tasks">
                {searchQuery.trim() || filterStatus !== 'all'
                  ? 'No tasks match current filter.'
                  : 'Add the first task for this project.'}
              </p>
            )}
            <form className="task-form" onSubmit={submit}>
              <label className="visually-hidden" htmlFor="new-task-title">
                Add a task to {project.title}
              </label>
              <input
                id="new-task-title"
                maxLength={200}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Add a task"
                title="Type a task and press Enter to add it"
                value={title}
              />
              <button className="visually-hidden" type="submit">
                Add task
              </button>
            </form>
          </section>
        </>
      ) : (
        <div className="no-project-selected">
          <h2 id="selected-project-heading" ref={headingRef} tabIndex={-1}>
            Start with a project
          </h2>
          <p>Create a project, then add its first task here.</p>
        </div>
      )}

      {/* Constraints Modal */}
      {editingTask ? (
        <div aria-modal="true" className="calendar-dialog-overlay" role="dialog">
          <div className="calendar-dialog">
            <h2>Task Constraints & Dependencies</h2>
            <p className="calendar-dialog__sub">{editingTask.title}</p>
            <form onSubmit={submitConstraints}>
              <div className="calendar-dialog__field">
                <label htmlFor="constraint-duration">Estimated duration (minutes)</label>
                <input
                  id="constraint-duration"
                  max={1440}
                  min={1}
                  onChange={(e) => setEditMinutes(e.target.value)}
                  placeholder="e.g. 30, 60, 90"
                  type="number"
                  value={editMinutes}
                />
              </div>

              <div className="calendar-dialog__field">
                <label htmlFor="constraint-due">Deadline / Due date</label>
                <input
                  id="constraint-due"
                  onChange={(e) => setEditDueAt(e.target.value)}
                  type="date"
                  value={editDueAt}
                />
              </div>

              {availablePrereqOptions.length > 0 ? (
                <div className="calendar-dialog__field">
                  <label htmlFor="constraint-prereq">Depends on prerequisite task</label>
                  <select
                    id="constraint-prereq"
                    onChange={(e) => setSelectedPrereqId(e.target.value)}
                    value={selectedPrereqId}
                  >
                    <option value="">None / No additional prerequisite</option>
                    {availablePrereqOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.title}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div className="calendar-dialog__actions">
                <button
                  className="text-button"
                  onClick={() => setEditingConstraintTaskId(null)}
                  type="button"
                >
                  Cancel
                </button>
                <button className="button button--primary button--small" type="submit">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <BackupControls className="mobile-backup-actions" compact onExport={onExport} onImport={onImport} />
    </aside>
  )
}
