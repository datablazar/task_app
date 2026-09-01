interface CalendarPreviewProps {
  hasProjects: boolean
  hasTasks: boolean
  referenceDate: Date
}

const hours = Array.from({ length: 15 }, (_, index) => index + 7)

export const CalendarPreview = ({
  hasProjects,
  hasTasks,
  referenceDate,
}: CalendarPreviewProps) => {
  const week = getWeek(referenceDate)
  const heading = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
  }).format(week[0])
  const message = getCalendarMessage(hasProjects, hasTasks)

  return (
    <section className="calendar-panel" aria-labelledby="calendar-heading">
      <header className="calendar-panel__header">
        <h1 id="calendar-heading">{heading}</h1>
      </header>
      <div aria-hidden="true" className="calendar-grid">
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
          ...week.map((day) => (
            <div className="calendar-grid__slot" key={`${day.toISOString()}-${hour}`} />
          )),
        ])}
      </div>
      <div className="calendar-empty-state">
        <h2>{message.title}</h2>
        <p>{message.description}</p>
      </div>
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

const getCalendarMessage = (hasProjects: boolean, hasTasks: boolean) => {
  if (!hasProjects) {
    return {
      title: 'Your calendar starts here',
      description: 'Create a project to begin.',
    }
  }
  if (!hasTasks) {
    return {
      title: 'Your calendar will appear here',
      description: 'Add a task first. Manual planning comes next.',
    }
  }
  return {
    title: 'Your calendar will appear here',
    description: 'Manual planning comes next.',
  }
}
