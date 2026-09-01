import { useState } from 'react'
import type { TaskInterpretationResult } from '../../domain/interpretation'
import type { ProposalCapability, Task } from '../../domain/model'

interface AiProposalDialogProps {
  task: Task
  interpretation: TaskInterpretationResult
  onAcceptDuration: (estimateMinutes: number) => void
  onAcceptDeadline: (dueAt: string) => void
  onAcceptSubtasks: (subtaskTitles: string[]) => void
  onAcceptDependency: (prerequisiteTaskId: string) => void
  onDismissCapability: (capability: ProposalCapability) => void
  onClose: () => void
}

export const AiProposalDialog = ({
  task,
  interpretation,
  onAcceptDuration,
  onAcceptDeadline,
  onAcceptSubtasks,
  onAcceptDependency,
  onDismissCapability,
  onClose,
}: AiProposalDialogProps) => {
  const [selectedSubtasks, setSelectedSubtasks] = useState<string[]>(
    interpretation.decomposition?.subtasks ?? [],
  )

  const [handledCapabilities, setHandledCapabilities] = useState<Set<ProposalCapability>>(
    new Set(),
  )

  const toggleSubtask = (title: string) => {
    setSelectedSubtasks((current) =>
      current.includes(title) ? current.filter((t) => t !== title) : [...current, title],
    )
  }

  const markHandled = (cap: ProposalCapability) => {
    setHandledCapabilities((prev) => new Set([...prev, cap]))
  }

  const hasAnyProposals =
    interpretation.duration ||
    interpretation.deadline ||
    interpretation.decomposition ||
    interpretation.dependency

  const providerLabel =
    interpretation.provenance === 'simulated-ai'
      ? '✨ Simulated AI (Preview)'
      : interpretation.provenance === 'gemini-api'
        ? '🤖 Live Gemini AI'
        : '⚡ Local Rules (Heuristic)'

  return (
    <div aria-modal="true" className="calendar-dialog-overlay" role="dialog">
      <div className="ai-proposal-dialog">
        <header className="ai-proposal-dialog__header">
          <div className="ai-proposal-dialog__title-row">
            <span className="ai-proposal-dialog__badge">{providerLabel}</span>
            <h2>AI Assistance: {task.title}</h2>
          </div>
          <button
            aria-label="Close AI assistance"
            className="ai-proposal-dialog__close"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </header>

        <div className="ai-proposal-dialog__body">
          {!hasAnyProposals ? (
            <div className="ai-proposal-dialog__empty">
              <p>No new constraints or subtasks proposed for this task.</p>
            </div>
          ) : null}

          {/* 1. Duration Proposal */}
          {interpretation.duration && !handledCapabilities.has('duration-estimate') ? (
            <section className="ai-proposal-card">
              <div className="ai-proposal-card__header">
                <div className="ai-proposal-card__title">
                  <span className="ai-proposal-card__icon">⏱</span>
                  <div>
                    <strong>Estimated Duration: {interpretation.duration.estimateMinutes} mins</strong>
                    <div className="ai-proposal-card__meta">
                      Confidence: {Math.round(interpretation.duration.confidence * 100)}%
                    </div>
                  </div>
                </div>
                <div className="ai-proposal-card__actions">
                  <button
                    className="button button--secondary button--small"
                    onClick={() => {
                      onDismissCapability('duration-estimate')
                      markHandled('duration-estimate')
                    }}
                    type="button"
                  >
                    Dismiss
                  </button>
                  <button
                    className="button button--primary button--small"
                    onClick={() => {
                      onAcceptDuration(interpretation.duration!.estimateMinutes)
                      markHandled('duration-estimate')
                    }}
                    type="button"
                  >
                    Apply Duration
                  </button>
                </div>
              </div>
              <p className="ai-proposal-card__rationale">{interpretation.duration.rationale}</p>
            </section>
          ) : null}

          {/* 2. Deadline Proposal */}
          {interpretation.deadline && !handledCapabilities.has('deadline-extract') ? (
            <section className="ai-proposal-card">
              <div className="ai-proposal-card__header">
                <div className="ai-proposal-card__title">
                  <span className="ai-proposal-card__icon">📅</span>
                  <div>
                    <strong>
                      Suggested Deadline:{' '}
                      {new Intl.DateTimeFormat('en-GB', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      }).format(new Date(interpretation.deadline.dueAt!))}
                    </strong>
                    <div className="ai-proposal-card__meta">
                      Confidence: {Math.round(interpretation.deadline.confidence * 100)}%
                    </div>
                  </div>
                </div>
                <div className="ai-proposal-card__actions">
                  <button
                    className="button button--secondary button--small"
                    onClick={() => {
                      onDismissCapability('deadline-extract')
                      markHandled('deadline-extract')
                    }}
                    type="button"
                  >
                    Dismiss
                  </button>
                  <button
                    className="button button--primary button--small"
                    onClick={() => {
                      onAcceptDeadline(interpretation.deadline!.dueAt!)
                      markHandled('deadline-extract')
                    }}
                    type="button"
                  >
                    Apply Deadline
                  </button>
                </div>
              </div>
              <p className="ai-proposal-card__rationale">{interpretation.deadline.rationale}</p>
            </section>
          ) : null}

          {/* 3. Subtask Decomposition Proposal */}
          {interpretation.decomposition && !handledCapabilities.has('subtask-decomposition') ? (
            <section className="ai-proposal-card">
              <div className="ai-proposal-card__header">
                <div className="ai-proposal-card__title">
                  <span className="ai-proposal-card__icon">🌿</span>
                  <div>
                    <strong>Proposed Subtask Breakdown</strong>
                    <div className="ai-proposal-card__meta">
                      Confidence: {Math.round(interpretation.decomposition.confidence * 100)}%
                    </div>
                  </div>
                </div>
                <div className="ai-proposal-card__actions">
                  <button
                    className="button button--secondary button--small"
                    onClick={() => {
                      onDismissCapability('subtask-decomposition')
                      markHandled('subtask-decomposition')
                    }}
                    type="button"
                  >
                    Dismiss
                  </button>
                  <button
                    className="button button--primary button--small"
                    disabled={selectedSubtasks.length === 0}
                    onClick={() => {
                      onAcceptSubtasks(selectedSubtasks)
                      markHandled('subtask-decomposition')
                    }}
                    type="button"
                  >
                    Add {selectedSubtasks.length} Subtasks
                  </button>
                </div>
              </div>
              <p className="ai-proposal-card__rationale">{interpretation.decomposition.rationale}</p>
              <ul className="ai-subtask-checklist">
                {interpretation.decomposition.subtasks.map((st) => (
                  <li key={st}>
                    <label className="ai-subtask-label">
                      <input
                        checked={selectedSubtasks.includes(st)}
                        onChange={() => toggleSubtask(st)}
                        type="checkbox"
                      />
                      <span>{st}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* 4. Dependency Inference Proposal */}
          {interpretation.dependency?.prerequisiteTaskId &&
          !handledCapabilities.has('dependency-infer') ? (
            <section className="ai-proposal-card">
              <div className="ai-proposal-card__header">
                <div className="ai-proposal-card__title">
                  <span className="ai-proposal-card__icon">🔗</span>
                  <div>
                    <strong>
                      Prerequisite Dependency: {interpretation.dependency.prerequisiteTaskTitle}
                    </strong>
                    <div className="ai-proposal-card__meta">
                      Confidence: {Math.round(interpretation.dependency.confidence * 100)}%
                    </div>
                  </div>
                </div>
                <div className="ai-proposal-card__actions">
                  <button
                    className="button button--secondary button--small"
                    onClick={() => {
                      onDismissCapability('dependency-infer')
                      markHandled('dependency-infer')
                    }}
                    type="button"
                  >
                    Dismiss
                  </button>
                  <button
                    className="button button--primary button--small"
                    onClick={() => {
                      onAcceptDependency(interpretation.dependency!.prerequisiteTaskId!)
                      markHandled('dependency-infer')
                    }}
                    type="button"
                  >
                    Link Prerequisite
                  </button>
                </div>
              </div>
              <p className="ai-proposal-card__rationale">{interpretation.dependency.rationale}</p>
            </section>
          ) : null}
        </div>

        <footer className="ai-proposal-dialog__footer">
          <button className="button button--secondary button--small" onClick={onClose} type="button">
            Done
          </button>
        </footer>
      </div>
    </div>
  )
}
