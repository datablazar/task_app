import { useState } from 'react'
import type { FormEvent } from 'react'
import type { FixedEvent, PlanRisk, Task, TaskSession } from '../../domain/model'

interface CalendarPreviewProps {
  hasProjects: boolean
  hasTasks: boolean
  referenceDate: Date
  tasks: Task[]
  fixedEvents: FixedEvent[]
  taskSessions: TaskSession[]
  selectedTaskId: string | null
  onCreateFixedEvent: (title: string, startAt: string, endAt: string) => boolean
  onScheduleTaskSession: (taskId: string, startAt: string, endAt: string) => boolean
  onDeleteFixedEvent: (eventId: string) => boolean
  onDeleteTaskSession: (sessionId: string) => boolean
  onAutoPlan?: () => void
  risks?: PlanRisk[]
}

interface ActiveSlot {
  day: Date
  hour: number
  startAt: string
  endAt: string
}

const hours = Array.from({ length: 15 }, (_, index) => index + 7)

export const CalendarPreview = ({
  hasProjects,
  hasTasks,
  referenceDate,
  tasks,
  fixedEvents,
  taskSessions,
  selectedTaskId,
  onCreateFixedEvent,
  onScheduleTaskSession,
  onDeleteFixedEvent,
  onDeleteTaskSession,
  onAutoPlan,
  risks = [],
}: CalendarPreviewProps) => {
  const [weekOffset, setWeekOffset] = useState(0)

  const activeReferenceDate = new Date(referenceDate)
  activeReferenceDate.setDate(activeReferenceDate.getDate() + weekOffset)
  const week = getWeek(activeReferenceDate)

  const heading = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
  }).format(week[0])

  const [activeSlot, setActiveSlot] = useState<ActiveSlot | null>(null)
  const [scheduleMode, setScheduleMode] = useState<'task' | 'fixed'>('task')
  const [fixedTitle, setFixedTitle] = useState('')
  const [chosenTaskId, setChosenTaskId] = useState<string>(selectedTaskId ?? tasks[0]?.id ?? '')

  const openSlotDialog = (day: Date, hour: number) => {
    const slotStart = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hour, 0, 0))
    const slotEnd = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hour + 1, 0, 0))
    setActiveSlot({
      day,
      hour,
      startAt: slotStart.toISOString(),
      endAt: slotEnd.toISOString(),
    })
    setFixedTitle('')
    setChosenTaskId(selectedTaskId ?? tasks[0]?.id ?? '')
    setScheduleMode(tasks.length > 0 ? 'task' : 'fixed')
  }

  const closeSlotDialog = () => {
    setActiveSlot(null)
  }

  const submitSchedule = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!activeSlot) return

    if (scheduleMode === 'task') {
      if (!chosenTaskId) return
      const targetTask = taskLookup.get(chosenTaskId)
      const durationMinutes = targetTask?.estimateMinutes ?? 60
      const startMs = Date.parse(activeSlot.startAt)
      const endAt = new Date(startMs + durationMinutes * 60 * 1000).toISOString()
      if (onScheduleTaskSession(chosenTaskId, activeSlot.startAt, endAt)) {
        closeSlotDialog()
      }
    } else {
      if (!fixedTitle.trim()) return
      if (onCreateFixedEvent(fixedTitle.trim(), activeSlot.startAt, activeSlot.endAt)) {
        closeSlotDialog()
      }
    }
  }

  const taskLookup = new Map(tasks.map((task) => [task.id, task]))
  const totalCalendarItems = fixedEvents.length + taskSessions.length
  const showEmptyState = !hasProjects || !hasTasks

  return (
    <section className="calendar-panel" aria-labelledby="calendar-heading">
      <header className="calendar-panel__header">
        <div className="calendar-panel__header-info">
          <h1 id="calendar-heading">{heading}</h1>
        </div>
        <div className="calendar-panel__actions">
          {onAutoPlan ? (
            <button
              className="button button--primary button--small"
              onClick={onAutoPlan}
              type="button"
            >
              Auto-Plan Week
            </button>
          ) : null}
          <div className="calendar-nav">
            <button
              aria-label="Previous week"
              className="calendar-nav__btn"
              onClick={() => setWeekOffset((w) => w - 7)}
              type="button"
            >
              ‹
            </button>
            <button
              className="calendar-nav__today"
              onClick={() => setWeekOffset(0)}
              type="button"
            >
              Today
            </button>
            <button
              aria-label="Next week"
              className="calendar-nav__btn"
              onClick={() => setWeekOffset((w) => w + 7)}
              type="button"
            >
              ›
            </button>
          </div>
        </div>
      </header>

      {risks.length > 0 ? (
        <div className="calendar-risks-banner" role="alert">
          <span className="calendar-risks-banner__icon" aria-hidden="true">⚠️</span>
          <div className="calendar-risks-banner__text">
            <strong>{risks.length} Planning Risk(s):</strong>
            <span> {risks[0]?.message}</span>
          </div>
        </div>
      ) : null}

      <div className="calendar-grid">
        <div className="calendar-grid__corner" />
        {week.map((day) => {
          const isToday =
            day.getUTCFullYear() === referenceDate.getUTCFullYear() &&
            day.getUTCMonth() === referenceDate.getUTCMonth() &&
            day.getUTCDate() === referenceDate.getUTCDate()
          return (
            <div className={`calendar-grid__day ${isToday ? 'is-today' : ''}`} key={day.toISOString()}>
              <span className="calendar-grid__day-name">
                {new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(day).toUpperCase()}
              </span>
              <span className="calendar-grid__day-num">
                {day.getUTCDate()}
              </span>
            </div>
          )
        })}
        {hours.flatMap((hour) => [
          <div className="calendar-grid__time" key={`time-${hour}`}>
            {String(hour).padStart(2, '0')}:00
          </div>,
          ...week.map((day) => {
            const slotStart = new Date(
              Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hour, 0, 0),
            ).toISOString()
            const slotEnd = new Date(
              Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hour + 1, 0, 0),
            ).toISOString()

            const slotFixed = fixedEvents.filter(
              (e) => e.startAt >= slotStart && e.startAt < slotEnd,
            )
            const slotSessions = taskSessions.filter(
              (s) => s.startAt >= slotStart && s.startAt < slotEnd,
            )
            const hasItems = slotFixed.length > 0 || slotSessions.length > 0

            const dayLabel = new Intl.DateTimeFormat('en-GB', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
            }).format(day)
            const timeLabel = `${String(hour).padStart(2, '0')}:00`

            return (
              <div
                className={`calendar-grid__slot ${hasItems ? 'is-occupied' : ''}`}
                key={`${day.toISOString()}-${hour}`}
              >
                {slotFixed.map((event) => (
                  <div className="calendar-item calendar-item--fixed" key={event.id}>
                    <div className="calendar-item__content">
                      <div className="calendar-item__meta">
                        <span className="calendar-item__tag">Fixed</span>
                        <button
                          aria-label={`Remove fixed event ${event.title}`}
                          className="calendar-item__delete"
                          onClick={() => onDeleteFixedEvent(event.id)}
                          type="button"
                        >
                          ×
                        </button>
                      </div>
                      <span className="calendar-item__title">{event.title}</span>
                    </div>
                  </div>
                ))}

                {slotSessions.map((session) => {
                  const task = taskLookup.get(session.taskId)
                  const title = task?.title ?? 'Task session'
                  return (
                    <div className="calendar-item calendar-item--session" key={session.id}>
                      <div className="calendar-item__content">
                        <div className="calendar-item__meta">
                          <span className="calendar-item__tag">Session</span>
                          <button
                            aria-label={`Remove session for ${title}`}
                            className="calendar-item__delete"
                            onClick={() => onDeleteTaskSession(session.id)}
                            type="button"
                          >
                            ×
                          </button>
                        </div>
                        <span className="calendar-item__title">{title}</span>
                      </div>
                    </div>
                  )
                })}

                {!hasItems ? (
                  <button
                    aria-label={`Schedule at ${timeLabel} on ${dayLabel}`}
                    className="calendar-grid__add-slot-btn"
                    onClick={() => openSlotDialog(day, hour)}
                    type="button"
                  >
                    <span aria-hidden="true" className="calendar-grid__add-icon">+</span>
                  </button>
                ) : null}
              </div>
            )
          }),
        ])}
      </div>

      {showEmptyState && totalCalendarItems === 0 ? (
        <div className="calendar-empty-state">
          <div className="calendar-empty-state__icon" aria-hidden="true">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
          <h2>
            {!hasProjects
              ? 'Your calendar starts here'
              : 'Your calendar will appear here'}
          </h2>
          <p>
            {!hasProjects
              ? 'Create a project to begin.'
              : 'Add a task first, then schedule sessions into time slots.'}
          </p>
        </div>
      ) : null}

      {activeSlot ? (
        <div
          aria-modal="true"
          className="calendar-dialog-overlay"
          role="dialog"
        >
          <div className="calendar-dialog">
            <h2 id="calendar-dialog-heading">
              Schedule at {String(activeSlot.hour).padStart(2, '0')}:00
            </h2>
            <p className="calendar-dialog__sub">
              {new Intl.DateTimeFormat('en-GB', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              }).format(activeSlot.day)}
            </p>

            <form onSubmit={submitSchedule}>
              <div className="calendar-dialog__modes" role="radiogroup" aria-label="Schedule type">
                <label className="calendar-dialog__radio">
                  <input
                    checked={scheduleMode === 'task'}
                    disabled={tasks.length === 0}
                    name="scheduleMode"
                    onChange={() => setScheduleMode('task')}
                    type="radio"
                    value="task"
                  />
                  <span>Task session</span>
                </label>
                <label className="calendar-dialog__radio">
                  <input
                    checked={scheduleMode === 'fixed'}
                    name="scheduleMode"
                    onChange={() => setScheduleMode('fixed')}
                    type="radio"
                    value="fixed"
                  />
                  <span>Fixed commitment</span>
                </label>
              </div>

              {scheduleMode === 'task' ? (
                <div className="calendar-dialog__field">
                  <label htmlFor="schedule-task-select">Select task</label>
                  <select
                    id="schedule-task-select"
                    onChange={(e) => setChosenTaskId(e.target.value)}
                    value={chosenTaskId}
                  >
                    {tasks.map((task) => (
                      <option key={task.id} value={task.id}>
                        {task.title} {task.completed ? '(Completed)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="calendar-dialog__field">
                  <label htmlFor="fixed-event-title">Commitment title</label>
                  <input
                    id="fixed-event-title"
                    maxLength={200}
                    onChange={(e) => setFixedTitle(e.target.value)}
                    placeholder="e.g. Team standup, Dentist appointment"
                    required
                    value={fixedTitle}
                  />
                </div>
              )}

              <div className="calendar-dialog__actions">
                <button
                  className="text-button"
                  onClick={closeSlotDialog}
                  type="button"
                >
                  Cancel
                </button>
                <button className="button button--primary button--small" type="submit">
                  Confirm
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  )
}

const getWeek = (date: Date): Date[] => {
  const monday = new Date(date)
  const day = monday.getDay() || 7
  monday.setDate(monday.getDate() - day + 1)
  monday.setHours(0, 0, 0, 0)
  return Array.from({ length: 7 }, (_, index) => {
    const result = new Date(monday)
    result.setDate(monday.getDate() + index)
    return result
  })
}
