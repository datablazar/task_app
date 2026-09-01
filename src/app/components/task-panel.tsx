import { useEffect, useMemo, useState } from "react"
import type { FormEvent } from "react"
import type {
  DeadlineStrictness,
  Dependency,
  Priority,
  Project,
  Schedule,
  Task,
} from "../../domain/model"

interface TaskPanelProps {
  hidden: boolean
  task: Task | undefined
  projects: Project[]
  schedules: Schedule[]
  dependencies: Dependency[]
  allTasks: Task[]
  onClose: () => void
  onUpdateTask: (
    taskId: string,
    updates: {
      title?: string
      estimateMinutes?: number
      dueAt?: string
      earliestStartAt?: string
      priority?: Priority
      deadlineStrictness?: DeadlineStrictness
      scheduleId?: string
      notes?: string
    },
  ) => boolean
  onSetTaskCompletion: (taskId: string, completed: boolean) => void
  onCreateSubtask: (projectId: string, parentTaskId: string, title: string) => boolean
  onDeleteTask: (taskId: string) => boolean
  onMoveTask: (taskId: string, targetProjectId: string) => boolean
  onTriggerAi?: (task: Task) => void
  onCreateDependency?: (fromTaskId: string, toTaskId: string) => boolean
  onDeleteDependency?: (dependencyId: string) => boolean
}

