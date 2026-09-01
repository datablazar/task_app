import { useState } from 'react'
import type { FormEvent } from 'react'
import type { FixedEvent, PlanningPolicy, PlanRisk, PolicyPreset, Task, TaskSession } from '../../domain/model'

interface CalendarPreviewProps {
  hasProjects: boolean
  hasTasks: boolean
  referenceDate: Date
  tasks: Task[]
  fixedEvents: FixedEvent[]
  taskSessions: TaskSession[]
  policy?: PlanningPolicy
  selectedTaskId: string | null
  hasOverdueSessions?: boolean
  onCreateFixedEvent: (title: string, startAt: string, endAt: string) => boolean
  onScheduleTaskSession: (taskId: string, startAt: string, endAt: string) => boolean
  onDeleteFixedEvent: (eventId: string) => boolean
  onDeleteTaskSession: (sessionId: string) => boolean
  onToggleSessionLock?: (sessionId: string) => boolean
  onUpdatePolicy?: (policy: PlanningPolicy) => boolean
  onAutoPlan?: () => void
  onRepairSchedule?: () => void
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
  policy,
  selectedTaskId,
  hasOverdueSessions,
  onCreateFixedEvent,
  onScheduleTaskSession,
  onDeleteFixedEvent,
  onDeleteTaskSession,
  onToggleSessionLock,
  onUpdatePolicy,
  onAutoPlan,
  onRepairSchedule,
  risks = [],
}: CalendarPreviewProps) => {
  const [weekOffset, setWeekOffset] = useState(0)
  const [viewMode, setViewMode] = useState<'week' | 'today'>('week')

  const activeReferenceDate = new Date(referenceDate)
  activeReferenceDate.setDate(activeReferenceDate.getDate() + weekOffset)
  const fullWeek = getWeek(activeReferenceDate)

  // In 'today' mode, only display active day (today or selected offset)
  const activeDays = viewMode === 'today' ? [activeReferenceDate] : fullWeek

  const heading =
    viewMode === 'today'
      ? new Intl.DateTimeFormat('en-GB', {
          day: 'numeric',
          month: 'long',
          weekday: 'long',
        }).format(activeReferenceDate)
      : new Intl.DateTimeFormat('en-GB', {
          day: 'numeric',
          month: 'long',
          weekday: 'long',
        }).format(fullWeek[0])

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

  const todayIso = new Date().toISOString().slice(0, 10)

  return (
    <section className="calendar-panel" aria-labelledby="calendar-heading">
      <header className="calendar-panel__header">
        <div className="calendar-panel__header-info">
          <h1 id="calendar-heading">{heading}</h1>
          <div className="view-mode-toggle" role="group" aria-label="Calendar view mode">
            <button
              aria-label="Switch to week view"
              className={`view-mode-toggle__btn ${viewMode === 'week' ? 'is-active' : ''}`}
              onClick={() => setViewMode('week')}
              type="button"
            >
              Week
            </button>
            <button
              aria-label="Switch to today view"
              className={`view-mode-toggle__btn ${viewMode === 'today' ? 'is-active' : ''}`}
              onClick={() => setViewMode('today')}
              type="button"
            >
              Today
            </button>
          </div>
        </div>

        <div className="calendar-panel__actions">
          {policy && onUpdatePolicy ? (
            <div className="calendar-policy-select">
              <label htmlFor="calendar-policy-preset" className="visually-hidden">
                Planning Mode
              </label>
              <select
                id="calendar-policy-preset"
                className="calendar-policy-dropdown"
                value={policy.preset}
                onChange={(e) =>
                  onUpdatePolicy({
                    ...policy,
                    preset: e.target.value as PolicyPreset,
                  })
                }
              >
                <option value="balanced">Mode: Balanced (6h max/day)</option>
                <option value="focus">Mode: Deep Focus (Contiguous)</option>
                <option value="deadline">Mode: Deadline First (Urgent)</option>
              </select>
            </div>
          ) : null}

          {hasOverdueSessions && onRepairSchedule ? (
            <button
              className="button button--warning button--small"
              onClick={onRepairSchedule}
              title="Reschedule overdue past sessions into upcoming open slots"
              type="button"
            >
              ⚠️ Repair Schedule
            </button>
          ) : null}

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
              aria-label={viewMode === 'today' ? 'Previous day' : 'Previous week'}
              className="calendar-nav__btn"
              onClick={() => setWeekOffset((w) => w - (viewMode === 'today' ? 1 : 7))}
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
              aria-label={viewMode === 'today' ? 'Next day' : 'Next week'}
              className="calendar-nav__btn"
              onClick={() => setWeekOffset((w) => w + (viewMode === 'today' ? 1 : 7))}
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

      <div className={`calendar-grid ${viewMode === 'today' ? 'calendar-grid--today' : ''}`}>
        <div className="calendar-grid__corner" />
        {activeDays.map((day) => {
          const isCurrentToday = day.toISOString().slice(0, 10) === todayIso
          return (
            <div
              className={`calendar-grid__day-header ${isCurrentToday ? 'is-today' : ''}`}
              key={day.toISOString()}
            >
              <span className="day-name">
                {new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(day).toUpperCase()}
              </span>
              <span className="day-number">{day.getDate()}</span>
            </div>
          )
        })}

        {hours.map((hour) => (
          <div className="calendar-grid__row" key={hour}>
            <div className="calendar-grid__time-label">{`${String(hour).padStart(2, '0')}:00`}</div>
            {activeDays.map((day) => {
              const slotFixed = fixedEvents.filter((event) => {
                const eventStart = new Date(event.startAt)
                return (
                  eventStart.getUTCFullYear() === day.getUTCFullYear() &&
                  eventStart.getUTCMonth() === day.getUTCMonth() &&
                  eventStart.getUTCDate() === day.getUTCDate() &&
                  eventStart.getUTCHours() === hour
                )
              })

              const slotSessions = taskSessions.filter((session) => {
                const sessionStart = new Date(session.startAt)
                return (
                  sessionStart.getUTCFullYear() === day.getUTCFullYear() &&
                  sessionStart.getUTCMonth() === day.getUTCMonth() &&
                  sessionStart.getUTCDate() === day.getUTCDate() &&
                  sessionStart.getUTCHours() === hour
                )
              })

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
                    const sStart = new Date(session.startAt)
                    const sEnd = new Date(session.endAt)
                    const durationMins = Math.round((sEnd.getTime() - sStart.getTime()) / (60 * 1000))
                    const timeRange = `${String(sStart.getUTCHours()).padStart(2, '0')}:${String(sStart.getUTCMinutes()).padStart(2, '0')}–${String(sEnd.getUTCHours()).padStart(2, '0')}:${String(sEnd.getUTCMinutes()).padStart(2, '0')}`

                    return (
                      <div
                        className={`calendar-item calendar-item--session ${session.locked ? 'is-locked' : ''}`}
                        key={session.id}
                      >
                        <div className="calendar-item__content">
                          <div className="calendar-item__meta">
                            <span className="calendar-item__tag">{session.locked ? '🔒 Pinned' : 'Session'}</span>
                            <span className="calendar-item__duration" title={`Duration: ${durationMins}m`}>
                              {durationMins}m
                            </span>
                            <div className="calendar-item__actions">
                              {onToggleSessionLock ? (
                                <button
                                  aria-label={session.locked ? `Unpin session for ${title}` : `Pin session for ${title}`}
                                  className="calendar-item__pin"
                                  onClick={() => onToggleSessionLock(session.id)}
                                  type="button"
                                >
                                  {session.locked ? '🔒' : '📌'}
                                </button>
                              ) : null}
                              <button
                                aria-label={`Remove session for ${title}`}
                                className="calendar-item__delete"
                                onClick={() => onDeleteTaskSession(session.id)}
                                type="button"
                              >
                                ×
                              </button>
                            </div>
                          </div>
                          <span className="calendar-item__title">{title}</span>
                          <span className="calendar-item__time-subtext">{timeRange}</span>
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
            })}
          </div>
        ))}
      </div>

      {showEmptyState && totalCalendarItems === 0 ? (
        <div className="calendar-placeholder-card">
          <div className="calendar-placeholder-card__icon">📅</div>
          <h3>Your calendar starts here</h3>
          <p>
            Add tasks and fixed commitments, or click any slot to schedule focused work.
          </p>
        </div>
      ) : null}

      {/* Quick Schedule Modal */}
      {activeSlot ? (
        <div aria-modal="true" className="calendar-dialog-overlay" role="dialog">
          <div className="calendar-dialog">
            <h2>
              Schedule at {String(activeSlot.hour).padStart(2, '0')}:00 on{' '}
              {new Intl.DateTimeFormat('en-GB', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
              }).format(activeSlot.day)}
            </h2>

            <div className="calendar-dialog__toggle">
              <button
                className={`calendar-dialog__toggle-btn ${scheduleMode === 'task' ? 'is-active' : ''}`}
                onClick={() => setScheduleMode('task')}
                type="button"
              >
                Task Session
              </button>
              <button
                className={`calendar-dialog__toggle-btn ${scheduleMode === 'fixed' ? 'is-active' : ''}`}
                onClick={() => setScheduleMode('fixed')}
                type="button"
              >
                Fixed Event
              </button>
            </div>

            <form onSubmit={submitSchedule}>
              {scheduleMode === 'task' ? (
                <div className="calendar-dialog__field">
                  <label htmlFor="slot-task-select">Select Task</label>
                  {tasks.length > 0 ? (
                    <select
                      id="slot-task-select"
                      onChange={(e) => setChosenTaskId(e.target.value)}
                      value={chosenTaskId}
                    >
                      {tasks.map((task) => (
                        <option key={task.id} value={task.id}>
                          {task.title} {task.estimateMinutes ? `(${task.estimateMinutes}m)` : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="calendar-dialog__hint">Create a task first to schedule a session.</p>
                  )}
                </div>
              ) : (
                <div className="calendar-dialog__field">
                  <label htmlFor="slot-fixed-title">Event Title</label>
                  <input
                    id="slot-fixed-title"
                    maxLength={200}
                    onChange={(e) => setFixedTitle(e.target.value)}
                    placeholder="e.g. Doctor appointment, Lecture"
                    required
                    value={fixedTitle}
                  />
                </div>
              )}

              <div className="calendar-dialog__actions">
                <button className="text-button" onClick={closeSlotDialog} type="button">
                  Cancel
                </button>
                <button
                  className="button button--primary button--small"
                  disabled={scheduleMode === 'task' && !chosenTaskId}
                  type="submit"
                >
                  Schedule
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
  const current = new Date(date)
  current.setUTCHours(0, 0, 0, 0)
  const day = current.getUTCDay()
  const diff = current.getUTCDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(current.setUTCDate(diff))

  return Array.from({ length: 7 }, (_, index) => {
    const next = new Date(monday)
    next.setUTCDate(monday.getUTCDate() + index)
    return next
  })
}
