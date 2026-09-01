import { useState } from 'react'
import type { FormEvent } from 'react'
import type { FixedEvent, Task, TaskSession } from '../../domain/model'

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
}: CalendarPreviewProps) => {
  const week = getWeek(referenceDate)
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
      if (onScheduleTaskSession(chosenTaskId, activeSlot.startAt, activeSlot.endAt)) {
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
        <h1 id="calendar-heading">{heading}</h1>
      </header>

      <div className="calendar-grid">
        <div className="calendar-grid__corner" />
        {week.map((day) => (
          <div className="calendar-grid__day" key={day.toISOString()}>
            {new Intl.DateTimeFormat('en-GB', {
              day: 'numeric',
              month: 'short',
              weekday: 'short',
            }).format(day)}
          </div>
        ))}
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
                        <span className="calendar-item__tag">Fixed</span>
                        <span className="calendar-item__title">{event.title}</span>
                      </div>
                      <button
                        aria-label={`Remove fixed event ${event.title}`}
                        className="calendar-item__delete"
                        onClick={() => onDeleteFixedEvent(event.id)}
                        type="button"
                      >
                        ×
                      </button>
                    </div>
                  ))}

                  {slotSessions.map((session) => {
                    const task = taskLookup.get(session.taskId)
                    const title = task?.title ?? 'Task session'
                    return (
                      <div className="calendar-item calendar-item--session" key={session.id}>
                        <div className="calendar-item__content">
                          <span className="calendar-item__tag">Session</span>
                          <span className="calendar-item__title">{title}</span>
                        </div>
                        <button
                          aria-label={`Remove session for ${title}`}
                          className="calendar-item__delete"
                          onClick={() => onDeleteTaskSession(session.id)}
                          type="button"
                        >
                          ×
                        </button>
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
                      <span aria-hidden="true">+</span>
                    </button>
                  ) : null}
                </div>
              )
            }),
          ]
        )}
      </div>

      {showEmptyState && totalCalendarItems === 0 ? (
        <div className="calendar-empty-state">
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
