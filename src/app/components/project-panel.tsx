import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { Project } from '../../domain/model'

interface ProjectPanelProps {
  onCreateProject: (title: string) => boolean
  onSelectProject: (projectId: string) => void
  projects: Project[]
  selectedProjectId: string | null
  taskCountByProject?: Map<string, number>
}

export const ProjectPanel = ({
  onCreateProject,
  onSelectProject,
  projects,
  selectedProjectId,
  taskCountByProject,
}: ProjectPanelProps) => {
  const [isCreating, setIsCreating] = useState(false)
  const [title, setTitle] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isCreating) {
      inputRef.current?.focus()
    }
  }, [isCreating])

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (onCreateProject(title)) {
      setTitle('')
      setIsCreating(false)
    }
  }

  return (
    <aside className="project-panel" aria-labelledby="projects-heading">
      <div className="project-panel__header">
        <h2 id="projects-heading">Projects</h2>
        <span className="project-panel__badge">{projects.length}</span>
      </div>
      <nav aria-label="Your projects">
        <ul className="project-list">
          {projects.map((project) => {
            const count = taskCountByProject?.get(project.id) ?? 0
            const isSelected = project.id === selectedProjectId
            return (
              <li key={project.id}>
                <button
                  aria-current={isSelected ? 'page' : undefined}
                  className={isSelected ? 'project-item is-selected' : 'project-item'}
                  onClick={() => onSelectProject(project.id)}
                  type="button"
                >
                  <span className="project-item__title">{project.title}</span>
                  <span className="project-item__count">{count}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      {isCreating ? (
        <form className="project-form" onSubmit={submit}>
          <label className="visually-hidden" htmlFor="new-project-title">
            Project name
          </label>
          <input
            id="new-project-title"
            maxLength={200}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Project name"
            ref={inputRef}
            value={title}
          />
          <div className="project-form__actions">
            <button className="text-button" type="button" onClick={() => setIsCreating(false)}>
              Cancel
            </button>
            <button className="button button--primary button--small" type="submit">
              Create
            </button>
          </div>
        </form>
      ) : null}

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
    </aside>
  )
}
