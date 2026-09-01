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

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__identity">
          <span className="brand">PA Planner</span>
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
        </div>
        <BackupControls className="desktop-backup-actions" onExport={exportBackup} onImport={importBackup} />
      </header>

      <main className="planner-shell">
        <ProjectPanel
          onCreateProject={createProject}
          onSelectProject={setSelectedProjectId}
          projects={planner.document.projects}
          selectedProjectId={activeSelectedProjectId}
        />
        <CalendarPreview
          hasProjects={planner.document.projects.length > 0}
          hasTasks={planner.document.tasks.length > 0}
          referenceDate={referenceDate}
        />
        <TaskPanel
          onCreateTask={planner.createTask}
          onExport={exportBackup}
          onImport={importBackup}
          onSetTaskCompletion={planner.setTaskCompletion}
          project={selectedProject}
          tasks={selectedTasks}
        />
      </main>
    </div>
  )
}
