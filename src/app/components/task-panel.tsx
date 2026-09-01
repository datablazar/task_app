import type { FormEvent } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { BackupControls } from './backup-controls'
import type {
  DeadlineType,
  Dependency,
  Project,
  Schedule,
  Task,
  TaskPriority,
  TaskSession,
} from '../../domain/model'

interface TaskPanelProps {
  focusToken: number
  hidden: boolean
  allProjects?: Project[]
  schedules?: Schedule[]
  onCreateTask: (projectId: string, title: string) => boolean
  onCreateSubtask?: (projectId: string, parentTaskId: string, title: string) => boolean
  onUpdateTaskConstraints?: (
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
  allProjects = [],
  schedules = [],
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

  // Constraint and metadata editing state
  const [editingConstraintTaskId, setEditingConstraintTaskId] = useState<string | null>(null)
  const [editMinutes, setEditMinutes] = useState<string>('')
  const [editDueAt, setEditDueAt] = useState<string>('')
  const [editPriority, setEditPriority] = useState<TaskPriority>('MEDIUM')
  const [editDeadlineType, setEditDeadlineType] = useState<DeadlineType>('SOFT')
  const [editDescription, setEditDescription] = useState<string>('')
  const [editLabels, setEditLabels] = useState<string>('')
  const [editScheduleId, setEditScheduleId] = useState<string>('')
  const [editTargetProjectId, setEditTargetProjectId] = useState<string>('')
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
    setEditPriority(task.priority ?? 'MEDIUM')
    setEditDeadlineType(task.deadlineType ?? (task.dueAt ? 'SOFT' : 'NONE'))
    setEditDescription(task.description ?? '')
    setEditLabels(task.labels && task.labels.length > 0 ? task.labels.join(', ') : '')
    setEditScheduleId(task.scheduleId ?? '')
    setEditTargetProjectId(task.projectId)
    setSelectedPrereqId('')
  }

