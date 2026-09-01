import type { Task } from "../../domain/model"

interface RecurringModalProps {
  tasks: Task[]
  onClose: () => void
  onTriggerRecurrence: () => void
}

export const RecurringModal = ({ tasks, onClose, onTriggerRecurrence }: RecurringModalProps) => {
  const recurringTasks = tasks.filter((t) => t.recurrence !== undefined && !t.recurringParentId)

  return (
    <div aria-modal="true" className="calendar-dialog-overlay" role="dialog">
      <div className="calendar-dialog recurring-modal">
        <div className="recurring-modal__header">
          <h2>🔁 Recurring Tasks Engine</h2>
          <button aria-label="Close recurring modal" className="modal-close-btn" onClick={onClose} type="button">
            ×
          </button>
        </div>

        <p className="recurring-modal__desc">
          Automated 90-day future horizon pre-generation with duplicate protection and cadence binding.
        </p>

        <div className="recurring-actions-row">
          <button
            className="button button--primary button--small"
            onClick={() => {
              onTriggerRecurrence()
            }}
            type="button"
          >
            ⚡ Generate Next 90 Days Instances
          </button>
        </div>

        <div className="recurring-list">
          {recurringTasks.length > 0 ? (
            recurringTasks.map((task) => (
              <div className="recurring-card" key={task.id}>
                <div className="recurring-card__title">
                  <strong>{task.title}</strong>
                  <span className="recurring-card__badge">
                    {task.recurrence?.frequency?.toUpperCase()}
                  </span>
                </div>
                <div className="recurring-card__meta">
                  Interval: every {task.recurrence?.interval ?? 1}{" "}
                  {task.recurrence?.frequency}
                  {task.dueAt ? ` · Reference due: ${task.dueAt.slice(0, 10)}` : ""}
                </div>
              </div>
            ))
          ) : (
            <div className="recurring-empty">
              <p>No recurring tasks defined yet. Add recurrence to any task in the Task Detail Drawer.</p>
            </div>
          )}
        </div>

        <div className="calendar-dialog__actions" style={{ marginTop: "1.5rem" }}>
          <button className="button button--secondary button--small" onClick={onClose} type="button">
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
