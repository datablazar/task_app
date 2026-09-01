import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { parseQuickTaskInput } from '../../domain/interpretation/nlp-parser'
import type { Project } from '../../domain/model'

interface QuickCaptureBarProps {
  projects: Project[]
  selectedProjectId: string | null
  onCreateQuickTask: (input: string, fallbackProjectId?: string) => boolean
}

export const QuickCaptureBar = ({
  projects,
  selectedProjectId,
  onCreateQuickTask,
}: QuickCaptureBarProps) => {
  const [input, setInput] = useState('')
  const [overrideProjectId, setOverrideProjectId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const effectiveProjectId = overrideProjectId ?? selectedProjectId ?? projects[0]?.id ?? ''

  // Global keyboard shortcut: Cmd+K or Ctrl+K to focus quick capture
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const parsed = useMemo(() => {
    if (!input.trim()) return null
    return parseQuickTaskInput(input, projects)
  }, [input, projects])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    if (onCreateQuickTask(input, effectiveProjectId)) {
      setInput('')
    }
  }

  return (
    <section className="quick-capture-container" aria-label="Quick Task Capture">
      <form className="quick-capture-form" onSubmit={handleSubmit}>
        <div className="quick-capture-input-wrapper">
          <span className="quick-capture-icon" aria-hidden="true">⚡</span>
          <input
            ref={inputRef}
            className="quick-capture-input"
            onChange={(e) => setInput(e.target.value)}
            placeholder="Quick capture: 'Review paper 90m by Friday #Research' (or ⌘K)"
            type="text"
            value={input}
          />
          <div className="quick-capture-controls">
            {projects.length > 0 ? (
              <select
                aria-label="Target project"
                className="quick-capture-project-select"
                onChange={(e) => setOverrideProjectId(e.target.value)}
                value={effectiveProjectId}
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    📁 {p.title}
                  </option>
                ))}
              </select>
            ) : null}
            <button
              className="button button--primary button--small quick-capture-submit"
              disabled={!input.trim()}
              type="submit"
            >
              Add Task
            </button>
          </div>
        </div>

        {parsed && parsed.matchedTokens.length > 0 ? (
          <div className="quick-capture-pills">
            <span className="quick-capture-pills__label">Detected:</span>
            {parsed.matchedTokens.map((token, i) => (
              <span className={`quick-capture-pill quick-capture-pill--${token.kind}`} key={i}>
                {token.label}
              </span>
            ))}
          </div>
        ) : null}
      </form>
    </section>
  )
}
