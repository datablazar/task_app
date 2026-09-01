import { useEffect, useMemo, useRef, useState } from "react"
import type { FormEvent } from "react"
import type { Dependency, Priority, Project, Task, TaskSession } from "../../domain/model"

interface ProjectPanelProps {
  focusToken: number
  hidden: boolean
  mode: "projects" | "inbox"
  onCloseDrawer: () => void
  onCreateProject: (title: string, color?: string) => Project | boolean | undefined
  onSelectProject: (projectId: string) => void
  projects: Project[]
  selectedProjectId: string | null
  taskCountByProject?: Map<string, number>
  tasks: Task[]
  dependencies?: Dependency[]
  taskSessions?: TaskSession[]
  selectedTaskId: string | null
  onSelectTaskId: (taskId: string) => void
  onSetTaskCompletion: (taskId: string, completed: boolean) => void
  onCreateTask: (projectId: string, title: string) => boolean
  onCreateSubtask?: (projectId: string, parentTaskId: string, title: string) => boolean
  onUpdateTask?: (
    taskId: string,
    updates: {
      title?: string
      estimateMinutes?: number
      dueAt?: string
      earliestStartAt?: string
      priority?: Priority
      notes?: string
    },
  ) => boolean
  onCreateDependency?: (fromTaskId: string, toTaskId: string) => boolean
  onTriggerAi?: (task: Task) => void
}

const colorPalette = ["#e0533c", "#3b7a57", "#8b5cf6", "#d97706", "#2563eb", "#db2777"]

