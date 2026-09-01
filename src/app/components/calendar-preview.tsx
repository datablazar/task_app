import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import type { FixedEvent, PlanningPolicy, PlanRisk, Task, TaskSession } from "../../domain/model"

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
  onSelectTaskId?: (taskId: string) => void
  risks?: PlanRisk[]
  weekOffset: number
  onSetWeekOffset: React.Dispatch<React.SetStateAction<number>>
  viewMode: "week" | "today"
  onSetViewMode: (mode: "week" | "today") => void
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
  onToggleSessionLock,
  onSelectTaskId,
  risks = [],
  weekOffset,
  viewMode,
  onSetViewMode,
}: CalendarPreviewProps) => {
  const activeReferenceDate = new Date(referenceDate)
  activeReferenceDate.setDate(activeReferenceDate.getDate() + weekOffset)
  const fullWeek = getWeek(activeReferenceDate)

  const activeDays = viewMode === "today" ? [activeReferenceDate] : fullWeek

  const [activeSlot, setActiveSlot] = useState<ActiveSlot | null>(null)
  const [scheduleMode, setScheduleMode] = useState<"task" | "fixed">("task")
  const [fixedTitle, setFixedTitle] = useState("")
  const [chosenTaskId, setChosenTaskId] = useState<string>(selectedTaskId ?? tasks[0]?.id ?? "")

  // Current time position tracking
  const [currentTime, setCurrentTime] = useState(() => new Date(referenceDate))
  useEffect(() => {
    setCurrentTime(new Date(referenceDate))
  }, [referenceDate])

  const openSlotDialog = (day: Date, hour: number) => {
    const slotStart = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hour, 0, 0))
    const slotEnd = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hour + 1, 0, 0))
    setActiveSlot({
      day,
      hour,
      startAt: slotStart.toISOString(),
      endAt: slotEnd.toISOString(),
    })
    setFixedTitle("")
    setChosenTaskId(selectedTaskId ?? tasks[0]?.id ?? "")
    setScheduleMode(tasks.length > 0 ? "task" : "fixed")
  }

  const closeSlotDialog = () => {
    setActiveSlot(null)
  }

  const submitSchedule = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!activeSlot) return

    if (scheduleMode === "task") {
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

  const todayIso = currentTime.toISOString().slice(0, 10)
  const currentHour = currentTime.getUTCHours()
  const currentMinute = currentTime.getUTCMinutes()

  // Calculate vertical coordinate for live time line
  const timeLineHourOffset = currentHour - 7 + currentMinute / 60
  const showTimeLine = currentHour >= 7 && currentHour <= 21

  const dayName = new Intl.DateTimeFormat("en-GB", { weekday: "long" }).format(activeReferenceDate)
  const dayNum = activeReferenceDate.getUTCDate()
  const monthName = new Intl.DateTimeFormat("en-GB", { month: "long" }).format(activeReferenceDate)
  const year = activeReferenceDate.getUTCFullYear()

  const headingText =
    viewMode === "today"
      ? `${dayName} ${dayNum} ${monthName} ${year}`
      : `${new Intl.DateTimeFormat("en-GB", { weekday: "long" }).format(fullWeek[0])} ${fullWeek[0].getUTCDate()} ${new Intl.DateTimeFormat("en-GB", { month: "long" }).format(fullWeek[0])} – ${new Intl.DateTimeFormat("en-GB", { weekday: "long" }).format(fullWeek[6])} ${fullWeek[6].getUTCDate()} ${new Intl.DateTimeFormat("en-GB", { month: "long" }).format(fullWeek[6])} ${fullWeek[6].getUTCFullYear()}`

  return (
    <section className="calendar-panel" aria-label="Calendar Command Centre">
      <div className="calendar-header-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
        <h1 style={{ fontSize: "1.1rem", fontFamily: "var(--font-serif)", fontWeight: 600 }}>{headingText}</h1>
        <div className="calendar-view-toggle" role="group" aria-label="Calendar view mode">
          <button
            aria-label="Switch to week view"
            className={`calendar-view-btn ${viewMode === "week" ? "is-active" : ""}`}
            onClick={() => onSetViewMode("week")}
            type="button"
          >
            Week
          </button>
          <button
            aria-label="Switch to today view"
            className={`calendar-view-btn ${viewMode === "today" ? "is-active" : ""}`}
            onClick={() => onSetViewMode("today")}
            type="button"
          >
            Day
          </button>
        </div>
      </div>
      {risks.length > 0 ? (
        <div className="calendar-risks-banner" role="alert">
          <span className="calendar-risks-banner__icon" aria-hidden="true">⚠️</span>
          <div className="calendar-risks-banner__text">
            <strong>{risks.length} Planning Risk(s):</strong>
            <span> {risks[0]?.message}</span>
          </div>
        </div>
      ) : null}

      <div className="calendar-canvas-card">
        <div className={`calendar-grid ${viewMode === "today" ? "calendar-grid--today" : ""}`}>
          <div className="calendar-grid__corner" />
          {activeDays.map((day) => {
            const isCurrentToday = day.toISOString().slice(0, 10) === todayIso
            return (
              <div
                className={`calendar-grid__day-header ${isCurrentToday ? "is-today" : ""}`}
                key={day.toISOString()}
              >
                <span className="day-name">
                  {new Intl.DateTimeFormat("en-GB", { weekday: "short" }).format(day).toUpperCase()}
                </span>
                <span className={`day-number ${isCurrentToday ? "day-number--active-badge" : ""}`}>
                  {day.getDate()}
                </span>
              </div>
            )
          })}

          {/* Live Horizontal Current Time Indicator Line */}
          {showTimeLine ? (
            <div
              className="calendar-timeline-indicator"
              style={{
                top: `calc(${timeLineHourOffset * 64 + 48}px)`,
              }}
            >
              <div className="calendar-timeline-dot" />
            </div>
          ) : null}

          {hours.map((hour) => (
            <div className="calendar-grid__row" key={hour}>
              <div className="calendar-grid__time-label">{String(hour).padStart(2, "0")}:00</div>
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
                const dayLabel = new Intl.DateTimeFormat("en-GB", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                }).format(day)
                const timeLabel = `${String(hour).padStart(2, "0")}:00`

                return (
                  <div
                    className={`calendar-grid__slot ${hasItems ? "is-occupied" : ""}`}
                    key={`${day.toISOString()}-${hour}`}
                  >
                    {slotFixed.map((event) => {
                      const isSync = event.title.toLowerCase().includes("sync")
                      const isOffice = event.title.toLowerCase().includes("office")
                      const colorClass = isSync
                        ? "calendar-item--stripe-green"
                        : isOffice
                          ? "calendar-item--stripe-sage"
                          : "calendar-item--stripe-navy"

                      return (
                        <div
                          className={`calendar-item calendar-item--fixed ${colorClass}`}
                          key={event.id}
                        >
                          <div className="calendar-item__content">
                            <div className="calendar-item__meta">
                              <span className="calendar-item__tag">Fixed</span>
                              <button
                                aria-label={`Remove fixed event ${event.title}`}
                                className="calendar-item__delete"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onDeleteFixedEvent(event.id)
                                }}
                                type="button"
                              >
                                ×
                              </button>
                            </div>
                            <span className="calendar-item__title">{event.title}</span>
                          </div>
                        </div>
                      )
                    })}

                    {slotSessions.map((session) => {
                      const task = taskLookup.get(session.taskId)
                      const title = task?.title ?? "Task session"
                      const sStart = new Date(session.startAt)
                      const sEnd = new Date(session.endAt)
                      const durationMins = Math.round((sEnd.getTime() - sStart.getTime()) / (60 * 1000))
                      const timeRange = `${String(sStart.getUTCHours()).padStart(2, "0")}:${String(sStart.getUTCMinutes()).padStart(2, "0")}–${String(sEnd.getUTCHours()).padStart(2, "0")}:${String(sEnd.getUTCMinutes()).padStart(2, "0")}`
                      const isSelected = selectedTaskId === session.taskId
                      const isUrgent = Boolean(
                        task &&
                          (task.priority === "asap" ||
                            (task.deadlineStrictness === "hard" && task.dueAt)),
                      )

                      return (
                        <div
                          className={[
                            "calendar-item",
                            "calendar-item--session",
                            session.locked ? "is-locked" : "",
                            isSelected ? "is-selected" : "",
                            isUrgent ? "calendar-item--urgent-glowing" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          key={session.id}
                          onClick={() => onSelectTaskId?.(session.taskId)}
                        >
                          <div className="calendar-item__content">
                            <div className="calendar-item__meta">
                              <span className="calendar-item__tag">
                                {session.locked ? "🔒 Pinned" : "Session"}
                              </span>
                              <span className="calendar-item__duration" title={`Duration: ${durationMins}m`}>
                                {durationMins}m
                              </span>
                              <div className="calendar-item__actions">
                                {onToggleSessionLock ? (
                                  <button
                                    aria-label={
                                      session.locked
                                        ? `Unpin session for ${title}`
                                        : `Pin session for ${title}`
                                    }
                                    className="calendar-item__pin"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      onToggleSessionLock(session.id)
                                    }}
                                    type="button"
                                  >
                                    {session.locked ? "🔒" : "📌"}
                                  </button>
                                ) : null}
                                <button
                                  aria-label={`Remove session for ${title}`}
                                  className="calendar-item__delete"
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
      </div>

      {/* Quick Schedule Modal */}
      {activeSlot ? (
        <div aria-modal="true" className="calendar-dialog-overlay" role="dialog">
          <div className="calendar-dialog">
            <h2>
              Schedule at {String(activeSlot.hour).padStart(2, "0")}:00 on{" "}
              {new Intl.DateTimeFormat("en-GB", {
                weekday: "short",
                day: "numeric",
                month: "short",
              }).format(activeSlot.day)}
            </h2>

            <div className="calendar-dialog__toggle">
              <button
                className={`calendar-dialog__toggle-btn ${scheduleMode === "task" ? "is-active" : ""}`}
                onClick={() => setScheduleMode("task")}
                type="button"
              >
                Task Session
              </button>
              <button
                className={`calendar-dialog__toggle-btn ${scheduleMode === "fixed" ? "is-active" : ""}`}
                onClick={() => setScheduleMode("fixed")}
                type="button"
              >
                Fixed Event
              </button>
            </div>

            <form onSubmit={submitSchedule}>
              {scheduleMode === "task" ? (
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
                          {task.title} {task.estimateMinutes ? `(${task.estimateMinutes}m)` : ""}
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
                  disabled={scheduleMode === "task" && !chosenTaskId}
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
