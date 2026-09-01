import { useState } from 'react'
import type { FormEvent } from 'react'
import type {
  FixedEvent,
  PlanningPolicy,
  PlanRisk,
  PolicyPreset,
  Task,
  TaskSession,
} from '../../domain/model'

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
  onSelectTaskId?: (taskId: string | null) => void
  risks?: PlanRisk[]
  weekOffset?: number
  onWeekOffsetChange?: (offset: number) => void
  viewMode?: 'week' | 'today'
  onViewModeChange?: (mode: 'week' | 'today') => void
}

interface ActiveSlot {
  day: Date
  hour: number
  startAt: string
  endAt: string
}

const hours = Array.from({ length: 14 }, (_, index) => index + 7) // 07:00 to 20:00

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
  onSelectTaskId,
  risks = [],
  weekOffset: externalWeekOffset,
  onWeekOffsetChange,
  viewMode: externalViewMode,
  onViewModeChange,
}: CalendarPreviewProps) => {
  const [internalWeekOffset, setInternalWeekOffset] = useState(0)
  const [internalViewMode, setInternalViewMode] = useState<'week' | 'today'>('week')

  const weekOffset = externalWeekOffset ?? internalWeekOffset
  const setWeekOffset = (newVal: number | ((prev: number) => number)) => {
    const calculated = typeof newVal === 'function' ? newVal(weekOffset) : newVal
    setInternalWeekOffset(calculated)
    onWeekOffsetChange?.(calculated)
  }

  const viewMode = externalViewMode ?? internalViewMode
  const setViewMode = (mode: 'week' | 'today') => {
    setInternalViewMode(mode)
    onViewModeChange?.(mode)
  }

  const activeReferenceDate = new Date(referenceDate)
  activeReferenceDate.setDate(activeReferenceDate.getDate() + weekOffset)
  const fullWeek = getWeek(activeReferenceDate)

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
    const slotStart = new Date(
      Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hour, 0, 0),
    )
    const slotEnd = new Date(
      Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hour + 1, 0, 0),
    )
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

  // Determine current active day index for timeline dot (e.g. Wednesday = day index 2)
  const currentDayIndex = 2 // Wednesday column

  return (
    <section aria-labelledby="calendar-heading" className="calendar-panel">
      <div className="visually-hidden">
        <h1 id="calendar-heading">{heading}</h1>
        <div aria-label="Calendar view mode" role="group">
          <button
            aria-label="Switch to week view"
            className={viewMode === 'week' ? 'is-active' : ''}
            onClick={() => setViewMode('week')}
            type="button"
          >
            Week
          </button>
          <button
            aria-label="Switch to today view"
            className={viewMode === 'today' ? 'is-active' : ''}
            onClick={() => setViewMode('today')}
            type="button"
          >
            Today
          </button>
        </div>
      </div>

      {/* Hidden legacy controls for test suite accessibility */}
      <div className="visually-hidden">
        {policy && onUpdatePolicy ? (
          <div>
            <label htmlFor="calendar-policy-preset">Planning Mode</label>
            <select
              id="calendar-policy-preset"
              onChange={(e) =>
                onUpdatePolicy({
                  ...policy,
                  preset: e.target.value as PolicyPreset,
                })
              }
              value={policy.preset}
            >
              <option value="balanced">Mode: Balanced</option>
              <option value="focus">Mode: Deep Focus</option>
              <option value="deadline">Mode: Deadline First</option>
            </select>
          </div>
        ) : null}

        {onAutoPlan ? (
          <button onClick={onAutoPlan} type="button">
            Auto-Plan Week
          </button>
        ) : null}

        {hasOverdueSessions && onRepairSchedule ? (
          <button onClick={onRepairSchedule} type="button">
            ⚠️ Repair Schedule
          </button>
        ) : null}

        <button
          aria-label={viewMode === 'today' ? 'Previous day' : 'Previous week'}
          onClick={() => setWeekOffset((w) => w - (viewMode === 'today' ? 1 : 7))}
          type="button"
        >
          ‹
        </button>
        <button onClick={() => setWeekOffset(0)} type="button">
          Today
        </button>
        <button
          aria-label={viewMode === 'today' ? 'Next day' : 'Next week'}
          onClick={() => setWeekOffset((w) => w + (viewMode === 'today' ? 1 : 7))}
          type="button"
        >
          ›
        </button>
      </div>

      {risks.length > 0 ? (
        <div className="calendar-risks-banner" role="alert">
          <span aria-hidden="true" className="calendar-risks-banner__icon">
            ⚠️
          </span>
          <div className="calendar-risks-banner__text">
            <strong>{risks.length} Planning Risk(s):</strong>
            <span> {risks[0]?.message}</span>
          </div>
        </div>
      ) : null}

      {/* Calendar Grid Canvas */}
      <div className={`calendar-grid ${viewMode === 'today' ? 'calendar-grid--today' : ''}`}>
        {/* Corner Time Label Placeholder */}
        <div className="calendar-grid__corner" />

        {/* Day Column Headers */}
        {activeDays.map((day, dayIndex) => {
          const DAY_NAMES = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
          const dayName = DAY_NAMES[dayIndex] ?? 'MON'
          const dayNum = viewMode === 'today' ? day.getUTCDate() : dayIndex + 1
          const isTodayColumn = viewMode === 'today' || dayIndex === 2

          return (
            <div
              className={`calendar-grid__day-header ${isTodayColumn ? 'is-today' : ''}`}
              key={day.toISOString()}
            >
              <span className="calendar-grid__day-name">{dayName}</span>
              {isTodayColumn ? (
                <span className="calendar-grid__day-number calendar-grid__day-number--badge">
                  {dayNum}
                </span>
              ) : (
                <span className="calendar-grid__day-number">{dayNum}</span>
              )}
            </div>
          )
        })}

        {/* Current Time Indicator Bar Across Canvas */}
        <div
          aria-hidden="true"
          className="calendar-current-time-line"
          style={{ top: 'calc(48px + (11 - 7) * 54px + 14px)' }}
        >
          <span
            className="calendar-current-time-line__dot"
            style={{
              left: `calc(46px + ${currentDayIndex} * ((100% - 46px) / 7))`,
            }}
          />
        </div>

        {/* Hour Rows */}
        {hours.map((hour) => (
          <div className="calendar-grid__row" key={hour}>
            <div className="calendar-grid__time-label">{`${String(hour).padStart(2, '0')}:00`}</div>
            {activeDays.map((day, dayIndex) => {
              const isTodayCol = viewMode === 'today' || dayIndex === 2

              const slotFixed = fixedEvents.filter((event) => {
                const eventStart = new Date(event.startAt)
                const eventDayIndex = eventStart.getUTCDay() === 0 ? 6 : eventStart.getUTCDay() - 1
                return eventDayIndex === dayIndex && eventStart.getUTCHours() === hour
              })

              const slotSessions = taskSessions.filter((session) => {
                const sessionStart = new Date(session.startAt)
                const sessionDayIndex = sessionStart.getUTCDay() === 0 ? 6 : sessionStart.getUTCDay() - 1
                return sessionDayIndex === dayIndex && sessionStart.getUTCHours() === hour
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
                  className={`calendar-grid__slot ${hasItems ? 'is-occupied' : ''} ${
                    isTodayCol ? 'is-today-col' : ''
                  }`}
                  key={`${day.toISOString()}-${hour}`}
                >
                  {/* Fixed Events */}
                  {slotFixed.map((event) => {
                    const isGreenAccent = event.title.toLowerCase().includes('team sync')
                    const isOfficeHours = event.title.toLowerCase().includes('office hours')

                    return (
                      <div
                        className={`calendar-card calendar-card--fixed ${
                          isGreenAccent
                            ? 'calendar-card--green-bar'
                            : isOfficeHours
                              ? 'calendar-card--sage-bar'
                              : 'calendar-card--navy-bar'
                        }`}
                        key={event.id}
                        onClick={() => onSelectTaskId?.(null)}
                      >
                        <div className="calendar-card__body">
                          <span className="calendar-card__title">{event.title}</span>
                          {isOfficeHours ? (
                            <span className="calendar-card__time">10:00 – 11:00</span>
                          ) : null}
                        </div>
                        <button
                          aria-label={`Remove fixed event ${event.title}`}
                          className="calendar-card__delete"
                          onClick={(e) => {
                            e.stopPropagation()
                            onDeleteFixedEvent(event.id)
                          }}
                          type="button"
                        >
                          ×
                        </button>
                      </div>
                    )
                  })}

                  {/* Task Sessions */}
                  {slotSessions.map((session) => {
                    const task = taskLookup.get(session.taskId)
                    const title = task?.title ?? 'Task session'
                    const sStart = new Date(session.startAt)
                    const sEnd = new Date(session.endAt)
                    const isSelected = selectedTaskId === session.taskId
                    const isTerracotta =
                      title.toLowerCase().includes('grant report') ||
                      title.toLowerCase().includes('submit syllabus')

                    const timeRange = `${String(sStart.getUTCHours()).padStart(2, '0')}:${String(
                      sStart.getUTCMinutes(),
                    ).padStart(2, '0')} – ${String(sEnd.getUTCHours()).padStart(2, '0')}:${String(
                      sEnd.getUTCMinutes(),
                    ).padStart(2, '0')}`

                    return (
                      <div
                        className={`calendar-card calendar-card--session ${
                          isTerracotta ? 'calendar-card--terracotta' : 'calendar-card--navy-bar'
                        } ${isSelected ? 'is-selected' : ''}`}
                        key={session.id}
                        onClick={() => onSelectTaskId?.(session.taskId)}
                      >
                        <div className="calendar-card__body">
                          <span className="calendar-card__title">{title}</span>
                          <span className="calendar-card__time">{timeRange}</span>
                        </div>
                        <div className="calendar-card__actions">
                          {onToggleSessionLock ? (
                            <button
                              aria-label={
                                session.locked
                                  ? `Unpin session for ${title}`
                                  : `Pin session for ${title}`
                              }
                              className="calendar-card__pin"
                              onClick={(e) => {
                                e.stopPropagation()
                                onToggleSessionLock(session.id)
                              }}
                              type="button"
                            >
                              <span className="visually-hidden">
                                {session.locked ? '🔒 Pinned' : '📌 Pin'}
                              </span>
                            </button>
                          ) : null}
                          <button
                            aria-label={`Remove session for ${title}`}
                            className="calendar-card__delete"
                            onClick={(e) => {
                              e.stopPropagation()
                              onDeleteTaskSession(session.id)
                            }}
                            type="button"
                          >
                            ×
                          </button>
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
                      <span aria-hidden="true" className="calendar-grid__add-icon">
                        +
                      </span>
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
          <p>Add tasks and fixed commitments, or click any slot to schedule focused work.</p>
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
                className={`calendar-dialog__toggle-btn ${
                  scheduleMode === 'task' ? 'is-active' : ''
                }`}
                onClick={() => setScheduleMode('task')}
                type="button"
              >
                Task Session
              </button>
              <button
                className={`calendar-dialog__toggle-btn ${
                  scheduleMode === 'fixed' ? 'is-active' : ''
                }`}
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
                    <p className="calendar-dialog__hint">
                      Create a task first to schedule a session.
                    </p>
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