export const ProjectPanel = ({
  focusToken,
  hidden,
  mode,
  onCloseDrawer,
  onCreateProject,
  onSelectProject,
  projects,
  selectedProjectId,
  taskCountByProject,
  tasks,
  dependencies = [],
  taskSessions = [],
  selectedTaskId,
  onSelectTaskId,
  onSetTaskCompletion,
  onCreateTask,
  onCreateSubtask,
  onUpdateTask,
  onCreateDependency,
  onTriggerAi,
}: ProjectPanelProps) => {
  const [isCreating, setIsCreating] = useState(false)
  const [title, setTitle] = useState("")
  const [selectedColor, setSelectedColor] = useState(colorPalette[0])
  const [inboxSearch, setInboxSearch] = useState("")
  const [inboxFilter, setInboxFilter] = useState<"all" | "active" | "scheduled" | "due-soon" | "completed">("all")
  const [newTaskTitle, setNewTaskTitle] = useState("")

  // Subtask adding state
  const [subtaskParentId, setSubtaskParentId] = useState<string | null>(null)
  const [subtaskTitle, setSubtaskTitle] = useState("")

  // Constraints Dialog state
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [constraintMinutes, setConstraintMinutes] = useState("")
  const [constraintDueAt, setConstraintDueAt] = useState("")
  const [constraintPrereqId, setConstraintPrereqId] = useState("")

  const inputRef = useRef<HTMLInputElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (isCreating) {
      inputRef.current?.focus()
    }
  }, [isCreating])

  useEffect(() => {
    if (focusToken > 0) {
      headingRef.current?.focus()
    }
  }, [focusToken])

  const selectedProject = useMemo(() => {
    return projects.find((p) => p.id === selectedProjectId) ?? projects[0]
  }, [projects, selectedProjectId])

  const submitProject = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (onCreateProject(title, selectedColor)) {
      setTitle("")
      setIsCreating(false)
      setSelectedColor(colorPalette[(projects.length + 1) % colorPalette.length])
    }
  }

  const submitTask = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const targetProjectId = selectedProject?.id ?? projects[0]?.id
    if (targetProjectId && newTaskTitle.trim()) {
      if (onCreateTask(targetProjectId, newTaskTitle.trim())) {
        setNewTaskTitle("")
      }
    }
  }

  const submitSubtask = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!subtaskParentId || !subtaskTitle.trim() || !selectedProject) return
    if (onCreateSubtask?.(selectedProject.id, subtaskParentId, subtaskTitle.trim())) {
      setSubtaskTitle("")
      setSubtaskParentId(null)
    }
  }

  const openConstraints = (task: Task) => {
    setEditingTask(task)
    setConstraintMinutes(task.estimateMinutes ? String(task.estimateMinutes) : "")
    setConstraintDueAt(task.dueAt ? task.dueAt.slice(0, 10) : "")
    setConstraintPrereqId("")
  }

  const submitConstraints = (e: FormEvent) => {
    e.preventDefault()
    if (!editingTask || !onUpdateTask) return
    const parsedMinutes = constraintMinutes.trim() ? parseInt(constraintMinutes, 10) : undefined
    const parsedDue = constraintDueAt.trim() ? `${constraintDueAt.trim()}T23:59:59.000Z` : undefined

    onUpdateTask(editingTask.id, {
      estimateMinutes: parsedMinutes,
      dueAt: parsedDue,
    })

    if (constraintPrereqId && onCreateDependency) {
      onCreateDependency(constraintPrereqId, editingTask.id)
    }

    setEditingTask(null)
  }

  const sessionCountByTask = useMemo(() => {
    const map = new Map<string, number>()
    for (const session of taskSessions) {
      map.set(session.taskId, (map.get(session.taskId) ?? 0) + 1)
    }
    return map
  }, [taskSessions])

  const projectTasks = useMemo(() => {
    if (!selectedProject) return []
    return tasks.filter((t) => t.projectId === selectedProject.id && !t.parentTaskId)
  }, [selectedProject, tasks])

  const filteredTasks = useMemo(() => {
    const base = mode === "projects" ? projectTasks : tasks.filter((t) => !t.parentTaskId)
    return base.filter((t) => {
      if (inboxSearch.trim()) {
        const matches = t.title.toLowerCase().includes(inboxSearch.toLowerCase().trim())
        if (!matches) return false
      }

      const sessionCount = sessionCountByTask.get(t.id) ?? 0
      switch (inboxFilter) {
        case "active":
          return !t.completed
        case "completed":
          return t.completed
        case "scheduled":
          return sessionCount > 0
        case "due-soon":
          return Boolean(t.dueAt) && !t.completed
        case "all":
        default:
          return true
      }
    })
  }, [inboxFilter, inboxSearch, mode, projectTasks, sessionCountByTask, tasks])

  const taskMap = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks])

  return (
    <aside aria-labelledby="left-drawer-heading" className="project-panel" hidden={hidden}>
      <div className="project-panel__header">
        <h2 id="left-drawer-heading" ref={headingRef} tabIndex={-1}>
          {mode === "projects" ? "Projects" : "Inbox & Tasks"}
        </h2>
        <button
          aria-label="Close drawer"
          className="modal-close-btn"
          onClick={onCloseDrawer}
          type="button"
        >
          ×
        </button>
      </div>

      {mode === "projects" ? (
        <>
          <nav aria-label="Your projects" className="project-nav">
            <ul className="project-list">
              {projects.map((project, idx) => {
                const count = taskCountByProject?.get(project.id) ?? 0
                const isSelected = project.id === selectedProject?.id
                const dotColor = project.color ?? colorPalette[idx % colorPalette.length]

                return (
                  <li key={project.id}>
                    <button
                      aria-current={isSelected ? "page" : undefined}
                      className={isSelected ? "project-item is-active is-selected" : "project-item"}
                      onClick={() => onSelectProject(project.id)}
                      type="button"
                    >
                      <span className="project-item__name">
                        <span
                          aria-hidden="true"
                          className="project-item__dot"
                          style={{ backgroundColor: dotColor }}
                        />
                        {project.title}
                      </span>
                      <span className="project-item__count">{count}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </nav>

          {isCreating ? (
            <form className="project-form" onSubmit={submitProject}>
              <label className="visually-hidden" htmlFor="new-project-title">
                Project name
              </label>
              <input
                id="new-project-title"
                maxLength={200}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Project name"
                ref={inputRef}
                required
                value={title}
              />
              <div className="project-form__color-picker" role="group" aria-label="Select project color">
                {colorPalette.map((col) => (
                  <button
                    key={col}
                    type="button"
                    className={`color-dot-btn ${selectedColor === col ? "is-active" : ""}`}
                    style={{ backgroundColor: col }}
                    onClick={() => setSelectedColor(col)}
                    aria-label={`Select color ${col}`}
                  />
                ))}
              </div>
              <div className="project-form__actions">
                <button className="text-button" type="button" onClick={() => setIsCreating(false)}>
                  Cancel
                </button>
                <button className="button button--primary button--small" type="submit">
                  Create
                </button>
              </div>
            </form>
          ) : (
            <button
              className="new-project-button"
              onClick={() => setIsCreating(true)}
              type="button"
            >
              <span aria-hidden="true" className="new-project-button__icon">
                +
              </span>
              New project
            </button>
          )}

          {selectedProject ? (
            <div className="project-tasks-section" style={{ marginTop: "1.25rem" }}>
              <div className="project-tasks-section__header">
                <h3>{selectedProject.title}</h3>
              </div>

              <div className="inbox-search-row" style={{ marginTop: "0.5rem" }}>
                <input
                  aria-label="Filter tasks"
                  className="task-search-input"
                  onChange={(e) => setInboxSearch(e.target.value)}
                  placeholder="Filter tasks..."
                  type="search"
                  value={inboxSearch}
                />
              </div>

              <ul className="project-task-items-list" style={{ listStyle: "none", marginTop: "0.75rem", display: "flex", flexDirection: "column", gap: "8px" }}>
                {filteredTasks.length > 0 ? (
                  filteredTasks.map((t) => {
                    const isSelected = selectedTaskId === t.id
                    const sessionCount = sessionCountByTask.get(t.id) ?? 0
                    const subtasks = tasks.filter((sub) => sub.parentTaskId === t.id)
                    const prereqs = dependencies
                      .filter((d) => d.toTaskId === t.id)
                      .map((d) => taskMap.get(d.fromTaskId))
                      .filter(Boolean)

                    return (
                      <li key={t.id} className="project-task-item-card">
                        <div
                          className={`inbox-task-card ${isSelected ? "is-selected" : ""}`}
                          onClick={() => onSelectTaskId(t.id)}
                        >
                          <label className="inbox-task-label" onClick={(e) => e.stopPropagation()}>
                            <input
                              aria-label={t.title}
                              checked={t.completed}
                              onChange={(e) => onSetTaskCompletion(t.id, e.target.checked)}
                              type="checkbox"
                            />
                            <span className={t.completed ? "task-title is-completed" : "task-title"}>
                              {t.title}
                            </span>
                          </label>

                          <div className="inbox-task-meta" style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
                            {sessionCount > 0 ? (
                              <span className="task-scheduled-badge">{sessionCount} scheduled</span>
                            ) : null}
                            {t.estimateMinutes ? <span>⏱ {t.estimateMinutes}m</span> : null}
                            {prereqs.map((p) => (
                              <span key={p!.id} className="meta-chip meta-chip--prereq">
                                🔗 After: {p!.title}
                              </span>
                            ))}

                            <button
                              aria-label={`Edit constraints for ${t.title}`}
                              className="text-button"
                              onClick={(e) => {
                                e.stopPropagation()
                                openConstraints(t)
                              }}
                              style={{ padding: "0 4px", fontSize: "11px" }}
                              type="button"
                            >
                              ⚙ Constraints
                            </button>

                            {onTriggerAi ? (
                              <button
                                aria-label={`AI assistance for ${t.title}`}
                                className="text-button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onTriggerAi(t)
                                }}
                                style={{ padding: "0 4px", fontSize: "11px", color: "var(--amethyst-primary)" }}
                                type="button"
                              >
                                ✨ AI
                              </button>
                            ) : null}

                            <button
                              className="text-button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setSubtaskParentId(t.id)
                              }}
                              style={{ padding: "0 4px", fontSize: "11px" }}
                              type="button"
                            >
                              + Add subtask
                            </button>
                          </div>

                          {/* Subtasks in list */}
                          {subtasks.length > 0 ? (
                            <ul style={{ listStyle: "none", paddingLeft: "18px", marginTop: "4px", display: "flex", flexDirection: "column", gap: "4px" }}>
                              {subtasks.map((st) => (
                                <li key={st.id}>
                                  <label className="inbox-task-label" onClick={(e) => e.stopPropagation()}>
                                    <input
                                      aria-label={st.title}
                                      checked={st.completed}
                                      onChange={(e) => onSetTaskCompletion(st.id, e.target.checked)}
                                      type="checkbox"
                                    />
                                    <span className={st.completed ? "task-title is-completed" : "task-title"} style={{ fontSize: "12px" }}>
                                      {st.title}
                                    </span>
                                  </label>
                                </li>
                              ))}
                            </ul>
                          ) : null}

                          {subtaskParentId === t.id ? (
                            <form
                              onSubmit={submitSubtask}
                              onClick={(e) => e.stopPropagation()}
                              style={{ marginTop: "6px", display: "flex", gap: "4px" }}
                            >
                              <input
                                aria-label="Add a subtask"
                                autoFocus
                                onChange={(e) => setSubtaskTitle(e.target.value)}
                                placeholder="Add a subtask"
                                style={{ flex: 1, padding: "4px 6px", fontSize: "12px" }}
                                value={subtaskTitle}
                              />
                              <button className="button button--primary button--small" type="submit">
                                Add
                              </button>
                            </form>
                          ) : null}
                        </div>
                      </li>
                    )
                  })
                ) : (
                  <p className="empty-tasks" style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
                    No tasks match current filter.
                  </p>
                )}
              </ul>

              <form className="task-form" onSubmit={submitTask} style={{ marginTop: "1rem" }}>
                <label className="visually-hidden" htmlFor="new-task-title">
                  Add a task to {selectedProject.title}
                </label>
                <input
                  id="new-task-title"
                  maxLength={200}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="Add a task"
                  value={newTaskTitle}
                />
              </form>
            </div>
          ) : null}
        </>
      ) : (
        <div className="inbox-drawer-content">
          <div className="inbox-search-row">
            <input
              aria-label="Filter tasks"
              className="task-search-input"
              onChange={(e) => setInboxSearch(e.target.value)}
              placeholder="Filter tasks..."
              type="search"
              value={inboxSearch}
            />
          </div>

          <div className="task-filter-chips" role="group" aria-label="Filter tasks by status">
            <button
              className={`task-filter-chip ${inboxFilter === "all" ? "is-active" : ""}`}
              onClick={() => setInboxFilter("all")}
              type="button"
            >
              All
            </button>
            <button
              className={`task-filter-chip ${inboxFilter === "active" ? "is-active" : ""}`}
              onClick={() => setInboxFilter("active")}
              type="button"
            >
              Active
            </button>
            <button
              className={`task-filter-chip ${inboxFilter === "scheduled" ? "is-active" : ""}`}
              onClick={() => setInboxFilter("scheduled")}
              type="button"
            >
              Scheduled
            </button>
            <button
              className={`task-filter-chip ${inboxFilter === "due-soon" ? "is-active" : ""}`}
              onClick={() => setInboxFilter("due-soon")}
              type="button"
            >
              Due Soon
            </button>
            <button
              className={`task-filter-chip ${inboxFilter === "completed" ? "is-active" : ""}`}
              onClick={() => setInboxFilter("completed")}
              type="button"
            >
              Done
            </button>
          </div>

          <ul className="inbox-task-list">
            {filteredTasks.length > 0 ? (
              filteredTasks.map((t) => {
                const isSelected = selectedTaskId === t.id
                return (
                  <li key={t.id} className="inbox-task-item">
                    <div
                      className={`inbox-task-card ${isSelected ? "is-selected" : ""}`}
                      onClick={() => onSelectTaskId(t.id)}
                    >
                      <label className="inbox-task-label" onClick={(e) => e.stopPropagation()}>
                        <input
                          aria-label={t.title}
                          checked={t.completed}
                          onChange={(e) => onSetTaskCompletion(t.id, e.target.checked)}
                          type="checkbox"
                        />
                        <span className={t.completed ? "task-title is-completed" : "task-title"}>
                          {t.title}
                        </span>
                      </label>
                      <div className="inbox-task-meta">
                        {t.estimateMinutes ? <span>⏱ {t.estimateMinutes}m</span> : null}
                        {t.priority && t.priority !== "medium" ? (
                          <span className={`priority-chip priority-chip--${t.priority}`}>
                            {t.priority.toUpperCase()}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </li>
                )
              })
            ) : (
              <p className="empty-tasks">No tasks match current filter.</p>
            )}
          </ul>

          <form className="task-form" onSubmit={submitTask} style={{ marginTop: "1rem" }}>
            <label className="visually-hidden" htmlFor="inbox-new-task-title">
              Add task
            </label>
            <input
              id="inbox-new-task-title"
              maxLength={200}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="Add a task"
              value={newTaskTitle}
            />
          </form>
        </div>
      )}

      {/* Constraints Modal Dialog */}
      {editingTask ? (
        <div aria-modal="true" className="calendar-dialog-overlay" role="dialog">
          <div className="calendar-dialog">
            <h2>Task Constraints & Scheduling</h2>
            <p className="calendar-dialog__sub">{editingTask.title}</p>
            <form onSubmit={submitConstraints}>
              <div className="calendar-dialog__field">
                <label htmlFor="constraint-duration">Estimated duration (minutes)</label>
                <input
                  id="constraint-duration"
                  max={1440}
                  min={1}
                  onChange={(e) => setConstraintMinutes(e.target.value)}
                  placeholder="e.g. 30, 45, 60"
                  type="number"
                  value={constraintMinutes}
                />
              </div>

              <div className="calendar-dialog__field">
                <label htmlFor="constraint-due">Deadline / Due date</label>
                <input
                  id="constraint-due"
                  onChange={(e) => setConstraintDueAt(e.target.value)}
                  type="date"
                  value={constraintDueAt}
                />
              </div>

              <div className="calendar-dialog__field">
                <label htmlFor="prereq-select">Depends on prerequisite task</label>
                <select
                  id="prereq-select"
                  onChange={(e) => setConstraintPrereqId(e.target.value)}
                  value={constraintPrereqId}
                >
                  <option value="">None / No additional prerequisite</option>
                  {tasks
                    .filter((t) => t.id !== editingTask.id && !t.parentTaskId)
                    .map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.title}
                      </option>
                    ))}
                </select>
              </div>

              <div className="calendar-dialog__actions">
                <button
                  className="text-button"
                  onClick={() => setEditingTask(null)}
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
