import { useMemo, useState } from 'react'
import { PlannerWorkspace } from '../application/planner-workspace'
import { LocalPlannerRepository } from '../infrastructure/local-planner-repository'
import { BackupControls } from './components/backup-controls'
import { CalendarPreview } from './components/calendar-preview'
import { ProjectPanel } from './components/project-panel'
import { TaskPanel } from './components/task-panel'
import { usePlanner } from './use-planner'
import type { StorageLike } from '../infrastructure/local-planner-repository'

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

  const taskCountByProject = useMemo(() => {
    const map = new Map<string, number>()
    for (const task of planner.document.tasks) {
      map.set(task.projectId, (map.get(task.projectId) ?? 0) + 1)
    }
    return map
  }, [planner.document.tasks])

  return (
    <div className="app-shell">
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
        </div>
        <BackupControls className="desktop-backup-actions" onExport={exportBackup} onImport={importBackup} />
      </header>

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
          hasProjects={planner.document.projects.length > 0}
          hasTasks={planner.document.tasks.length > 0}
          onAutoPlan={() => planner.generateAndApplyPlan()}
          onCreateFixedEvent={planner.createFixedEvent}
          onDeleteFixedEvent={planner.deleteFixedEvent}
          onDeleteTaskSession={planner.deleteTaskSession}
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
          onUpdateTaskConstraints={planner.updateTaskConstraints}
          project={selectedProject}
          selectedTaskId={selectedTaskId}
          taskSessions={planner.document.taskSessions}
          tasks={selectedTasks}
        />
      </main>
    </div>
  )
}
