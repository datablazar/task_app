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

  it('supports adding subtasks and updating task constraints', async () => {
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
    await user.type(screen.getByLabelText('Project name'), 'Thesis Writing')
    await user.keyboard('{Enter}')

    // Add main task
    await user.type(
      screen.getByLabelText('Add a task to Thesis Writing'),
      'Chapter 1',
    )
    await user.keyboard('{Enter}')

    // Edit constraints for Chapter 1
    const editBtn = screen.getByRole('button', { name: /edit constraints for chapter 1/i })
    await user.click(editBtn)

    const durationInput = screen.getByLabelText(/estimated duration/i)
    await user.type(durationInput, '45')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    // Expect constraint badge to appear
    expect(screen.getByText('⏱ 45m')).toBeVisible()

    // Add a subtask
    const addSubtaskBtn = screen.getByRole('button', { name: /\+ add subtask/i })
    await user.click(addSubtaskBtn)

    const subtaskInput = screen.getByPlaceholderText('Add a subtask')
    await user.type(subtaskInput, 'Introduction Section')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    // Expect subtask to appear
    expect(screen.getByText('Introduction Section')).toBeVisible()

    // Verify persistence
    const saved = storage.getItem('pa-planner:document:v1')
    expect(saved).toContain('Introduction Section')
    expect(saved).toContain('parentTaskId')
    expect(saved).toContain('45')
  })

  it('generates a reference schedule respecting dependencies and allows exact undo', async () => {
    const user = userEvent.setup()
    const storage = new MemoryStorage()
    let idCounter = 1
    const createId = () => `id-${idCounter++}`
    const fixedNow = new Date('2026-09-01T09:00:00.000Z') // Tuesday 9am

    render(
      <PlannerApp
        createId={createId}
        now={() => fixedNow}
        storage={storage}
      />,
    )

    // Create project
    await user.click(screen.getByRole('button', { name: 'New project' }))
    const projectInput = screen.getByPlaceholderText('Project name')
    await user.type(projectInput, 'App Redesign')
    await user.click(screen.getByRole('button', { name: 'Create' }))

    // Create Task 1
    const taskInput = screen.getByPlaceholderText('Add a task')
    await user.type(taskInput, 'Wireframes{enter}')
    expect(screen.getByText('Wireframes')).toBeVisible()

    // Create Task 2
    await user.type(taskInput, 'Mockups{enter}')
    expect(screen.getByText('Mockups')).toBeVisible()

    // Add dependency: Mockups depends on Wireframes
    await user.click(screen.getByRole('button', { name: 'Edit constraints for Mockups' }))

    const prereqSelect = screen.getByLabelText(/depends on prerequisite task/i)
    await user.selectOptions(prereqSelect, 'Wireframes')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByText('🔗 After: Wireframes')).toBeVisible()

    // Click Auto-Plan Week
    const autoPlanBtn = screen.getByRole('button', { name: /auto-plan week/i })
    await user.click(autoPlanBtn)

    // Expect status message and scheduled badges
    expect(screen.getByRole('status')).toHaveTextContent(/Scheduled 2 session\(s\)/i)

    // Verify Undo Plan button appears and click it
    const undoBtn = screen.getByRole('button', { name: /↶ undo plan/i })
    expect(undoBtn).toBeVisible()
    await user.click(undoBtn)

    expect(screen.getByRole('status')).toHaveTextContent(/Reverted to previous schedule/i)
  })
})
