import { describe, expect, it } from 'vitest'
import { serialiseBackup } from '../domain/backup'
import type { PlannerDocument } from '../domain/model'
import { LocalPlannerRepository, plannerStorageKey } from './local-planner-repository'

const document: PlannerDocument = {
  schemaVersion: 1,
  timeZone: 'Europe/London',
  revision: 2,
  projects: [
    {
      id: 'project-1',
      title: 'Prepare autumn course',
      createdAt: '2026-09-01T09:00:00.000Z',
      updatedAt: '2026-09-01T09:00:00.000Z',
    },
  ],
  tasks: [
    {
      id: 'task-1',
      projectId: 'project-1',
      title: 'Outline week one',
      completed: false,
      createdAt: '2026-09-01T09:01:00.000Z',
      updatedAt: '2026-09-01T09:01:00.000Z',
    },
  ],
  revisions: [
    {
      id: 'revision-1',
      number: 1,
      kind: 'project-created',
      reason: 'Created project “Prepare autumn course”.',
      occurredAt: '2026-09-01T09:00:00.000Z',
    },
    {
      id: 'revision-2',
      number: 2,
      kind: 'task-created',
      reason: 'Added task “Outline week one”.',
      occurredAt: '2026-09-01T09:01:00.000Z',
    },
  ],
}

class MemoryStorage {
  private readonly values = new Map<string, string>()

  public getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  public setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}

describe('LocalPlannerRepository', () => {
  it('round-trips a complete project and task backup exactly', () => {
    const storage = new MemoryStorage()
    const repository = new LocalPlannerRepository(storage)

    expect(repository.save(document)).toEqual({ ok: true, value: undefined })
    const restored = repository.load()
    expect(restored).toEqual({ ok: true, value: document })
    if (!restored.ok || !restored.value) {
      throw new Error('Expected a restored planner document.')
    }

    const before = serialiseBackup(document)
    const after = serialiseBackup(restored.value)
    expect(after).toEqual(before)
  })

  it('does not overwrite existing local data when an import is invalid', () => {
    const storage = new MemoryStorage()
    const repository = new LocalPlannerRepository(storage)
    const before = serialiseBackup(document)
    if (!before.ok) {
      throw new Error(before.error.message)
    }
    storage.setItem(plannerStorageKey, before.value)

    const invalidBackups = [
      ['not JSON', 'invalid-json'],
      ['{"schemaVersion":99}', 'unsupported-version'],
      [
        JSON.stringify({
          ...document,
          tasks: [{ ...document.tasks[0], projectId: 'missing-project' }],
        }),
        'invalid-backup',
      ],
    ] as const

    for (const [invalidBackup, code] of invalidBackups) {
      const result = repository.restore(invalidBackup)
      expect(result).toMatchObject({ ok: false, error: { code } })
      expect(storage.getItem(plannerStorageKey)).toBe(before.value)
    }
  })
})
