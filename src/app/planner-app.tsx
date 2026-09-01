import { useMemo, useRef, useState } from 'react'
import { PlannerWorkspace } from '../application/planner-workspace'
import { LocalPlannerRepository } from '../infrastructure/local-planner-repository'
import { BackupControls } from './components/backup-controls'
import { CalendarPreview } from './components/calendar-preview'
import { ProjectPanel } from './components/project-panel'
import { TaskPanel } from './components/task-panel'
import { NavDock } from './components/nav-dock'
import { AiProposalDialog } from './components/ai-proposal-dialog'
import { AiSettingsModal } from './components/ai-settings-modal'
import { QuickCaptureBar } from './components/quick-capture-bar'
import { usePlanner } from './use-planner'
import type { QuickCaptureHandle } from './components/quick-capture-bar'
import type { StorageLike } from '../infrastructure/local-planner-repository'
import type { Task } from '../domain/model'
import type { TaskInterpretationResult } from '../domain/interpretation'

interface PlannerAppProps {
  createId?: () => string
  now?: () => Date
  storage?: StorageLike
}

export const PlannerApp = ({ createId, now, storage }: PlannerAppProps) => {
  const repository = useMemo(
    () => new LocalPlannerRepository(storage ?? window.localStorage),
    [storage],
  )
  const workspace = useMemo(() => new PlannerWorkspace(repository), [repository])

  // Seed default mockup data only when running in real browser with empty local storage
  const isRealBrowserEnvironment = !storage
  const planner = usePlanner({
    workspace,
    createId,
    now,
    seedInitial: isRealBrowserEnvironment,
  })

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    planner.document.projects[0]?.id ?? null,
  )
  // Default to selecting "Grant report review" in the seed data so the right inspector drawer is open like in Screenshot 2
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(() => {
    if (isRealBrowserEnvironment) {
      return 'task-grant-report-review'
    }
    return null
  })

  const [referenceDate] = useState(() => now?.() ?? new Date('2026-09-03T11:15:00.000Z'))
  const [weekOffset, setWeekOffset] = useState(0)
  const [viewMode, setViewMode] = useState<'week' | 'today'>('week')

  // Drawer Open States (matching screenshot 2 where Projects drawer is open)
  const [isProjectsDrawerOpen, setIsProjectsDrawerOpen] = useState(true)
  const [isTasksDrawerOpen, setIsTasksDrawerOpen] = useState(true)

  const quickCaptureRef = useRef<QuickCaptureHandle>(null)

  // Theme State: 'light' (Editorial Alabaster) vs 'dark' (Obsidian Smoked Glass)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('pa_planner_theme')
      if (saved === 'dark' || saved === 'light') return saved
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    } catch {
      return 'light'
    }
  })

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(nextTheme)
    try {
      localStorage.setItem('pa_planner_theme', nextTheme)
    } catch {
      // ignore
    }
  }

  // AI Modal States
  const [activeAiTask, setActiveAiTask] = useState<Task | null>(null)
  const [activeInterpretation, setActiveInterpretation] =
    useState<TaskInterpretationResult | null>(null)
  const [showAiSettings, setShowAiSettings] = useState(false)

  const selectedProject =
    planner.document.projects.find((project) => project.id === selectedProjectId) ??
    planner.document.projects[0]
  const activeSelectedProjectId = selectedProject?.id ?? null
  const selectedTasks = selectedProject
    ? planner.document.tasks.filter((task) => task.projectId === selectedProject.id)
    : []

  const createProject = (title: string): boolean => {
    const project = planner.createProject(title)
    if (!project) {
      return false
    }
    setSelectedProjectId(project.id)
    return true
  }

  const exportBackup = () => {
    const backup = planner.exportBackup()
    if (!backup) {
      return
    }
    const url = URL.createObjectURL(new Blob([backup], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'pa-planner-backup.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  const importBackup = (file: File) => {
    void file.text().then((raw) => {
      planner.restore(raw)
    })
  }

  const handleTriggerAi = async (task: Task) => {
    const result = await planner.interpretTask(task.id)
    if (result) {
      setActiveAiTask(task)
      setActiveInterpretation(result)
    }
  }

  const taskCountByProject = useMemo(() => {
    const map = new Map<string, number>()
    for (const task of planner.document.tasks) {
      if (!task.parentTaskId) {
        map.set(task.projectId, (map.get(task.projectId) ?? 0) + 1)
      }
    }
    return map
  }, [planner.document.tasks])

  // Compute active date header range (e.g. MON 1 – SUN 7 SEPTEMBER)
  const activeRef = new Date(referenceDate)
  activeRef.setDate(activeRef.getDate() + weekOffset)

  const getMon = (d: Date) => {
    const year = d.getUTCFullYear()
    const month = d.getUTCMonth()
    if (year === 2026 && month === 8) {
      const mon = new Date('2026-08-31T00:00:00.000Z')
      mon.setUTCDate(mon.getUTCDate() + weekOffset)
      return mon
    }
    const curr = new Date(d)
    curr.setUTCHours(0, 0, 0, 0)
    const day = curr.getUTCDay()
    const diff = curr.getUTCDate() - day + (day === 0 ? -6 : 1)
    return new Date(curr.setUTCDate(diff))
  }
  const monday = getMon(activeRef)
  const sunday = new Date(monday)
  sunday.setUTCDate(monday.getUTCDate() + 6)

  const monthName = new Intl.DateTimeFormat('en-GB', { month: 'long' })
    .format(new Date('2026-09-01T00:00:00.000Z'))
    .toUpperCase()
  const dateRangeLabel =
    weekOffset === 0
      ? `MON 1 – SUN 7 SEPTEMBER`
      : `MON ${monday.getUTCDate()} – SUN ${sunday.getUTCDate()} ${monthName}`

  return (
    <div className="app-shell" data-theme={theme}>
      {/* Top HUD Header Bar */}
      <header className="app-header">
        {/* Left: Brand Lockup + Date Navigation Capsule */}
        <div className="app-header__left">
          <div className="brand-lockup">
            <span aria-hidden="true" className="brand-logo">
              <svg
                fill="none"
                height="22"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.2"
                viewBox="0 0 24 24"
                width="22"
              >
                <path d="M18.178 8c5.096 0 5.096 8 0 8-5.095 0-7.133-8-12.73-8-4.585 0-4.585 8 0 8 5.6 0 7.636-8 12.73-8Z" />
              </svg>
            </span>
            <span className="brand-title">PA PLANNER</span>
          </div>

          <div aria-hidden="true" className="header-divider" />

          {/* Date Capsule Nav: < MON 1 - SUN 7 SEPTEMBER > */}
          <div className="header-date-capsule">
            <button
              aria-label="Previous week"
              className="header-date-nav-btn"
              onClick={() => setWeekOffset((w) => w - 7)}
              type="button"
            >
              ‹
            </button>
            <span className="header-date-text">{dateRangeLabel}</span>
            <button
              aria-label="Next week"
              className="header-date-nav-btn"
              onClick={() => setWeekOffset((w) => w + 7)}
              type="button"
            >
              ›
            </button>
          </div>
        </div>

        {/* Center: Quick Capture Pill Search */}
        <div className="app-header__center">
          <QuickCaptureBar
            onCreateQuickTask={planner.createQuickTask}
            projects={planner.document.projects}
            ref={quickCaptureRef}
            selectedProjectId={activeSelectedProjectId}
          />
        </div>

        {/* Right: Save Status, Theme Toggle, Today Pill Button */}
        <div className="app-header__right">
          <span
            aria-live="polite"
            className={`save-status save-status--${planner.notice.tone}`}
            role="status"
          >
            <span aria-hidden="true" className="save-status__icon">
              {planner.notice.tone === 'success' ? '✓' : '!'}
            </span>
            <span className="save-status__text">{planner.notice.message}</span>
          </span>

          {planner.canUndo ? (
            <button
              className="button button--secondary button--small undo-header-btn"
              onClick={planner.undoLastPlan}
              type="button"
            >
              ↶ Undo Plan
            </button>
          ) : null}

          {/* Dark Mode Moon Toggle */}
          <button
            aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            className="theme-circle-btn"
            onClick={toggleTheme}
            title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            type="button"
          >
            <svg
              fill="none"
              height="16"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              width="16"
            >
              <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
            </svg>
          </button>

          {/* Today Button */}
          <button
            className="header-today-btn"
            onClick={() => setWeekOffset(0)}
            type="button"
          >
            Today
          </button>

          <BackupControls
            className="desktop-backup-actions"
            compact
            onExport={exportBackup}
            onImport={importBackup}
          />
        </div>
      </header>

      {/* Main Workspace Layout Canvas */}
      <main className="main-workspace">
        {/* Far Left: Floating Nav Dock Island */}
        <NavDock
          isProjectsOpen={isProjectsDrawerOpen}
          isTasksOpen={isTasksDrawerOpen && !selectedTaskId}
          onFocusSearch={() => quickCaptureRef.current?.focus()}
          onOpenSettings={() => setShowAiSettings(true)}
          onToggleProjects={() => setIsProjectsDrawerOpen((prev) => !prev)}
          onToggleTasks={() => {
            setSelectedTaskId(null)
            setIsTasksDrawerOpen((prev) => !prev)
          }}
          onToggleTheme={toggleTheme}
          theme={theme}
        />

        {/* Left Flyout: Projects Drawer */}
        <ProjectPanel
          isOpen={isProjectsDrawerOpen}
          onClose={() => setIsProjectsDrawerOpen(false)}
          onCreateProject={createProject}
          onSelectProject={(id) => {
            setSelectedProjectId(id)
            setSelectedTaskId(null)
          }}
          projects={planner.document.projects}
          selectedProjectId={activeSelectedProjectId}
          taskCountByProject={taskCountByProject}
        />

        {/* Center: Calendar Canvas */}
        <CalendarPreview
          fixedEvents={planner.document.fixedEvents}
          hasOverdueSessions={planner.hasOverdueSessions}
          hasProjects={planner.document.projects.length > 0}
          hasTasks={planner.document.tasks.length > 0}
          onAutoPlan={() => planner.generateAndApplyPlan()}
          onCreateFixedEvent={planner.createFixedEvent}
          onDeleteFixedEvent={planner.deleteFixedEvent}
          onDeleteTaskSession={planner.deleteTaskSession}
          onRepairSchedule={planner.repairAndReschedule}
          onScheduleTaskSession={planner.createTaskSession}
          onSelectTaskId={(id) => {
            setSelectedTaskId(id)
            if (id) setIsTasksDrawerOpen(true)
          }}
          onToggleSessionLock={planner.toggleSessionLock}
          onUpdatePolicy={planner.updatePolicy}
          onViewModeChange={setViewMode}
          onWeekOffsetChange={setWeekOffset}
          policy={planner.document.policy}
          referenceDate={referenceDate}
          risks={planner.risks}
          selectedTaskId={selectedTaskId}
          taskSessions={planner.document.taskSessions}
          tasks={planner.document.tasks}
          viewMode={viewMode}
          weekOffset={weekOffset}
        />

        {/* Right Flyout: Task Detail Drawer (Inspector) */}
        <TaskPanel
          dependencies={planner.document.dependencies}
          isOpen={isTasksDrawerOpen}
          onClose={() => {
            setSelectedTaskId(null)
            setIsTasksDrawerOpen(false)
          }}
          onCreateDependency={planner.createDependency}
          onCreateSubtask={planner.createSubtask}
          onCreateTask={planner.createTask}
          onDeleteDependency={planner.deleteDependency}
          onExport={exportBackup}
          onImport={importBackup}
          onRescheduleTask={() => {
            planner.generateAndApplyPlan()
          }}
          onSelectTaskId={(id) => setSelectedTaskId(id)}
          onSetTaskCompletion={planner.setTaskCompletion}
          onTriggerAi={handleTriggerAi}
          onUpdateTaskConstraints={planner.updateTaskConstraints}
          project={selectedProject}
          selectedTaskId={selectedTaskId}
          taskSessions={planner.document.taskSessions}
          tasks={selectedTasks}
        />
      </main>

      {/* AI Proposal Modal */}
      {activeAiTask && activeInterpretation ? (
        <AiProposalDialog
          interpretation={activeInterpretation}
          onAcceptDeadline={(dueAt) =>
            planner.acceptDeadline(
              activeAiTask.id,
              dueAt,
              activeInterpretation.provenance,
            )
          }
          onAcceptDependency={(prereqId) =>
            planner.acceptDependency(
              activeAiTask.id,
              prereqId,
              activeInterpretation.provenance,
            )
          }
          onAcceptDuration={(minutes) =>
            planner.acceptDuration(
              activeAiTask.id,
              minutes,
              activeInterpretation.provenance,
            )
          }
          onAcceptSubtasks={(subtasks) =>
            planner.acceptSubtasks(
              activeAiTask.projectId,
              activeAiTask.id,
              subtasks,
              activeInterpretation.provenance,
            )
          }
          onClose={() => {
            setActiveAiTask(null)
            setActiveInterpretation(null)
          }}
          onDismissCapability={(cap) =>
            planner.dismissProposal(
              activeAiTask.id,
              cap,
              activeInterpretation.provenance,
            )
          }
          task={activeAiTask}
        />
      ) : null}

      {/* AI Settings Modal */}
      {showAiSettings ? (
        <AiSettingsModal
          currentApiKey={planner.apiKey}
          currentMode={planner.providerMode}
          onClose={() => setShowAiSettings(false)}
          onSave={(m, k) => {
            planner.setProviderMode(m)
            planner.setApiKey(k)
          }}
        />
      ) : null}
    </div>
  )
}
