import { describe, expect, it } from 'vitest'
import { parseQuickTaskInput } from './nlp-parser'
import type { Project } from '../model'

describe('parseQuickTaskInput (Live NLP Quick-Capture)', () => {
  const referenceDate = new Date('2026-08-31T09:00:00.000Z') // Monday 9:00 UTC
  const projects: Project[] = [
    {
      id: 'p-res',
      title: 'Academic Research',
      createdAt: referenceDate.toISOString(),
      updatedAt: referenceDate.toISOString(),
    },
    {
      id: 'p-app',
      title: 'Mobile App',
      createdAt: referenceDate.toISOString(),
      updatedAt: referenceDate.toISOString(),
    },
  ]

  it('extracts duration, deadline, and project hashtag in a single input string', () => {
    const input = 'Draft conference slides 90m by Friday at 3pm #Research'
    const result = parseQuickTaskInput(input, projects, referenceDate)

    expect(result.cleanedTitle).toBe('Draft conference slides')
    expect(result.estimateMinutes).toBe(90)
    expect(result.projectId).toBe('p-res')
    expect(result.projectName).toBe('Academic Research')
    expect(result.dueAt).toBe('2026-09-04T15:00:00.000Z') // Friday 15:00 UTC
    expect(result.matchedTokens).toHaveLength(3)
  })

  it('handles relative tomorrow deadline and hour durations', () => {
    const input = 'Prepare team standup notes 1.5h due tomorrow #app'
    const result = parseQuickTaskInput(input, projects, referenceDate)

    expect(result.cleanedTitle).toBe('Prepare team standup notes')
    expect(result.estimateMinutes).toBe(90) // 1.5h = 90m
    expect(result.projectId).toBe('p-app')
    expect(result.dueAt).toBe('2026-09-01T17:00:00.000Z')
  })

  it('preserves clean title when no special tokens are present', () => {
    const input = 'Simple task without constraints'
    const result = parseQuickTaskInput(input, projects, referenceDate)

    expect(result.cleanedTitle).toBe('Simple task without constraints')
    expect(result.estimateMinutes).toBeUndefined()
    expect(result.dueAt).toBeUndefined()
    expect(result.projectId).toBeUndefined()
    expect(result.matchedTokens).toEqual([])
  })
})
