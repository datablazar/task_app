import { useEffect, useMemo, useState } from 'react'
import { PlannerWorkspace } from '../application/planner-workspace'
import { LocalPlannerRepository } from '../infrastructure/local-planner-repository'
import { BackupControls } from './components/backup-controls'
import { CalendarPreview } from './components/calendar-preview'
import { ProjectPanel } from './components/project-panel'
import { TaskPanel } from './components/task-panel'
import { AiProposalDialog } from './components/ai-proposal-dialog'
import { AiSettingsModal } from './components/ai-settings-modal'
import { QuickCaptureBar } from './components/quick-capture-bar'
import { usePlanner } from './use-planner'
import type { StorageLike } from '../infrastructure/local-planner-repository'
import type { Task } from '../domain/model'
import type { TaskInterpretationResult } from '../domain/interpretation'

interface PlannerAppProps {
  createId?: () => string
  now?: () => Date
  storage?: StorageLike
}

/**
 * Above this width the Projects/Tasks panels are pop-out overlays that
 * default to closed; below it (and wherever matchMedia is unavailable,
 * e.g. tests) they behave as always-present panels in a stacked layout.
 */
const DESKTOP_BREAKPOINT = '(min-width: 901px)'

const useIsDesktop = (): boolean => {
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return true
    }
    try {
      return window.matchMedia(DESKTOP_BREAKPOINT).matches
    } catch {
      return true
    }
  })

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return
    }
    let query: MediaQueryList
    try {
      query = window.matchMedia(DESKTOP_BREAKPOINT)
    } catch {
      return
    }
    const handleChange = () => setIsDesktop(query.matches)
    query.addEventListener('change', handleChange)
    return () => query.removeEventListener('change', handleChange)
  }, [])

  return isDesktop
}