export const TaskPanel = ({
  hidden,
  task,
  projects,
  schedules,
  dependencies,
  allTasks,
  onClose,
  onUpdateTask,
  onSetTaskCompletion,
  onCreateSubtask,
  onDeleteTask,
  onMoveTask,
  onTriggerAi,
  onCreateDependency,
  onDeleteDependency,
}: TaskPanelProps) => {
  // Buffered draft state for Title and Notes
  const [draftTitle, setDraftTitle] = useState(task?.title ?? "")
  const [draftNotes, setDraftNotes] = useState(task?.notes ?? "")
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("")
  const [isAddingSubtask, setIsAddingSubtask] = useState(false)
  const [selectedPrereqId, setSelectedPrereqId] = useState("")
  const [isEditingConstraints, setIsEditingConstraints] = useState(false)
  const [editMinutes, setEditMinutes] = useState(task?.estimateMinutes ? String(task.estimateMinutes) : "")
  const [editDueAt, setEditDueAt] = useState(task?.dueAt ? task.dueAt.slice(0, 10) : "")

  // Sync draft states when selected task changes
  useEffect(() => {
    if (task) {
      setDraftTitle(task.title)
      setDraftNotes(task.notes ?? "")
      setEditMinutes(task.estimateMinutes ? String(task.estimateMinutes) : "")
      setEditDueAt(task.dueAt ? task.dueAt.slice(0, 10) : "")
      setIsAddingSubtask(false)
      setIsEditingConstraints(false)
    }
  }, [task?.id])

  const commitTitle = () => {
    if (task && draftTitle.trim() && draftTitle.trim() !== task.title) {
      onUpdateTask(task.id, { title: draftTitle.trim() })
    }
  }

  const commitNotes = () => {
    if (task && draftNotes !== (task.notes ?? "")) {
      onUpdateTask(task.id, { notes: draftNotes })
    }
  }

  const handleSubtaskSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!task || !newSubtaskTitle.trim()) return
    if (onCreateSubtask(task.projectId, task.id, newSubtaskTitle.trim())) {
      setNewSubtaskTitle("")
      setIsAddingSubtask(false)
    }
  }

  const handleConstraintsSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!task) return
    const parsedMinutes = editMinutes.trim() ? parseInt(editMinutes, 10) : undefined
    const parsedDue = editDueAt.trim() ? `${editDueAt.trim()}T23:59:59.000Z` : undefined

    onUpdateTask(task.id, {
      estimateMinutes: parsedMinutes,
      dueAt: parsedDue,
    })

    if (selectedPrereqId && onCreateDependency) {
      onCreateDependency(selectedPrereqId, task.id)
      setSelectedPrereqId("")
    }

    setIsEditingConstraints(false)
  }

  const subtasks = useMemo(() => {
    if (!task) return []
    return allTasks.filter((t) => t.parentTaskId === task.id)
  }, [allTasks, task?.id])

  const project = useMemo(() => {
    if (!task) return undefined
    return projects.find((p) => p.id === task.projectId)
  }, [projects, task?.projectId])

  const schedule = useMemo(() => {
    if (!task) return undefined
    return schedules.find((s) => s.id === task.scheduleId) ?? schedules.find((s) => s.isDefault)
  }, [schedules, task?.scheduleId])

  const prereqs = useMemo(() => {
    if (!task) return []
    return dependencies
      .filter((d) => d.toTaskId === task.id)
      .map((d) => ({
        dependencyId: d.id,
        fromTask: allTasks.find((t) => t.id === d.fromTaskId),
      }))
      .filter((item) => item.fromTask !== undefined)
  }, [allTasks, dependencies, task?.id])

  const availablePrereqs = useMemo(() => {
    if (!task) return []
    const existing = new Set(dependencies.filter((d) => d.toTaskId === task.id).map((d) => d.fromTaskId))
    return allTasks.filter((t) => t.id !== task.id && !existing.has(t.id) && !t.parentTaskId)
  }, [allTasks, dependencies, task?.id])

  const isDeadlineRisk = Boolean(
    task &&
      task.deadlineStrictness === "hard" &&
      task.dueAt &&
      !task.completed,
  )

  if (hidden || !task) {
    return <aside aria-label="Task Inspector" className="task-panel" hidden={true} />
  }

  return (
    <aside aria-label="Task Inspector" className="task-panel">
      <div className="task-panel__header">
        <div className="task-panel__badge-row">
          {isDeadlineRisk ? (
            <span className="deadline-risk-badge">DEADLINE RISK</span>
          ) : (
            <span className="task-details-badge">TASK DETAILS</span>
          )}
        </div>
        <button
          aria-label="Close task inspector"
          className="modal-close-btn"
          onClick={onClose}
          type="button"
        >
          ×
        </button>
      </div>

      <div className="task-inspector-body">
        <div className="task-title-wrapper">
          <input
            aria-label="Task title"
            className="task-title-input"
            onBlur={commitTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                commitTitle()
                e.currentTarget.blur()
              }
            }}
            placeholder="Task title"
            value={draftTitle}
          />
        </div>

        <div className="task-metadata-chips" role="group" aria-label="Task properties">
          {project ? (
            <span className="meta-chip meta-chip--project">
              <span
                aria-hidden="true"
                className="meta-chip__dot"
                style={{ backgroundColor: project.color ?? "#e0533c" }}
              />
              {project.title}
            </span>
          ) : null}

          <button
            className="meta-chip meta-chip--editable"
            onClick={() => setIsEditingConstraints(true)}
            title="Edit duration and deadline"
            type="button"
          >
            ⏱ {task.estimateMinutes ? `${task.estimateMinutes}m` : "Add duration"}
            {task.dueAt ? ` · ${new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric" }).format(new Date(task.dueAt))}` : ""}
          </button>

          <select
            aria-label="Priority"
            className={`meta-chip-select meta-chip-select--${task.priority ?? "medium"}`}
            onChange={(e) => onUpdateTask(task.id, { priority: e.target.value as Priority })}
            value={task.priority ?? "medium"}
          >
            <option value="asap">🔥 ASAP</option>
            <option value="high">⚡ High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          <select
            aria-label="Deadline Strictness"
            className="meta-chip-select"
            onChange={(e) =>
              onUpdateTask(task.id, { deadlineStrictness: e.target.value as DeadlineStrictness })
            }
            value={task.deadlineStrictness ?? "soft"}
          >
            <option value="soft">Soft Target</option>
            <option value="hard">Hard Deadline</option>
          </select>

          {schedule ? (
            <span className="meta-chip meta-chip--schedule">
              🗓 {schedule.name}
            </span>
          ) : null}

          {onTriggerAi ? (
            <button
              aria-label={`AI assistance for ${task.title}`}
              className="meta-chip meta-chip--ai"
              onClick={() => onTriggerAi(task)}
              type="button"
            >
              ✨ AI Assist
            </button>
          ) : null}
        </div>

        {/* Subtasks Checklist */}
        <div className="inspector-section">
          <h3 className="inspector-section__title">SUBTASKS</h3>
          <ul className="inspector-subtask-list">
            {subtasks.map((subtask) => (
              <li key={subtask.id} className="inspector-subtask-item">
                <label className="custom-checkbox-label">
                  <input
                    checked={subtask.completed}
                    className="custom-checkbox-input"
                    onChange={(e) => onSetTaskCompletion(subtask.id, e.target.checked)}
                    type="checkbox"
                  />
                  <span className="custom-checkbox-box" aria-hidden="true">
                    <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
                      <path
                        d="M1.5 5L4.5 8L10.5 2"
                        stroke="white"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                      />
                    </svg>
                  </span>
                  <span
                    className={
                      subtask.completed
                        ? "custom-checkbox-text is-completed"
                        : "custom-checkbox-text"
                    }
                  >
                    {subtask.title}
                  </span>
                </label>
              </li>
            ))}
          </ul>

          {isAddingSubtask ? (
            <form className="inline-subtask-form" onSubmit={handleSubtaskSubmit}>
              <input
                aria-label="New subtask title"
                autoFocus
                className="inline-subtask-input"
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                placeholder="Enter subtask name..."
                value={newSubtaskTitle}
              />
              <div className="inline-subtask-actions">
                <button
                  className="text-button"
                  onClick={() => setIsAddingSubtask(false)}
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
              className="add-subtask-dashed-btn"
              onClick={() => setIsAddingSubtask(true)}
              type="button"
            >
              + Add subtask
            </button>
          )}
        </div>

        {/* Prerequisites & Dependencies */}
        {prereqs.length > 0 ? (
          <div className="inspector-section">
            <h3 className="inspector-section__title">PREREQUISITES</h3>
            <div className="prereq-list">
              {prereqs.map((p) => (
                <span className="meta-chip meta-chip--prereq" key={p.dependencyId}>
                  🔗 After: {p.fromTask?.title}
                  {onDeleteDependency ? (
                    <button
                      aria-label={`Remove dependency on ${p.fromTask?.title}`}
                      className="task-dep-remove"
                      onClick={() => onDeleteDependency(p.dependencyId)}
                      type="button"
                    >
                      ×
                    </button>
                  ) : null}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {/* Notes */}
        <div className="inspector-section">
          <h3 className="inspector-section__title">NOTES</h3>
          <textarea
            aria-label="Task notes"
            className="inspector-notes-textarea"
            onBlur={commitNotes}
            onChange={(e) => setDraftNotes(e.target.value)}
            placeholder="Add context or a link..."
            rows={4}
            value={draftNotes}
          />
        </div>

        {/* Action Controls */}
        <div className="inspector-actions-footer">
          <button
            className="button button--secondary button--small"
            onClick={() => onSetTaskCompletion(task.id, !task.completed)}
            type="button"
          >
            {task.completed ? "Reopen Task" : "✓ Mark Complete"}
          </button>
          {projects.length > 1 ? (
            <select
              aria-label="Move task to project"
              className="meta-chip-select"
              onChange={(e) => onMoveTask(task.id, e.target.value)}
              value={task.projectId}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  📁 Move to: {p.title}
                </option>
              ))}
            </select>
          ) : null}
          <button
            aria-label={`Delete task ${task.title}`}
            className="button button--danger button--small"
            onClick={() => {
              onDeleteTask(task.id)
              onClose()
            }}
            type="button"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Constraints Modal */}
      {isEditingConstraints ? (
        <div aria-modal="true" className="calendar-dialog-overlay" role="dialog">
          <div className="calendar-dialog">
            <h2>Task Constraints & Scheduling</h2>
            <p className="calendar-dialog__sub">{task.title}</p>
            <form onSubmit={handleConstraintsSubmit}>
              <div className="calendar-dialog__field">
                <label htmlFor="inspector-constraint-duration">Estimated duration (minutes)</label>
                <input
                  id="inspector-constraint-duration"
                  max={1440}
                  min={1}
                  onChange={(e) => setEditMinutes(e.target.value)}
                  placeholder="e.g. 30, 60, 90"
                  type="number"
                  value={editMinutes}
                />
              </div>

              <div className="calendar-dialog__field">
                <label htmlFor="inspector-constraint-due">Deadline / Due date</label>
                <input
                  id="inspector-constraint-due"
                  onChange={(e) => setEditDueAt(e.target.value)}
                  type="date"
                  value={editDueAt}
                />
              </div>

              {availablePrereqs.length > 0 ? (
                <div className="calendar-dialog__field">
                  <label htmlFor="inspector-constraint-prereq">Depends on prerequisite task</label>
                  <select
                    id="inspector-constraint-prereq"
                    onChange={(e) => setSelectedPrereqId(e.target.value)}
                    value={selectedPrereqId}
                  >
                    <option value="">None / No additional prerequisite</option>
                    {availablePrereqs.map((opt) => (
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
                  onClick={() => setIsEditingConstraints(false)}
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
    </aside>
  )
}
