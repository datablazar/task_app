import type {
  DeadlineExtractProposal,
  DependencyInferenceProposal,
  DurationEstimateProposal,
  InterpretationContext,
  ProposalPort,
  SubtaskDecompositionProposal,
  TaskInterpretationResult,
} from './proposal-port'

export class HeuristicProposalProvider implements ProposalPort {
  public readonly provenance = 'heuristic' as const

  public async interpretTask(
    taskTitle: string,
    context: InterpretationContext,
  ): Promise<TaskInterpretationResult> {
    const deadline = this.extractDeadline(taskTitle, context.referenceDate)
    const effectiveTitle = deadline ? deadline.cleanedTitle : taskTitle
    const duration = this.estimateDuration(effectiveTitle)
    const decomposition = this.decompose(effectiveTitle)
    const dependency = this.inferDependency(effectiveTitle, context.existingTasks)

    return {
      provenance: this.provenance,
      deadline,
      duration,
      decomposition,
      dependency,
    }
  }

  public extractDeadline(title: string, referenceDate: Date): DeadlineExtractProposal | undefined {
    // 1. "by Friday [at 5pm]" / "due Friday"
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const dayRegex = /\b(?:by|due|before)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)(?:\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?\b/i
    const dayMatch = dayRegex.exec(title)

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
      const cleaned = title.replace(dayRegex, '').replace(/\s{2,}/g, ' ').trim()

      return {
        dueAt: targetDate.toISOString(),
        cleanedTitle: cleaned || title,
        confidence: 0.9,
        rationale: `Detected deadline "${dayMatch[0]}" relative to active reference date.`,
      }
    }

    // 2. "due tomorrow" / "by tomorrow"
    const tomorrowRegex = /\b(?:by|due|before)\s+tomorrow(?:\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?\b/i
    const tomorrowMatch = tomorrowRegex.exec(title)
    if (tomorrowMatch) {
      const targetDate = new Date(referenceDate)
      targetDate.setUTCDate(referenceDate.getUTCDate() + 1)
      targetDate.setUTCHours(17, 0, 0, 0)
      const cleaned = title.replace(tomorrowRegex, '').replace(/\s{2,}/g, ' ').trim()
      return {
        dueAt: targetDate.toISOString(),
        cleanedTitle: cleaned || title,
        confidence: 0.95,
        rationale: 'Detected "tomorrow" deadline requirement.',
      }
    }

    // 3. "by YYYY-MM-DD" or "due DD Month"
    const isoDateRegex = /\b(?:by|due)\s+(\d{4}-\d{2}-\d{2})\b/i
    const isoMatch = isoDateRegex.exec(title)
    if (isoMatch) {
      const parsed = new Date(`${isoMatch[1]}T17:00:00.000Z`)
      if (!Number.isNaN(parsed.getTime())) {
        const cleaned = title.replace(isoDateRegex, '').replace(/\s{2,}/g, ' ').trim()
        return {
          dueAt: parsed.toISOString(),
          cleanedTitle: cleaned || title,
          confidence: 0.98,
          rationale: `Extracted explicit ISO deadline date ${isoMatch[1]}.`,
        }
      }
    }

    return undefined
  }

  public estimateDuration(title: string): DurationEstimateProposal {
    const lower = title.toLowerCase()

    // Explicit minutes / hours match in title (e.g. "45m", "90 min", "2h", "1.5 hours")
    const explicitMin = /\b(\d+)\s*(?:m|min|mins|minutes)\b/i.exec(lower)
    if (explicitMin) {
      const mins = parseInt(explicitMin[1], 10)
      if (mins >= 5 && mins <= 720) {
        return {
          estimateMinutes: mins,
          confidence: 0.98,
          rationale: `Extracted explicit duration of ${mins} minutes from title.`,
        }
      }
    }

    const explicitHour = /\b(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hours)\b/i.exec(lower)
    if (explicitHour) {
      const hours = parseFloat(explicitHour[1])
      const mins = Math.round(hours * 60)
      if (mins >= 15 && mins <= 720) {
        return {
          estimateMinutes: mins,
          confidence: 0.98,
          rationale: `Extracted explicit duration of ${hours} hours (${mins}m) from title.`,
        }
      }
    }

    // Keyword heuristics
    if (/\b(standup|sync|checkin|quick|ping|catchup)\b/i.test(lower)) {
      return {
        estimateMinutes: 15,
        confidence: 0.85,
        rationale: 'Standups, syncs, and check-ins typically take 15 minutes.',
      }
    }
    if (/\b(call|email|review pull|triage|respond)\b/i.test(lower)) {
      return {
        estimateMinutes: 30,
        confidence: 0.8,
        rationale: 'Review and communication tasks typically take ~30 minutes.',
      }
    }
    if (/\b(meeting|presentation|slides|demo|prep)\b/i.test(lower)) {
      return {
        estimateMinutes: 45,
        confidence: 0.8,
        rationale: 'Meetings, presentations, and preparation blocks standardise to ~45 minutes.',
      }
    }
    if (/\b(research|paper|deep work|architecture|algorithm|refactor|benchmark)\b/i.test(lower)) {
      return {
        estimateMinutes: 90,
        confidence: 0.85,
        rationale: 'Deep cognitive research and architectural work benefits from 90m focus blocks.',
      }
    }
    if (/\b(workshop|audit|course|module)\b/i.test(lower)) {
      return {
        estimateMinutes: 120,
        confidence: 0.8,
        rationale: 'Workshops and multi-part audits generally require 2-hour sessions.',
      }
    }

    return {
      estimateMinutes: 60,
      confidence: 0.6,
      rationale: 'Standard default working session of 60 minutes.',
    }
  }

