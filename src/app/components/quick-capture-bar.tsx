import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { parseQuickTaskInput } from '../../domain/interpretation/nlp-parser'
import type { Project } from '../../domain/model'

export interface QuickCaptureHandle {
  focus: () => void
}

interface QuickCaptureBarProps {
  projects: Project[]
  selectedProjectId: string | null
  onCreateQuickTask: (input: string, fallbackProjectId?: string) => boolean
}

export const QuickCaptureBar = forwardRef<QuickCaptureHandle, QuickCaptureBarProps>(
  ({ projects, selectedProjectId, onCreateQuickTask }, ref) => {
    const [input, setInput] = useState('')
    const [isFocused, setIsFocused] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    useImperativeHandle(ref, () => ({
      focus: () => {
        inputRef.current?.focus()
      },
    }))

    const effectiveProjectId = selectedProjectId ?? projects[0]?.id ?? ''

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

      if (onCreateQuickTask(input.trim(), effectiveProjectId)) {
        setInput('')
        inputRef.current?.blur()
      }
    }

    return (
      <div className={`header-quick-capture ${isFocused ? 'is-focused' : ''}`}>
        <form className="header-quick-capture__form" onSubmit={handleSubmit}>
          <span aria-hidden="true" className="header-quick-capture__plus">
            +
          </span>
          <input
            aria-label="Capture a task or note"
            className="header-quick-capture__input"
            onBlur={() => setIsFocused(false)}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setIsFocused(true)}
            placeholder="Capture a task or note... (Quick capture: 'Review paper 90m')"
            ref={inputRef}
            type="text"
            value={input}
          />
          <button className="visually-hidden" type="submit">
            Add Task
          </button>
        </form>

        {parsed && parsed.matchedTokens.length > 0 ? (
          <div className="header-quick-capture__popup">
            <span className="header-quick-capture__detected-label">Detected:</span>
            {parsed.matchedTokens.map((token, i) => (
              <span
                className={`quick-capture-pill quick-capture-pill--${token.kind}`}
                key={i}
              >
                {token.label}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    )
  },
)

QuickCaptureBar.displayName = 'QuickCaptureBar'
