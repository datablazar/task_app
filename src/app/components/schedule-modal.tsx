import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { AvailabilityWindow, Schedule } from '../../domain/model'

interface ScheduleModalProps {
  isOpen: boolean
  schedules: Schedule[]
  onClose: () => void
  onCreateSchedule: (title: string, workingWindows: AvailabilityWindow[], isDefault?: boolean) => boolean
  onUpdateSchedule: (scheduleId: string, updates: { title?: string; workingWindows?: AvailabilityWindow[]; isDefault?: boolean }) => boolean
  onDeleteSchedule: (scheduleId: string) => boolean
  onSetDefaultSchedule: (scheduleId: string) => boolean
}

const DAY_LABELS: { [key: number]: string } = {
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
  7: 'Sun',
}

export const ScheduleModal = ({
  isOpen,
  schedules,
  onClose,
  onCreateSchedule,
  onUpdateSchedule,
  onDeleteSchedule,
  onSetDefaultSchedule,
}: ScheduleModalProps) => {
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  const [title, setTitle] = useState('')
  const [isDefault, setIsDefault] = useState(false)
  const [windows, setWindows] = useState<AvailabilityWindow[]>([
    { dayOfWeek: 1, startHour: 9, endHour: 17 },
    { dayOfWeek: 2, startHour: 9, endHour: 17 },
    { dayOfWeek: 3, startHour: 9, endHour: 17 },
    { dayOfWeek: 4, startHour: 9, endHour: 17 },
    { dayOfWeek: 5, startHour: 9, endHour: 17 },
  ])

  // Escape key handling
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isCreating || editingScheduleId) {
          setIsCreating(false)
          setEditingScheduleId(null)
        } else {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isCreating, editingScheduleId, onClose])

  if (!isOpen) return null

  const startCreate = () => {
    setTitle('')
    setIsDefault(false)
    setWindows([
      { dayOfWeek: 1, startHour: 9, endHour: 17 },
      { dayOfWeek: 2, startHour: 9, endHour: 17 },
      { dayOfWeek: 3, startHour: 9, endHour: 17 },
      { dayOfWeek: 4, startHour: 9, endHour: 17 },
      { dayOfWeek: 5, startHour: 9, endHour: 17 },
    ])
    setIsCreating(true)
    setEditingScheduleId(null)
  }

  const startEdit = (sched: Schedule) => {
    setTitle(sched.title)
    setIsDefault(sched.isDefault)
    setWindows([...sched.workingWindows])
    setEditingScheduleId(sched.id)
    setIsCreating(false)
  }

  const handleSave = (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim() || windows.length === 0) return

    if (isCreating) {
      if (onCreateSchedule(title.trim(), windows, isDefault)) {
        setIsCreating(false)
      }
    } else if (editingScheduleId) {
      if (onUpdateSchedule(editingScheduleId, { title: title.trim(), workingWindows: windows, isDefault })) {
        setEditingScheduleId(null)
      }
    }
  }

  const toggleDayWindow = (dayOfWeek: number) => {
    const existing = windows.find((w) => w.dayOfWeek === dayOfWeek)
    if (existing) {
      if (windows.length === 1) return // Prevent empty windows
      setWindows(windows.filter((w) => w.dayOfWeek !== dayOfWeek))
    } else {
      setWindows([...windows, { dayOfWeek, startHour: 9, endHour: 17 }].sort((a, b) => a.dayOfWeek - b.dayOfWeek))
    }
  }

  const updateWindowHours = (dayOfWeek: number, startHour: number, endHour: number) => {
    setWindows(
      windows.map((w) =>
        w.dayOfWeek === dayOfWeek ? { ...w, startHour, endHour } : w,
      ),
    )
  }

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal-content schedule-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-modal-title"
      >
        <div className="modal-header">
          <h2 id="schedule-modal-title">🗓 Availability Schedules</h2>
          <button className="button button--icon" onClick={onClose} type="button" aria-label="Close modal">
            ✕
          </button>
        </div>

        <div className="modal-body">
          {!isCreating && !editingScheduleId ? (
            <div className="schedule-list-view">
              <p className="schedule-modal-intro">
                Define multiple working schedules (e.g. Work, Personal, Deep Focus). Universal calendar blocks and locked sessions apply across all schedules.
              </p>
              <div className="schedule-cards">
                {schedules.map((sched) => (
                  <div className={`schedule-card ${sched.isDefault ? 'schedule-card--default' : ''}`} key={sched.id}>
                    <div className="schedule-card__header">
                      <div className="schedule-card__title-row">
                        <span className="schedule-card__title">{sched.title}</span>
                        {sched.isDefault ? (
                          <span className="badge badge--primary">⭐ Default</span>
                        ) : null}
                      </div>
                      <div className="schedule-card__actions">
                        {!sched.isDefault ? (
                          <button
                            className="button button--small button--secondary"
                            onClick={() => onSetDefaultSchedule(sched.id)}
                            type="button"
                          >
                            Set Default
                          </button>
                        ) : null}
                        <button
                          className="button button--small button--secondary"
                          onClick={() => startEdit(sched)}
                          type="button"
                        >
                          Edit
                        </button>
                        <button
                          className="button button--small button--danger"
                          disabled={schedules.length <= 1}
                          onClick={() => onDeleteSchedule(sched.id)}
                          type="button"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    <div className="schedule-card__windows">
                      {sched.workingWindows.map((win, idx) => (
                        <span className="schedule-window-chip" key={idx}>
                          <strong>{DAY_LABELS[win.dayOfWeek]}:</strong> {win.startHour}:00 - {win.endHour}:00
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <button
                className="button button--primary button--full"
                onClick={startCreate}
                type="button"
                style={{ marginTop: '1rem' }}
              >
                + Add New Schedule
              </button>
            </div>
          ) : (
            <form className="schedule-editor-form" onSubmit={handleSave}>
              <h3>{isCreating ? 'Create Schedule' : `Edit “${title}”`}</h3>
              <label className="field-group">
                <span className="field-label">Schedule Name</span>
                <input
                  autoFocus
                  className="input"
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Deep Focus, Personal Hours"
                  required
                  type="text"
                  value={title}
                />
              </label>

              <div className="field-group">
                <span className="field-label">Active Working Days</span>
                <div className="day-toggle-group">
                  {[1, 2, 3, 4, 5, 6, 7].map((d) => {
                    const active = windows.some((w) => w.dayOfWeek === d)
                    return (
                      <button
                        className={`day-toggle-btn ${active ? 'day-toggle-btn--active' : ''}`}
                        key={d}
                        onClick={() => toggleDayWindow(d)}
                        type="button"
                      >
                        {DAY_LABELS[d]}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="field-group">
                <span className="field-label">Daily Working Hours</span>
                <div className="schedule-window-rows">
                  {windows.map((win) => (
                    <div className="schedule-window-row" key={win.dayOfWeek}>
                      <span className="window-day-name">{DAY_LABELS[win.dayOfWeek]}</span>
                      <label className="window-hour-label">
                        <span>Start</span>
                        <input
                          className="input window-hour-input"
                          max={win.endHour - 1}
                          min={0}
                          onChange={(e) =>
                            updateWindowHours(win.dayOfWeek, parseInt(e.target.value, 10), win.endHour)
                          }
                          type="number"
                          value={win.startHour}
                        />
                        <span>:00</span>
                      </label>
                      <span>to</span>
                      <label className="window-hour-label">
                        <span>End</span>
                        <input
                          className="input window-hour-input"
                          max={24}
                          min={win.startHour + 1}
                          onChange={(e) =>
                            updateWindowHours(win.dayOfWeek, win.startHour, parseInt(e.target.value, 10))
                          }
                          type="number"
                          value={win.endHour}
                        />
                        <span>:00</span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.75rem 0' }}>
                <input
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  type="checkbox"
                />
                <span>Set as default schedule for newly created tasks</span>
              </label>

              <div className="modal-actions">
                <button
                  className="button button--secondary"
                  onClick={() => {
                    setIsCreating(false)
                    setEditingScheduleId(null)
                  }}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="button button--primary"
                  disabled={!title.trim() || windows.length === 0}
                  type="submit"
                >
                  Save Schedule
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
