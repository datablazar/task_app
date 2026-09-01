import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { PlannerApp } from './planner-app'
import type { StorageLike } from '../infrastructure/local-planner-repository'

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>()

  public getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  public setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}

describe('PlannerApp', () => {
  it('supports the keyboard path from a new project to a completed task', async () => {
    const user = userEvent.setup()
    const storage = new MemoryStorage()
    let identifier = 0

    render(
      <PlannerApp
        createId={() => {
          identifier += 1
          return `id-${identifier}`
        }}
        now={() => new Date('2026-09-01T09:00:00.000Z')}
        storage={storage}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'New project' }))
    await user.type(screen.getByLabelText('Project name'), 'Prepare autumn course')
    await user.keyboard('{Enter}')

    expect(screen.getByRole('heading', { name: 'Prepare autumn course' })).toBeVisible()

    await user.type(
      screen.getByLabelText('Add a task to Prepare autumn course'),
      'Outline week one',
    )
    await user.keyboard('{Enter}')

    const task = screen.getByRole('checkbox', { name: /outline week one/i })
    expect(task).not.toBeChecked()
    await user.click(task)
    expect(task).toBeChecked()
    expect(storage.getItem('pa-planner:document:v1')).toContain('Outline week one')
  })

  it('schedules a task session on the calendar and persists it to storage', async () => {
    const user = userEvent.setup()
    const storage = new MemoryStorage()
    let identifier = 0

    render(
      <PlannerApp
        createId={() => {
          identifier += 1
          return `id-${identifier}`
        }}
        now={() => new Date('2026-09-01T09:00:00.000Z')}
        storage={storage}
      />,
    )

    // Create project
    await user.click(screen.getByRole('button', { name: 'New project' }))
    await user.type(screen.getByLabelText('Project name'), 'Research Course')
    await user.keyboard('{Enter}')

    // Add task
    await user.type(
      screen.getByLabelText('Add a task to Research Course'),
      'Read paper',
    )
    await user.keyboard('{Enter}')

    // Click slot at 10:00 on Tuesday 1 Sep
    const slotBtn = screen.getByRole('button', { name: /schedule at 10:00 on tue 1/i })
    await user.click(slotBtn)

    // Modal dialog appears
    expect(screen.getByRole('dialog')).toBeVisible()
    expect(screen.getByRole('heading', { name: /schedule at 10:00/i })).toBeVisible()

    // Confirm scheduling task session
    await user.click(screen.getByRole('button', { name: 'Confirm' }))

    // Calendar now displays the session
    expect(screen.getByText('Session')).toBeVisible()
    expect(screen.getAllByText('Read paper')).toHaveLength(2)

    // Task panel displays 1 scheduled badge
    expect(screen.getByText('1 scheduled')).toBeVisible()

    // Verify storage persistence
    const saved = storage.getItem('pa-planner:document:v1')
    expect(saved).toContain('taskSessions')
    expect(saved).toContain('Read paper')
  })
})
