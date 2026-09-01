import { useState } from "react"
import type { FormEvent } from "react"
import type { AvailabilityWindow, Schedule } from "../../domain/model"

interface ScheduleModalProps {
  schedules: Schedule[]
  onClose: () => void
  onCreateSchedule: (name: string, workingWindows: AvailabilityWindow[], color?: string) => boolean
  onUpdateSchedule: (
    scheduleId: string,
    options: {
      name?: string
      workingWindows?: AvailabilityWindow[]
      color?: string
      isDefault?: boolean
    },
  ) => boolean
  onDeleteSchedule: (scheduleId: string) => boolean
}

const defaultWindows: AvailabilityWindow[] = [
  { dayOfWeek: 1, startHour: 9, endHour: 17 },
  { dayOfWeek: 2, startHour: 9, endHour: 17 },
  { dayOfWeek: 3, startHour: 9, endHour: 17 },
  { dayOfWeek: 4, startHour: 9, endHour: 17 },
  { dayOfWeek: 5, startHour: 9, endHour: 17 },
]

export const ScheduleModal = ({
  schedules,
  onClose,
  onCreateSchedule,
  onUpdateSchedule,
  onDeleteSchedule,
}: ScheduleModalProps) => {
  const [isCreating, setIsCreating] = useState(false)
  const [newName, setNewName] = useState("")
  const [newColor, setNewColor] = useState("#3b7a57")

  const handleCreate = (e: FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    if (onCreateSchedule(newName.trim(), defaultWindows, newColor)) {
      setNewName("")
      setIsCreating(false)
    }
  }

  return (
    <div aria-modal="true" className="calendar-dialog-overlay" role="dialog">
      <div className="calendar-dialog schedule-modal">
        <div className="schedule-modal__header">
          <h2>🗓 Availability Schedules</h2>
          <button aria-label="Close schedules" className="modal-close-btn" onClick={onClose} type="button">
            ×
          </button>
        </div>

        <p className="schedule-modal__desc">
          Configure custom availability windows and bind tasks to distinct working schedules.
        </p>

        <div className="schedule-list">
          {schedules.map((sched) => (
            <div className="schedule-card" key={sched.id}>
              <div className="schedule-card__info">
                <span
                  className="schedule-card__dot"
                  style={{ backgroundColor: sched.color ?? "var(--sage-primary)" }}
                />
                <div>
                  <span className="schedule-card__name">{sched.name}</span>
                  {sched.isDefault ? (
                    <span className="schedule-card__badge">Default</span>
                  ) : null}
                  <div className="schedule-card__meta">
                    {sched.availability.workingWindows.length} active day window(s) (e.g. 09:00–17:00)
                  </div>
                </div>
              </div>

              <div className="schedule-card__actions">
                {!sched.isDefault ? (
                  <button
                    className="button button--secondary button--small"
                    onClick={() => onUpdateSchedule(sched.id, { isDefault: true })}
                    type="button"
                  >
                    Set Default
                  </button>
                ) : null}
                {schedules.length > 1 ? (
                  <button
                    aria-label={`Delete schedule ${sched.name}`}
                    className="button button--danger button--small"
                    onClick={() => onDeleteSchedule(sched.id)}
                    type="button"
                  >
                    Delete
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        {isCreating ? (
          <form className="schedule-create-form" onSubmit={handleCreate}>
            <div className="calendar-dialog__field">
              <label htmlFor="sched-name-input">Schedule Name</label>
              <input
                id="sched-name-input"
                maxLength={100}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Deep Work, Personal, Teaching"
                required
                value={newName}
              />
            </div>
            <div className="calendar-dialog__field">
              <label htmlFor="sched-color-input">Accent Color</label>
              <input
                id="sched-color-input"
                onChange={(e) => setNewColor(e.target.value)}
                type="color"
                value={newColor}
              />
            </div>
            <div className="calendar-dialog__actions">
              <button className="text-button" onClick={() => setIsCreating(false)} type="button">
                Cancel
              </button>
              <button className="button button--primary button--small" type="submit">
                Create Schedule
              </button>
            </div>
          </form>
        ) : (
          <button
            className="new-project-button"
            onClick={() => setIsCreating(true)}
            style={{ marginTop: "1rem" }}
            type="button"
          >
            + Add New Schedule
          </button>
        )}

        <div className="calendar-dialog__actions" style={{ marginTop: "1.5rem" }}>
          <button className="button button--secondary button--small" onClick={onClose} type="button">
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
