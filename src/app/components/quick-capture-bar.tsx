import { useEffect, useMemo, useRef, useState } from "react"
import type { FormEvent } from "react"
import { parseQuickTaskInput } from "../../domain/interpretation/nlp-parser"
import type { Project } from "../../domain/model"

interface QuickCaptureBarProps {
  projects: Project[]
  selectedProjectId: string | null
  onCreateQuickTask: (input: string, fallbackProjectId?: string) => boolean
  inputRef?: React.RefObject<HTMLInputElement | null>
}

export const QuickCaptureBar = ({
  projects,
  selectedProjectId,
  onCreateQuickTask,
  inputRef: externalInputRef,
}: QuickCaptureBarProps) => {
  const [input, setInput] = useState("")
  const [overrideProjectId, setOverrideProjectId] = useState<string | null>(null)
  const internalInputRef = useRef<HTMLInputElement>(null)
  const inputRef = externalInputRef || internalInputRef

  const effectiveProjectId = overrideProjectId ?? selectedProjectId ?? projects[0]?.id ?? ""

  // Global keyboard shortcut: Cmd+K or Ctrl+K to focus quick capture
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [inputRef])

  const parsed = useMemo(() => {
    if (!input.trim()) return null
    return parseQuickTaskInput(input, projects)
  }, [input, projects])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    if (onCreateQuickTask(input, effectiveProjectId)) {
      setInput("")
    }
  }

  return (
    <div className="quick-capture-capsule" aria-label="Quick Task Capture">
      <form className="quick-capture-form" onSubmit={handleSubmit}>
        <div className="quick-capture-input-wrapper">
          <span className="quick-capture-plus-icon" aria-hidden="true">+</span>
          <input
            ref={inputRef}
            className="quick-capture-input"
            onChange={(e) => setInput(e.target.value)}
            placeholder="Capture a task or note... (Quick capture: 'Review paper 90m')"
            type="text"
            value={input}
          />
          {projects.length > 1 ? (
            <select
              aria-label="Target project"
              className="quick-capture-project-select"
              onChange={(e) => setOverrideProjectId(e.target.value)}
              value={effectiveProjectId}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          ) : null}
        </div>

        {parsed && parsed.matchedTokens.length > 0 ? (
          <div className="quick-capture-pills">
            {parsed.matchedTokens.map((token, i) => (
              <span className={`quick-capture-pill quick-capture-pill--${token.kind}`} key={i}>
                {token.label}
              </span>
            ))}
          </div>
        ) : null}
      </form>
    </div>
  )
}
