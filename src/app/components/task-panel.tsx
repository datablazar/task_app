import type { FormEvent } from 'react'
import { useMemo, useState } from 'react'
import { BackupControls } from './backup-controls'
import type { Project, Task, TaskSession } from '../../domain/model'

interface TaskPanelProps {
  onCreateTask: (projectId: string, title: string) => boolean
  onCreateSubtask?: (projectId: string, parentTaskId: string, title: string) => boolean
  onUpdateTaskConstraints?: (
    taskId: string,
    constraints: { estimateMinutes?: number; dueAt?: string; earliestStartAt?: string },
  ) => boolean
  onExport: () => void
  onImport: (file: File) => void
  onSelectTaskId?: (taskId: string) => void
  onSetTaskCompletion: (taskId: string, completed: boolean) => void
  project: Project | undefined
  selectedTaskId?: string | null
  taskSessions?: TaskSession[]
  tasks: Task[]
}

export const TaskPanel = ({
  onCreateTask,
  onCreateSubtask,
  onUpdateTaskConstraints,
  onExport,
  onImport,
  onSelectTaskId,
  onSetTaskCompletion,
  project,
  selectedTaskId,
  taskSessions = [],
  tasks,
}: TaskPanelProps) => {
  const [title, setTitle] = useState('')
  const [activeSubtaskParentId, setActiveSubtaskParentId] = useState<string | null>(null)
  const [subtaskTitle, setSubtaskTitle] = useState('')

  // Constraint editing state
  const [editingConstraintTaskId, setEditingConstraintTaskId] = useState<string | null>(null)
  const [editMinutes, setEditMinutes] = useState<string>('')
  const [editDueAt, setEditDueAt] = useState<string>('')

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
  }

  const submitConstraints = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingConstraintTaskId || !onUpdateTaskConstraints) return

    const parsedMinutes = editMinutes.trim() ? parseInt(editMinutes, 10) : undefined
    const parsedDueAt = editDueAt.trim()
      ? new Date(`${editDueAt.trim()}T23:59:59.000Z`).toISOString()
      : undefined

    onUpdateTaskConstraints(editingConstraintTaskId, {
      estimateMinutes: parsedMinutes,
      dueAt: parsedDueAt,
    })
    setEditingConstraintTaskId(null)
  }

  const sessionCountByTask = useMemo(() => {
    const map = new Map<string, number>()
    for (const session of taskSessions) {
      map.set(session.taskId, (map.get(session.taskId) ?? 0) + 1)
    }
    return map
  }, [taskSessions])

  const topLevelTasks = useMemo(() => tasks.filter((t) => !t.parentTaskId), [tasks])

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

              {sessionCount > 0 ? (
                <span className="task-badge" title={`${sessionCount} session(s) scheduled`}>
                  {sessionCount} scheduled
                </span>
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

  return (
    <aside className="task-panel" aria-labelledby="selected-project-heading">
      {project ? (
        <>
          <h2 id="selected-project-heading">{project.title}</h2>
          <section aria-labelledby="tasks-heading" className="tasks-section">
            <h3 id="tasks-heading">Tasks</h3>
            {topLevelTasks.length > 0 ? (
              <ul className="task-list">
                {topLevelTasks.map((task) => renderTaskItem(task, false))}
              </ul>
            ) : (
              <p className="empty-tasks">Add the first task for this project.</p>
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
          <h2 id="selected-project-heading">Start with a project</h2>
          <p>Create a project, then add its first task here.</p>
        </div>
      )}

      {/* Constraints Modal */}
      {editingTask ? (
        <div aria-modal="true" className="calendar-dialog-overlay" role="dialog">
          <div className="calendar-dialog">
            <h2>Task Constraints</h2>
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