  const submitConstraints = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingConstraintTaskId) return

    const task = tasks.find((t) => t.id === editingConstraintTaskId)
    if (!task) return

    if (onUpdateTaskConstraints) {
      const parsedMinutes = editMinutes.trim() ? parseInt(editMinutes, 10) : undefined
      const parsedDueAt = editDueAt.trim()
        ? new Date(`${editDueAt.trim()}T23:59:59.000Z`).toISOString()
        : undefined
      const parsedLabels = editLabels
        .split(',')
        .map((l) => l.trim())
        .filter(Boolean)

      onUpdateTaskConstraints(editingConstraintTaskId, {
        estimateMinutes: parsedMinutes,
        dueAt: parsedDueAt,
        priority: editPriority,
        deadlineType: editDeadlineType,
        description: editDescription.trim() || undefined,
        labels: parsedLabels,
        scheduleId: editScheduleId || undefined,
        targetProjectId: editTargetProjectId !== task.projectId ? editTargetProjectId : undefined,
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
        const query = searchQuery.toLowerCase().trim()
        const strippedQuery = query.replace(/^[#!]/, '')
        const matchesTitle = t.title.toLowerCase().includes(query)
        const matchesDesc = t.description ? t.description.toLowerCase().includes(query) : false
        const matchesLabels = t.labels ? t.labels.some((l) => l.toLowerCase().includes(strippedQuery)) : false
        const matchesPriority = t.priority ? t.priority.toLowerCase() === strippedQuery : false

        if (!matchesTitle && !matchesDesc && !matchesLabels && !matchesPriority) {
          return false
        }
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
              {task.priority ? (
                <span
                  className={`task-priority-badge task-priority-badge--${task.priority.toLowerCase()}`}
                  title={`Priority: ${task.priority}`}
                >
                  {task.priority === 'ASAP' ? '🔥 ASAP' : task.priority === 'HIGH' ? '⚡ High' : task.priority === 'LOW' ? 'Low' : 'Med'}
                </span>
              ) : null}

              {task.estimateMinutes ? (
                <span className="task-constraint-badge" title="Estimated duration">
                  ⏱ {task.estimateMinutes}m
                </span>
              ) : null}

              {task.dueAt ? (
                <span
                  className={`task-constraint-badge ${task.deadlineType === 'HARD' ? 'task-deadline-badge--hard' : ''}`}
                  title={`Deadline (${task.deadlineType ?? 'SOFT'})`}
                >
                  📅 {new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(task.dueAt))}
                  {task.deadlineType === 'HARD' ? ' (Hard)' : ''}
                </span>
              ) : null}

              {task.labels && task.labels.length > 0
                ? task.labels.map((label) => (
                    <span
                      key={label}
                      className="task-label-badge"
                      onClick={() => setSearchQuery(label)}
                      style={{ cursor: 'pointer' }}
                      title={`Filter by tag: #${label}`}
                    >
                      #{label}
                    </span>
                  ))
                : null}

              {task.scheduleId ? (
                (() => {
                  const sched = schedules.find((s) => s.id === task.scheduleId)
                  return sched ? (
                    <span className="task-constraint-badge" title={`Assigned Schedule: ${sched.title}`}>
                      🗓 {sched.title}
                    </span>
                  ) : null
                })()
              ) : null}

              {task.recurrenceRuleId ? (
                <span className="task-constraint-badge" title={`Recurring Task Instance (${task.recurrenceInstanceDate ?? ''})`}>
                  🔁 Recurring
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
            {task.description ? (
              <div className="task-description-preview" title={task.description}>
                {task.description.length > 90 ? `${task.description.slice(0, 90)}…` : task.description}
              </div>
            ) : null}
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

      {/* Constraints & Details Modal */}
      {editingTask ? (
        <div
          aria-modal="true"
          className="calendar-dialog-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setEditingConstraintTaskId(null)
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setEditingConstraintTaskId(null)
            }
          }}
          role="dialog"
        >
          <div className="calendar-dialog">
            <h2>Task Details & Constraints</h2>
            <p className="calendar-dialog__sub">{editingTask.title}</p>
            <form onSubmit={submitConstraints}>
              <div className="calendar-dialog__field">
                <label htmlFor="constraint-priority">Priority</label>
                <select
                  id="constraint-priority"
                  onChange={(e) => setEditPriority(e.target.value as TaskPriority)}
                  value={editPriority}
                >
                  <option value="ASAP">🔥 ASAP (Highest priority)</option>
                  <option value="HIGH">⚡ High</option>
                  <option value="MEDIUM">Medium (Normal)</option>
                  <option value="LOW">Low</option>
                </select>
              </div>

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

              <div className="calendar-dialog__field">
                <label htmlFor="constraint-deadline-type">Deadline strictness</label>
                <select
                  id="constraint-deadline-type"
                  onChange={(e) => setEditDeadlineType(e.target.value as DeadlineType)}
                  value={editDeadlineType}
                >
                  <option value="SOFT">Soft (Preferred target)</option>
                  <option value="HARD">Hard (Strict drop-dead)</option>
                  <option value="NONE">None</option>
                </select>
              </div>

              <div className="calendar-dialog__field">
                <label htmlFor="constraint-description">Description / Notes</label>
                <textarea
                  id="constraint-description"
                  maxLength={2000}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Add notes, context, or links..."
                  rows={3}
                  value={editDescription}
                />
              </div>

              <div className="calendar-dialog__field">
                <label htmlFor="constraint-labels">Labels (comma-separated)</label>
                <input
                  id="constraint-labels"
                  onChange={(e) => setEditLabels(e.target.value)}
                  placeholder="e.g. frontend, urgent, client"
                  type="text"
                  value={editLabels}
                />
              </div>

              {schedules.length > 0 ? (
                <div className="calendar-dialog__field">
                  <label htmlFor="constraint-schedule">Availability Schedule</label>
                  <select
                    id="constraint-schedule"
                    onChange={(e) => setEditScheduleId(e.target.value)}
                    value={editScheduleId}
                  >
                    <option value="">Default Schedule ({schedules.find((s) => s.isDefault)?.title ?? 'Default'})</option>
                    {schedules.map((s) => (
                      <option key={s.id} value={s.id}>
                        🗓 {s.title} {s.isDefault ? '(Default)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {editingTask.recurrenceRuleId ? (
                <div className="calendar-dialog__field">
                  <span className="badge badge--secondary" style={{ padding: '0.4rem 0.6rem' }}>
                    🔁 Recurring Task Instance ({editingTask.recurrenceInstanceDate ?? 'pre-generated'})
                  </span>
                </div>
              ) : null}

              {allProjects.length > 1 ? (
                <div className="calendar-dialog__field">
                  <label htmlFor="constraint-project">Project</label>
                  <select
                    id="constraint-project"
                    onChange={(e) => setEditTargetProjectId(e.target.value)}
                    value={editTargetProjectId}
                  >
                    {allProjects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

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
