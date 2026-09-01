import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { Project } from '../../domain/model'

interface ProjectPanelProps {
  isOpen?: boolean
  onClose?: () => void
  onCreateProject: (title: string) => boolean
  onSelectProject: (projectId: string) => void
  projects: Project[]
  selectedProjectId: string | null
  taskCountByProject?: Map<string, number>
}

const DEFAULT_COLORS = ['#e0533c', '#3b7a57', '#8b5cf6', '#d97706', '#2563eb', '#db2777']

export const ProjectPanel = ({
  isOpen = true,
  onClose,
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
    if (onCreateProject(title.trim())) {
      setTitle('')
      setIsCreating(false)
    }
  }

  if (!isOpen) {
    return null
  }

  return (
    <aside aria-labelledby="projects-heading" className="projects-drawer">
      <div className="projects-drawer__header">
        <h2 className="projects-drawer__title" id="projects-heading">
          Projects
        </h2>
        {onClose ? (
          <button
            aria-label="Close projects drawer"
            className="projects-drawer__close-btn"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        ) : null}
      </div>

      <nav aria-label="Your projects" className="projects-drawer__nav">
        <ul className="projects-drawer__list">
          {projects.map((project, index) => {
            const count = taskCountByProject?.get(project.id) ?? 0
            const isSelected = project.id === selectedProjectId
            const dotColor = project.color ?? DEFAULT_COLORS[index % DEFAULT_COLORS.length]

            return (
              <li key={project.id}>
                <button
                  aria-current={isSelected ? 'page' : undefined}
                  className={`projects-drawer__item ${isSelected ? 'is-active is-selected' : ''}`}
                  onClick={() => onSelectProject(project.id)}
                  type="button"
                >
                  <div className="projects-drawer__item-left">
                    <span
                      aria-hidden="true"
                      className="projects-drawer__item-dot"
                      style={{ backgroundColor: dotColor }}
                    />
                    <span className="projects-drawer__item-title">{project.title}</span>
                  </div>
                  <span className="projects-drawer__item-count">{count}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      {isCreating ? (
        <form className="projects-drawer__form" onSubmit={submit}>
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
          <div className="projects-drawer__form-actions">
            <button
              className="text-button text-button--small"
              onClick={() => setIsCreating(false)}
              type="button"
            >
              Cancel
            </button>
            <button className="button button--primary button--small" type="submit">
              Create
            </button>
          </div>
        </form>
      ) : (
        <button
          className="projects-drawer__new-btn"
          onClick={() => setIsCreating(true)}
          type="button"
        >
          <span aria-hidden="true" className="projects-drawer__new-icon">
            +
          </span>
          New project
        </button>
      )}
    </aside>
  )
}
