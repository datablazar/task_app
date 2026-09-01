import { useMemo, useState } from 'react'
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
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="4" width="18" height="17" rx="3.5" stroke="currentColor" strokeWidth="2" />
                <path d="M16 2V6M8 2V6M3 9.5H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <circle cx="12" cy="14" r="1.75" fill="currentColor" />
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

      <QuickCaptureBar
        onCreateQuickTask={planner.createQuickTask}
        projects={planner.document.projects}
        selectedProjectId={activeSelectedProjectId}
      />

      <main className="planner-shell">
        <ProjectPanel
          onCreateProject={createProject}
          onSelectProject={setSelectedProjectId}
          projects={planner.document.projects}
          selectedProjectId={activeSelectedProjectId}
          taskCountByProject={taskCountByProject}
        />
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
