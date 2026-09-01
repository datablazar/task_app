import type { FormEvent } from 'react'
import { useMemo, useState } from 'react'
import { BackupControls } from './backup-controls'
import type { Project, Task, TaskSession } from '../../domain/model'

interface TaskPanelProps {
  onCreateTask: (projectId: string, title: string) => boolean
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

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (project && onCreateTask(project.id, title)) {
      setTitle('')
    }
  }

  const sessionCountByTask = useMemo(() => {
    const map = new Map<string, number>()
    for (const session of taskSessions) {
      map.set(session.taskId, (map.get(session.taskId) ?? 0) + 1)
    }
    return map
  }, [taskSessions])

  return (
    <aside className="task-panel" aria-labelledby="selected-project-heading">
      {project ? (
        <>
          <h2 id="selected-project-heading">{project.title}</h2>
          <section aria-labelledby="tasks-heading" className="tasks-section">
            <h3 id="tasks-heading">Tasks</h3>
            {tasks.length > 0 ? (
              <ul className="task-list">
                {tasks.map((task) => {
                  const sessionCount = sessionCountByTask.get(task.id) ?? 0
                  const isSelected = selectedTaskId === task.id
                  return (
                    <li key={task.id}>
                      <div className={`task-card ${isSelected ? 'is-selected' : ''}`}>
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
                            {task.completed ? 'Completed' : 'Open'} task
                          </span>
                        </label>
                        {sessionCount > 0 ? (
                          <span className="task-badge" title={`${sessionCount} session(s) scheduled`}>
                            {sessionCount} scheduled
                          </span>
                        ) : null}
                      </div>
                    </li>
                  )
                })}
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
      <BackupControls className="mobile-backup-actions" compact onExport={onExport} onImport={onImport} />
    </aside>
  )
}