export const PlannerApp = ({ createId, now, storage }: PlannerAppProps) => {
  const repository = useMemo(
    () => new LocalPlannerRepository(storage ?? window.localStorage),
    [storage],
  )
  const workspace = useMemo(() => new PlannerWorkspace(repository), [repository])
  const planner = usePlanner({ workspace, createId, now })
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    planner.document.projects[0]?.id ?? null,
  )
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [referenceDate] = useState(() => now?.() ?? new Date())

  const isDesktop = useIsDesktop()
  const [isProjectsOpen, setIsProjectsOpen] = useState(false)
  const [isTasksOpen, setIsTasksOpen] = useState(false)
  const showProjectsPanel = isProjectsOpen || !isDesktop
  const showTasksPanel = isTasksOpen || !isDesktop

  const selectProject = (projectId: string) => {
    setSelectedProjectId(projectId)
    setIsTasksOpen(true)
  }

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
  const [activeInterpretation, setActiveInterpretation] = useState<TaskInterpretationResult | null>(null)
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
    setIsTasksOpen(true)
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
      map.set(task.projectId, (map.get(task.projectId) ?? 0) + 1)
    }
    return map
  }, [planner.document.tasks])

  const providerLabel =
    planner.providerMode === 'simulated-ai'
      ? '✨ AI: Preview Mode'
      : planner.providerMode === 'gemini-api'
        ? '🤖 AI: Live Gemini'
        : '⚡ AI: Local Rules'

  return (
    <div className="app-shell" data-theme={theme}>
      <header className="app-header">
        <div className="app-header__identity">
          <div className="brand-lockup">
            <span className="brand-logo" aria-hidden="true">
              <svg width="24" height="24" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 8C2 8 8 2 13 8C18 14 24 18 24 18" stroke="var(--brand-primary)" strokeWidth="2.2" strokeLinecap="round" />
                <path d="M2 18C2 18 8 24 13 18C18 12 24 8 24 8" stroke="var(--sage-primary)" strokeWidth="2.2" strokeLinecap="round" />
                <circle cx="13" cy="13" r="2" fill="var(--brand-accent)" />
              </svg>
            </span>
            <div className="brand-text">
              <span className="brand">PA Planner</span>
              <span className="brand-tag">Local Command Centre</span>
            </div>
          </div>
          <span
            aria-live="polite"
            className={`save-status save-status--${planner.notice.tone}`}
            role="status"
          >
            <span aria-hidden="true" className="save-status__icon">
              {planner.notice.tone === 'success' ? '✓' : '!'}
            </span>
            {planner.notice.message}
          </span>
          {planner.canUndo ? (
            <button
              className="button button--secondary button--small"
              onClick={planner.undoLastPlan}
              type="button"
            >
              ↶ Undo Plan
            </button>
          ) : null}
          <button
            className="button button--secondary button--small ai-mode-badge-btn"
            onClick={() => setShowAiSettings(true)}
            title="Configure AI Providers and API keys"
            type="button"
          >
            {providerLabel}
          </button>
        </div>

        <QuickCaptureBar
          onCreateQuickTask={planner.createQuickTask}
          projects={planner.document.projects}
          selectedProjectId={activeSelectedProjectId}
        />

        <div className="backup-actions">
          <button
            aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            className="theme-toggle-btn"
            onClick={toggleTheme}
            title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            type="button"
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
          <BackupControls className="desktop-backup-actions" onExport={exportBackup} onImport={importBackup} />
        </div>
      </header>

      <main className="planner-shell">
        <nav aria-label="Panel navigation" className="app-rail">
          <button
            aria-label="Toggle Projects panel"
            aria-pressed={isProjectsOpen}
            className={`app-rail__btn${isProjectsOpen ? ' is-active' : ''}`}
            onClick={() => setIsProjectsOpen((open) => !open)}
            title="Projects"
            type="button"
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.7"
              />
            </svg>
          </button>
          <button
            aria-label="Toggle Tasks panel"
            aria-pressed={isTasksOpen}
            className={`app-rail__btn${isTasksOpen ? ' is-active' : ''}`}
            onClick={() => setIsTasksOpen((open) => !open)}
            title="Tasks"
            type="button"
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 12h4l2 3h4l2-3h4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
              <path
                d="M4 12V6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v6"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.7"
              />
              <path
                d="M4 12v6a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-6"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.7"
              />
            </svg>
          </button>
        </nav>

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
          onToggleSessionLock={planner.toggleSessionLock}
          onUpdatePolicy={planner.updatePolicy}
          policy={planner.document.policy}
          referenceDate={referenceDate}
          risks={planner.risks}
          selectedTaskId={selectedTaskId}
          taskSessions={planner.document.taskSessions}
          tasks={planner.document.tasks}
        />

        {showProjectsPanel ? (
          <ProjectPanel
            onCreateProject={createProject}
            onSelectProject={selectProject}
            projects={planner.document.projects}
            selectedProjectId={activeSelectedProjectId}
            taskCountByProject={taskCountByProject}
          />
        ) : null}

        {showTasksPanel ? (
          <TaskPanel
            dependencies={planner.document.dependencies}
            onCreateDependency={planner.createDependency}
            onCreateSubtask={planner.createSubtask}
            onCreateTask={planner.createTask}
            onDeleteDependency={planner.deleteDependency}
            onExport={exportBackup}
            onImport={importBackup}
            onSelectTaskId={setSelectedTaskId}
            onSetTaskCompletion={planner.setTaskCompletion}
            onTriggerAi={handleTriggerAi}
            onUpdateTaskConstraints={planner.updateTaskConstraints}
            project={selectedProject}
            selectedTaskId={selectedTaskId}
            taskSessions={planner.document.taskSessions}
            tasks={selectedTasks}
          />
        ) : null}
      </main>

      {/* AI Proposal Modal */}
      {activeAiTask && activeInterpretation ? (
        <AiProposalDialog
          interpretation={activeInterpretation}
          onAcceptDeadline={(dueAt) =>
            planner.acceptDeadline(activeAiTask.id, dueAt, activeInterpretation.provenance)
          }
          onAcceptDependency={(prereqId) =>
            planner.acceptDependency(activeAiTask.id, prereqId, activeInterpretation.provenance)
          }
          onAcceptDuration={(minutes) =>
            planner.acceptDuration(activeAiTask.id, minutes, activeInterpretation.provenance)
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
            planner.dismissProposal(activeAiTask.id, cap, activeInterpretation.provenance)
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
