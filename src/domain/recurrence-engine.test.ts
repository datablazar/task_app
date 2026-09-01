import { describe, expect, it } from 'vitest'
import { calculateRecurrenceDates, generateTasksFromRecurrenceRule } from './recurrence-engine'
import type { RecurrenceRule } from './model'

describe('recurrence-engine', () => {
  const baseRule: RecurrenceRule = {
    id: 'rec-1',
    projectId: 'proj-1',
    title: 'Weekly Team Sync',
    frequency: 'WEEKLY',
    daysOfWeek: [1, 3], // Mon & Wed
    startDate: '2026-09-01T09:00:00.000Z', // Tuesday Sep 1
    createdAt: '2026-09-01T09:00:00.000Z',
    updatedAt: '2026-09-01T09:00:00.000Z',
  }

  it('calculates weekly recurrence dates matching target days of the week', () => {
    // Horizon: Sep 1 to Sep 15 (2 weeks)
    const horizonEnd = new Date('2026-09-15T23:59:59.000Z')
    const dates = calculateRecurrenceDates(baseRule, horizonEnd)

    // Should include:
    // Sep 2 (Wed), Sep 7 (Mon), Sep 9 (Wed), Sep 14 (Mon)
    expect(dates).toEqual([
      '2026-09-02',
      '2026-09-07',
      '2026-09-09',
      '2026-09-14',
    ])
  })

  it('calculates daily recurrence dates with intervals', () => {
    const dailyRule: RecurrenceRule = {
      ...baseRule,
      frequency: 'DAILY',
      interval: 2, // Every 2 days
      startDate: '2026-09-01T09:00:00.000Z',
    }
    const horizonEnd = new Date('2026-09-08T00:00:00.000Z')
    const dates = calculateRecurrenceDates(dailyRule, horizonEnd)

    expect(dates).toEqual([
      '2026-09-01',
      '2026-09-03',
      '2026-09-05',
      '2026-09-07',
    ])
  })

  it('calculates monthly recurrence dates on the same day of month', () => {
    const monthlyRule: RecurrenceRule = {
      ...baseRule,
      frequency: 'MONTHLY',
      interval: 1,
      startDate: '2026-09-15T09:00:00.000Z',
    }
    const horizonEnd = new Date('2026-12-01T00:00:00.000Z')
    const dates = calculateRecurrenceDates(monthlyRule, horizonEnd)

    expect(dates).toEqual([
      '2026-09-15',
      '2026-10-15',
      '2026-11-15',
    ])
  })

  it('idempotently generates new tasks and avoids duplicate instances', () => {
    let idCounter = 1
    const createId = () => `task-${idCounter++}`
    const horizonEnd = new Date('2026-09-08T00:00:00.000Z')

    // Initial generation
    const firstBatch = generateTasksFromRecurrenceRule(baseRule, [], horizonEnd, createId)
    // Sep 2, Sep 7
    expect(firstBatch).toHaveLength(2)
    expect(firstBatch[0].recurrenceInstanceDate).toBe('2026-09-02')
    expect(firstBatch[1].recurrenceInstanceDate).toBe('2026-09-07')

    // Second generation with existing tasks
    const secondBatch = generateTasksFromRecurrenceRule(baseRule, firstBatch, horizonEnd, createId)
    expect(secondBatch).toHaveLength(0) // No duplicates
  })
})