  public decompose(title: string): SubtaskDecompositionProposal | undefined {
    const lower = title.toLowerCase()

    if (/\b(launch|release|ship|deploy)\b/i.test(lower)) {
      return {
        subtasks: [
          'Pre-launch verification & test sweep',
          'Deploy production artifacts',
          'Verify release metrics & customer telemetry',
        ],
        confidence: 0.85,
        rationale: 'Standard 3-stage software release workflow.',
      }
    }

    if (/\b(research|study|paper|investigate)\b/i.test(lower)) {
      return {
        subtasks: [
          'Literature survey & reference gathering',
          'Synthesize core findings & evidence',
          'Draft executive summary notes',
        ],
        confidence: 0.85,
        rationale: 'Standard academic and technical research decomposition.',
      }
    }

    if (/\b(workshop|presentation|talk|seminar)\b/i.test(lower)) {
      return {
        subtasks: [
          'Draft agenda & structure outline',
          'Create slide deck & interactive examples',
          'Dry run rehearsal & timing check',
        ],
        confidence: 0.85,
        rationale: 'Key milestones for presenting workshops and talks.',
      }
    }

    if (/\b(feature|implement|build|develop)\b/i.test(lower)) {
      return {
        subtasks: [
          'Technical spec & domain model',
          'Implement core logic & unit tests',
          'Integration check & code review',
        ],
        confidence: 0.85,
        rationale: 'Robust vertical slice development sequence.',
      }
    }

    const words = title.trim().split(/\s+/)
    if (words.length >= 3) {
      return {
        subtasks: [
          `Prepare initial foundation for ${title}`,
          `Execute main implementation of ${title}`,
          `Review, verify and finalize ${title}`,
        ],
        confidence: 0.6,
        rationale: 'Generalized 3-stage execution template.',
      }
    }

    return undefined
  }

  public inferDependency(
    title: string,
    existingTasks: { id: string; title: string }[],
  ): DependencyInferenceProposal | undefined {
    const lower = title.toLowerCase()

    // Sequential pair patterns: [prePattern, postPattern]
    const sequentialPatterns: [RegExp, RegExp][] = [
      [/\b(spec|requirements|design|wireframe)\b/i, /\b(implement|build|code|develop)\b/i],
      [/\b(implement|build|code|develop)\b/i, /\b(test|qa|verify|review)\b/i],
      [/\b(draft|write)\b/i, /\b(review|edit|proofread|publish)\b/i],
      [/\b(research|survey)\b/i, /\b(write|draft|synthesize)\b/i],
      [/\b(backend|api)\b/i, /\b(frontend|ui|client)\b/i],
    ]

    for (const [prePattern, postPattern] of sequentialPatterns) {
      if (postPattern.test(lower)) {
        // Look for an existing task matching prePattern
        const match = existingTasks.find(
          (t) => t.title.toLowerCase() !== lower && prePattern.test(t.title),
        )
        if (match) {
          return {
            prerequisiteTaskId: match.id,
            prerequisiteTaskTitle: match.title,
            confidence: 0.85,
            rationale: `Sequential pattern detected: “${title}” typically follows “${match.title}”.`,
          }
        }
      }
    }

    return undefined
  }
}
