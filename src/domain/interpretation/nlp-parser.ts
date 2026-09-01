import type { DeadlineType, Project, Schedule, TaskPriority } from '../model'

export interface ParsedQuickTask {
  rawInput: string
  cleanedTitle: string
  projectId?: string
  projectName?: string
  estimateMinutes?: number
  dueAt?: string
  priority?: TaskPriority
  deadlineType?: DeadlineType
  labels?: string[]
  scheduleId?: string
  scheduleName?: string
  matchedTokens: {
    kind: 'project' | 'duration' | 'deadline' | 'priority' | 'label' | 'deadline-type' | 'schedule'
    label: string
    token: string
  }[]
}

export const parseQuickTaskInput = (
  input: string,
  projects: Project[],
  referenceDate: Date = new Date(),
  schedules: Schedule[] = [],
): ParsedQuickTask => {
  let text = input.trim()
  const matchedTokens: ParsedQuickTask['matchedTokens'] = []

  let matchedProject: Project | undefined
  let matchedSchedule: Schedule | undefined
  let estimateMinutes: number | undefined
  let dueAt: string | undefined
  let priority: TaskPriority | undefined
  let deadlineType: DeadlineType | undefined
  const labels: string[] = []

  // 1. Extract Priority (e.g. !asap, !urgent, p1, !high, p2, !med, p3, !low, p4)
  const priorityAsapRegex = /(?:!asap|!urgent|\bp1\b)/i
  const priorityHighRegex = /(?:!high|\bp2\b)/i
  const priorityMedRegex = /(?:!medium|!med|\bp3\b)/i
  const priorityLowRegex = /(?:!low|\bp4\b)/i

  if (priorityAsapRegex.test(text)) {
    const match = priorityAsapRegex.exec(text)!
    priority = 'ASAP'
    matchedTokens.push({ kind: 'priority', label: '🔥 ASAP', token: match[0] })
    text = text.replace(priorityAsapRegex, '').trim()
  } else if (priorityHighRegex.test(text)) {
    const match = priorityHighRegex.exec(text)!
    priority = 'HIGH'
    matchedTokens.push({ kind: 'priority', label: '⚡ High', token: match[0] })
    text = text.replace(priorityHighRegex, '').trim()
  } else if (priorityMedRegex.test(text)) {
    const match = priorityMedRegex.exec(text)!
    priority = 'MEDIUM'
    matchedTokens.push({ kind: 'priority', label: 'Med', token: match[0] })
    text = text.replace(priorityMedRegex, '').trim()
  } else if (priorityLowRegex.test(text)) {
    const match = priorityLowRegex.exec(text)!
    priority = 'LOW'
    matchedTokens.push({ kind: 'priority', label: 'Low', token: match[0] })
    text = text.replace(priorityLowRegex, '').trim()
  }

  // 2. Extract Deadline Strictness (e.g. !hard, !strict, hard deadline, !soft)
  const hardRegex = /(?:!hard|!strict|\bhard deadline\b)/i
  const softRegex = /(?:!soft|\bsoft deadline\b)/i
  if (hardRegex.test(text)) {
    const match = hardRegex.exec(text)!
    deadlineType = 'HARD'
    matchedTokens.push({ kind: 'deadline-type', label: '🔒 Hard', token: match[0] })
    text = text.replace(hardRegex, '').trim()
  } else if (softRegex.test(text)) {
    const match = softRegex.exec(text)!
    deadlineType = 'SOFT'
    matchedTokens.push({ kind: 'deadline-type', label: 'Soft', token: match[0] })
    text = text.replace(softRegex, '').trim()
  }

  // 3. Extract Hashtags (Project or Labels)
  const hashtagRegex = /#([\w-]+)/gi
  let tagMatch: RegExpExecArray | null
  const matchedTagTokens: { raw: string; tag: string }[] = []
  while ((tagMatch = hashtagRegex.exec(text)) !== null) {
    matchedTagTokens.push({ raw: tagMatch[0], tag: tagMatch[1] })
  }

  for (const item of matchedTagTokens) {
    const query = item.tag.toLowerCase()
    // If not matched a project yet, check if tag matches any project
    if (!matchedProject) {
      const candidate = projects.find((p) => {
        const title = p.title.toLowerCase()
        const id = p.id.toLowerCase()
        const slug = title.replace(/\s+/g, '')
        return title === query || id === query || slug === query || title.includes(query) || id.includes(query)
      })
      if (candidate) {
        matchedProject = candidate
        matchedTokens.push({
          kind: 'project',
          label: `📁 ${matchedProject.title}`,
          token: item.raw,
        })
        text = text.replace(item.raw, '').trim()
        continue
      }
    }

    if (!labels.includes(query)) {
      labels.push(query)
      matchedTokens.push({
        kind: 'label',
        label: `#${query}`,
        token: item.raw,
      })
    }
    text = text.replace(item.raw, '').trim()
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

  // 4. Extract Schedule (e.g. @"Night Owls", @Night Owls, @work, @personal)
  for (const s of schedules) {
    const title = s.title
    const slug = title.replace(/\s+/g, '')
    const kebab = title.replace(/\s+/g, '-')
    const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pattern = new RegExp(`@(?:"${escapedTitle}"|'${escapedTitle}'|${escapedTitle}|${slug}|${kebab}|${s.id})\\b`, 'i')
    const match = pattern.exec(text)
    if (match && !matchedSchedule) {
      matchedSchedule = s
      matchedTokens.push({
        kind: 'schedule',
        label: `🗓 ${s.title}`,
        token: match[0],
      })
      text = text.replace(pattern, '').trim()
      break
    }
  }

  if (!matchedSchedule) {
    const fallbackRegex = /@([\w-]+)/i
    const fbMatch = fallbackRegex.exec(text)
    if (fbMatch) {
      const query = fbMatch[1].toLowerCase()
      const candidate = schedules.find((s) => {
        const title = s.title.toLowerCase()
        const id = s.id.toLowerCase()
        const slug = title.replace(/\s+/g, '')
        return title === query || id === query || slug === query || title.includes(query)
      })
      if (candidate) {
        matchedSchedule = candidate
        matchedTokens.push({
          kind: 'schedule',
          label: `🗓 ${candidate.title}`,
          token: fbMatch[0],
        })
        text = text.replace(fallbackRegex, '').trim()
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
    priority,
    deadlineType,
    labels: labels.length > 0 ? labels : undefined,
    scheduleId: matchedSchedule?.id,
    scheduleName: matchedSchedule?.title,
    matchedTokens,
  }
}
