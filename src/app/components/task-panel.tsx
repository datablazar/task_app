import type { FormEvent } from 'react'
import { useState } from 'react'
import { BackupControls } from './backup-controls'
import type { Project, Task } from '../../domain/model'

interface TaskPanelProps {
  onCreateTask: (projectId: string, title: string) => boolean
  onExport: () => void
  onImport: (file: File) => void
  onSetTaskCompletion: (taskId: string, completed: boolean) => void
  project: Project | undefined
  tasks: Task[]
}

export const TaskPanel = ({
  onCreateTask,
  onExport,
  onImport,
  onSetTaskCompletion,
  project,
  tasks,
}: TaskPanelProps) => {
  const [title, setTitle] = useState('')

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (project && onCreateTask(project.id, title)) {
      setTitle('')
    }
  }

  return (
    <aside className="task-panel" aria-labelledby="selected-project-heading">
      {project ? (
        <>
          <h2 id="selected-project-heading">{project.title}</h2>
          <section aria-labelledby="tasks-heading" className="tasks-section">
            <h3 id="tasks-heading">Tasks</h3>
            {tasks.length > 0 ? (
              <ul className="task-list">
                {tasks.map((task) => (
                  <li key={task.id}>
                    <label className={task.completed ? 'task-row is-completed' : 'task-row'}>
                      <input
                        checked={task.completed}
                        onChange={(event) => onSetTaskCompletion(task.id, event.target.checked)}
                        type="checkbox"
                      />
                      <span>{task.title}</span>
                      <span className="visually-hidden">
                        {task.completed ? 'Completed' : 'Open'} task
                      </span>
                    </label>
                  </li>
                ))}
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
