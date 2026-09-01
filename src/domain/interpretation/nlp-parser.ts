import type { Project } from '../model'

export interface ParsedQuickTask {
  rawInput: string
  cleanedTitle: string
  projectId?: string
  projectName?: string
  estimateMinutes?: number
  dueAt?: string
  matchedTokens: {
    kind: 'project' | 'duration' | 'deadline'
    label: string
    token: string
  }[]
}

export const parseQuickTaskInput = (
  input: string,
  projects: Project[],
  referenceDate: Date = new Date(),
): ParsedQuickTask => {
  let text = input.trim()
  const matchedTokens: ParsedQuickTask['matchedTokens'] = []

  let matchedProject: Project | undefined
  let estimateMinutes: number | undefined
  let dueAt: string | undefined

  // 1. Extract Project Hashtag (e.g. #Course, #Research, #backend)
  const projectRegex = /#([\w-]+)/i
  const projectMatch = projectRegex.exec(text)
  if (projectMatch) {
    const query = projectMatch[1].toLowerCase()
    matchedProject = projects.find(
      (p) =>
        p.title.toLowerCase().includes(query) ||
        p.id.toLowerCase() === query ||
        p.title.toLowerCase().replace(/\s+/g, '') === query,
    )
    if (matchedProject) {
      matchedTokens.push({
        kind: 'project',
        label: `📁 ${matchedProject.title}`,
        token: projectMatch[0],
      })
      text = text.replace(projectRegex, '').trim()
    }
  }

  // 2. Extract Duration (e.g. 45m, 90 min, 1.5h, 2 hours)
  const durationMinRegex = /\b(\d+)\s*(?:m|min|mins|minutes)\b/i
  const minMatch = durationMinRegex.exec(text)
  if (minMatch) {
    const mins = parseInt(minMatch[1], 10)
    if (mins >= 5 && mins <= 1440) {
      estimateMinutes = mins
      matchedTokens.push({
        kind: 'duration',
        label: `⏱ ${mins}m`,
        token: minMatch[0],
      })
      text = text.replace(durationMinRegex, '').trim()
    }
  } else {
    const durationHourRegex = /\b(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hours)\b/i
    const hourMatch = durationHourRegex.exec(text)
    if (hourMatch) {
      const hours = parseFloat(hourMatch[1])
      const mins = Math.round(hours * 60)
      if (mins >= 15 && mins <= 1440) {
        estimateMinutes = mins
        matchedTokens.push({
          kind: 'duration',
          label: `⏱ ${mins}m (${hours}h)`,
          token: hourMatch[0],
        })
        text = text.replace(durationHourRegex, '').trim()
      }
    }
  }

  // 3. Extract Deadline (e.g. "by Friday [at 5pm]", "due tomorrow", "by YYYY-MM-DD")
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const dayRegex = /\b(?:by|due|before)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)(?:\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?\b/i
  const dayMatch = dayRegex.exec(text)

  if (dayMatch) {
    const targetDayName = dayMatch[1].toLowerCase()
    const targetDayIndex = dayNames.indexOf(targetDayName)
    const currentDayIndex = referenceDate.getUTCDay()

    let daysAhead = targetDayIndex - currentDayIndex
    if (daysAhead <= 0) {
      daysAhead += 7
    }

    const targetDate = new Date(referenceDate)
    targetDate.setUTCDate(referenceDate.getUTCDate() + daysAhead)

    let hour = 17 // Default 17:00
    let minute = 0
    if (dayMatch[2]) {
      let rawHour = parseInt(dayMatch[2], 10)
      const isPm = dayMatch[4]?.toLowerCase() === 'pm'
      const isAm = dayMatch[4]?.toLowerCase() === 'am'
      if (isPm && rawHour < 12) rawHour += 12
      if (isAm && rawHour === 12) rawHour = 0
      hour = rawHour
      if (dayMatch[3]) {
        minute = parseInt(dayMatch[3], 10)
      }
    }

    targetDate.setUTCHours(hour, minute, 0, 0)
    dueAt = targetDate.toISOString()
    matchedTokens.push({
      kind: 'deadline',
      label: `📅 ${dayMatch[1].slice(0, 3)} ${targetDate.getDate()} ${hour}:${String(minute).padStart(2, '0')}`,
      token: dayMatch[0],
    })
    text = text.replace(dayRegex, '').trim()
  } else {
    const tomorrowRegex = /\b(?:by|due|before)\s+tomorrow(?:\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?\b/i
    const tomorrowMatch = tomorrowRegex.exec(text)
    if (tomorrowMatch) {
      const targetDate = new Date(referenceDate)
      targetDate.setUTCDate(referenceDate.getUTCDate() + 1)
      targetDate.setUTCHours(17, 0, 0, 0)
      dueAt = targetDate.toISOString()
      matchedTokens.push({
        kind: 'deadline',
        label: '📅 Tomorrow 17:00',
        token: tomorrowMatch[0],
      })
      text = text.replace(tomorrowRegex, '').trim()
    } else {
      const isoRegex = /\b(?:by|due)\s+(\d{4}-\d{2}-\d{2})\b/i
      const isoMatch = isoRegex.exec(text)
      if (isoMatch) {
        const parsed = new Date(`${isoMatch[1]}T17:00:00.000Z`)
        if (!Number.isNaN(parsed.getTime())) {
          dueAt = parsed.toISOString()
          matchedTokens.push({
            kind: 'deadline',
            label: `📅 ${isoMatch[1]}`,
            token: isoMatch[0],
          })
          text = text.replace(isoRegex, '').trim()
        }
      }
    }
  }

  // Clean up any remaining multiple spaces
  const cleanedTitle = text.replace(/\s{2,}/g, ' ').trim()

  return {
    rawInput: input,
    cleanedTitle: cleanedTitle || input.trim(),
    projectId: matchedProject?.id,
    projectName: matchedProject?.title,
    estimateMinutes,
    dueAt,
    matchedTokens,
  }
}
