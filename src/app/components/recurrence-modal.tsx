import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type {
  DeadlineType,
  Project,
  RecurrenceFrequency,
  RecurrenceRule,
  Schedule,
  TaskPriority,
} from '../../domain/model'

interface RecurrenceModalProps {
  isOpen: boolean
  recurrenceRules: RecurrenceRule[]
  projects: Project[]
  schedules: Schedule[]
  selectedProjectId: string | null
  onClose: () => void
  onCreateRule: (rule: Omit<RecurrenceRule, 'createdAt' | 'updatedAt'>, horizonDays?: number) => boolean
  onDeleteRule: (ruleId: string, deleteFutureTasks?: boolean) => boolean
  onGenerateTasks: (horizonDays?: number) => boolean
}

const DAY_NAMES = [
  { day: 1, label: 'Mon' },
  { day: 2, label: 'Tue' },
  { day: 3, label: 'Wed' },
  { day: 4, label: 'Thu' },
  { day: 5, label: 'Fri' },
  { day: 6, label: 'Sat' },
  { day: 7, label: 'Sun' },
]

export const RecurrenceModal = ({
  isOpen,
  recurrenceRules,
  projects,
  schedules,
  selectedProjectId,
  onClose,
  onCreateRule,
  onDeleteRule,
  onGenerateTasks,
}: RecurrenceModalProps) => {
  const [isCreating, setIsCreating] = useState(false)

  const [title, setTitle] = useState('')
  const [projectId, setProjectId] = useState(selectedProjectId ?? projects[0]?.id ?? '')
  const [frequency, setFrequency] = useState<RecurrenceFrequency>('WEEKLY')
  const [interval, setInterval] = useState(1)
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1])
  const [estimateMinutes, setEstimateMinutes] = useState(60)
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM')
  const [deadlineType, setDeadlineType] = useState<DeadlineType>('SOFT')
  const [scheduleId, setScheduleId] = useState<string>('')
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10))

  useEffect(() => {
    if (selectedProjectId) {
      setProjectId(selectedProjectId)
    } else if (projects.length > 0 && !projectId) {
      setProjectId(projects[0].id)
    }
  }, [selectedProjectId, projects, projectId])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isCreating) {
          setIsCreating(false)
        } else {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isCreating, onClose])

  if (!isOpen) return null

  const startCreate = () => {
    setTitle('')
    setProjectId(selectedProjectId ?? projects[0]?.id ?? '')
    setFrequency('WEEKLY')
    setInterval(1)
    setDaysOfWeek([1])
    setEstimateMinutes(60)
    setPriority('MEDIUM')
    setDeadlineType('SOFT')
    setScheduleId(schedules.find((s) => s.isDefault)?.id ?? '')
    setStartDate(new Date().toISOString().slice(0, 10))
    setIsCreating(true)
  }

  const toggleDay = (day: number) => {
    if (daysOfWeek.includes(day)) {
      if (daysOfWeek.length === 1) return
      setDaysOfWeek(daysOfWeek.filter((d) => d !== day))
    } else {
      setDaysOfWeek([...daysOfWeek, day].sort((a, b) => a - b))
    }
  }

  const handleSave = (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !projectId) return

    const ruleId = `rec-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
    const success = onCreateRule(
      {
        id: ruleId,
        projectId,
        title: title.trim(),
        frequency,
        interval,
        daysOfWeek: frequency === 'WEEKLY' || frequency === 'BIWEEKLY' ? daysOfWeek : undefined,
        estimateMinutes,
        priority,
        deadlineType,
        scheduleId: scheduleId || undefined,
        startDate: `${startDate}T09:00:00.000Z`,
      },
      90, // Pre-generate 90 days (3 months) ahead
    )

    if (success) {
      setIsCreating(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal-content recurrence-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="recurrence-modal-title"
      >
        <div className="modal-header">
          <h2 id="recurrence-modal-title">🔁 Recurring Tasks Engine</h2>
          <button className="button button--icon" onClick={onClose} type="button" aria-label="Close modal">
            ✕
          </button>
        </div>

        <div className="modal-body">
          {!isCreating ? (
            <div className="recurrence-list-view">
              <p className="recurrence-modal-intro">
                Recurring tasks are explicitly pre-generated up to 3 months ahead as permanent task records.
              </p>

              {recurrenceRules.length === 0 ? (
                <div className="empty-state" style={{ padding: '2rem 1rem' }}>
                  <p>No recurring rules set up yet.</p>
                </div>
              ) : (
                <div className="recurrence-cards">
                  {recurrenceRules.map((rule) => {
                    const project = projects.find((p) => p.id === rule.projectId)
                    const schedule = schedules.find((s) => s.id === rule.scheduleId)
                    return (
                      <div className="recurrence-card" key={rule.id}>
                        <div className="recurrence-card__header">
                          <div>
                            <span className="recurrence-card__title">{rule.title}</span>
                            <span className="recurrence-card__project">📁 {project?.title ?? 'General'}</span>
                          </div>
                          <button
                            className="button button--small button--danger"
                            onClick={() => onDeleteRule(rule.id, true)}
                            type="button"
                          >
                            Delete
                          </button>
                        </div>
                        <div className="recurrence-card__meta">
                          <span className="badge badge--secondary">
                            🔁 {rule.frequency}
                            {rule.daysOfWeek && rule.daysOfWeek.length > 0
                              ? ` (${rule.daysOfWeek.map((d) => DAY_NAMES.find((n) => n.day === d)?.label).join(', ')})`
                              : ''}
                          </span>
                          <span className="badge badge--secondary">⏱ {rule.estimateMinutes ?? 60}m</span>
                          {rule.priority && rule.priority !== 'MEDIUM' ? (
                            <span className="badge badge--primary">{rule.priority}</span>
                          ) : null}
                          {schedule ? (
                            <span className="badge badge--secondary">🗓 {schedule.title}</span>
                          ) : null}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button
                  className="button button--primary"
                  onClick={startCreate}
                  style={{ flex: 1 }}
                  type="button"
                >
                  + Add Recurring Task
                </button>
                {recurrenceRules.length > 0 ? (
                  <button
                    className="button button--secondary"
                    onClick={() => onGenerateTasks(90)}
                    type="button"
                  >
                    Sync 3 Months Ahead
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <form className="recurrence-editor-form" onSubmit={handleSave}>
              <h3>Create Recurring Task Rule</h3>
              <label className="field-group">
                <span className="field-label">Task Title</span>
                <input
                  autoFocus
                  className="input"
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Weekly Status Report, Daily Journal"
                  required
                  type="text"
                  value={title}
                />
              </label>

              <div className="form-row">
                <label className="field-group" style={{ flex: 1 }}>
                  <span className="field-label">Project</span>
                  <select
                    className="input"
                    onChange={(e) => setProjectId(e.target.value)}
                    value={projectId}
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        📁 {p.title}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field-group" style={{ flex: 1 }}>
                  <span className="field-label">Frequency</span>
                  <select
                    className="input"
                    onChange={(e) => setFrequency(e.target.value as RecurrenceFrequency)}
                    value={frequency}
                  >
                    <option value="DAILY">Daily</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="BIWEEKLY">Bi-weekly (Every 2 weeks)</option>
                    <option value="MONTHLY">Monthly</option>
                  </select>
                </label>
              </div>

              {(frequency === 'WEEKLY' || frequency === 'BIWEEKLY') && (
                <div className="field-group">
                  <span className="field-label">Repeat on Days</span>
                  <div className="day-toggle-group">
                    {DAY_NAMES.map((d) => (
                      <button
                        className={`day-toggle-btn ${daysOfWeek.includes(d.day) ? 'day-toggle-btn--active' : ''}`}
                        key={d.day}
                        onClick={() => toggleDay(d.day)}
                        type="button"
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="form-row">
                <label className="field-group" style={{ flex: 1 }}>
                  <span className="field-label">Duration (minutes)</span>
                  <input
                    className="input"
                    max={1440}
                    min={5}
                    onChange={(e) => setEstimateMinutes(parseInt(e.target.value, 10) || 60)}
                    type="number"
                    value={estimateMinutes}
                  />
                </label>

                <label className="field-group" style={{ flex: 1 }}>
                  <span className="field-label">Start Date</span>
                  <input
                    className="input"
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                    type="date"
                    value={startDate}
                  />
                </label>
              </div>

              <div className="form-row">
                <label className="field-group" style={{ flex: 1 }}>
                  <span className="field-label">Priority</span>
                  <select
                    className="input"
                    onChange={(e) => setPriority(e.target.value as TaskPriority)}
                    value={priority}
                  >
                    <option value="ASAP">🔥 ASAP</option>
                    <option value="HIGH">⚡ High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>
                </label>

                <label className="field-group" style={{ flex: 1 }}>
                  <span className="field-label">Availability Schedule</span>
                  <select
                    className="input"
                    onChange={(e) => setScheduleId(e.target.value)}
                    value={scheduleId}
                  >
                    <option value="">Default Schedule</option>
                    {schedules.map((s) => (
                      <option key={s.id} value={s.id}>
                        🗓 {s.title} {s.isDefault ? '(Default)' : ''}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="modal-actions">
                <button
                  className="button button--secondary"
                  onClick={() => setIsCreating(false)}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="button button--primary"
                  disabled={!title.trim() || !projectId}
                  type="submit"
                >
                  Save & Pre-generate (3 Months)
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
