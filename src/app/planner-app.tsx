import { useEffect, useMemo, useRef, useState } from "react"
import { PlannerWorkspace } from "../application/planner-workspace"
import { LocalPlannerRepository } from "../infrastructure/local-planner-repository"
import { BackupControls } from "./components/backup-controls"
import { CalendarPreview } from "./components/calendar-preview"
import { ProjectPanel } from "./components/project-panel"
import { TaskPanel } from "./components/task-panel"
import { NavDock } from "./components/nav-dock"
import { AiProposalDialog } from "./components/ai-proposal-dialog"
import { AiSettingsModal } from "./components/ai-settings-modal"
import { ScheduleModal } from "./components/schedule-modal"
import { RecurringModal } from "./components/recurring-modal"
import { QuickCaptureBar } from "./components/quick-capture-bar"
import { usePlanner } from "./use-planner"
import type { StorageLike } from "../infrastructure/local-planner-repository"
import type { PolicyPreset, Task } from "../domain/model"
import type { TaskInterpretationResult } from "../domain/interpretation"

interface PlannerAppProps {
  createId?: () => string
  now?: () => Date
  storage?: StorageLike
}

const DESKTOP_BREAKPOINT = "(min-width: 901px)"

const useIsDesktop = (): boolean => {
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return true
    }
    try {
      return window.matchMedia(DESKTOP_BREAKPOINT).matches
    } catch {
      return true
    }
  })

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return
    }
    let query: MediaQueryList
    try {
      query = window.matchMedia(DESKTOP_BREAKPOINT)
    } catch {
      return
    }
    const handleChange = () => setIsDesktop(query.matches)
    query.addEventListener("change", handleChange)
    return () => query.removeEventListener("change", handleChange)
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
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(
    planner.document.tasks[0]?.id ?? null,
  )
  const [referenceDate] = useState(() => now?.() ?? new Date())

  const isDesktop = useIsDesktop()
  const [leftDrawerMode, setLeftDrawerMode] = useState<"projects" | "inbox" | null>(null)
  const [isTaskInspectorOpen, setIsTaskInspectorOpen] = useState(false)
  const [weekOffset, setWeekOffset] = useState(0)
  const [viewMode, setViewMode] = useState<"week" | "today">("week")

  const [projectsFocusToken, setProjectsFocusToken] = useState(0)
  const quickCaptureInputRef = useRef<HTMLInputElement>(null)

  // Theme State: light (Editorial Alabaster) vs dark (Obsidian Smoked Glass)
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    try {
      const saved = localStorage.getItem("planner_theme")
      if (saved === "dark" || saved === "light") return saved
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
    } catch {
      return "light"
    }
  })

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light"
    setTheme(nextTheme)
    try {
      localStorage.setItem("planner_theme", nextTheme)
    } catch {
      // ignore
    }
  }

  // Modals State
  const [showAiSettings, setShowAiSettings] = useState(false)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [showRecurringModal, setShowRecurringModal] = useState(false)
  const [activeAiTask, setActiveAiTask] = useState<Task | null>(null)
  const [activeInterpretation, setActiveInterpretation] = useState<TaskInterpretationResult | null>(null)

  // Global keyboard shortcuts (Escape closes drawers & modals in order)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (activeAiTask || showAiSettings || showScheduleModal || showRecurringModal) {
          setActiveAiTask(null)
          setActiveInterpretation(null)
          setShowAiSettings(false)
          setShowScheduleModal(false)
          setShowRecurringModal(false)
        } else if (isTaskInspectorOpen) {
          setIsTaskInspectorOpen(false)
        } else if (leftDrawerMode !== null) {
          setLeftDrawerMode(null)
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [activeAiTask, isTaskInspectorOpen, leftDrawerMode, showAiSettings, showRecurringModal, showScheduleModal])

  const toggleProjectsDrawer = () => {
    setLeftDrawerMode((curr) => {
      const next = curr === "projects" ? null : "projects"
      if (next === "projects") setProjectsFocusToken((t) => t + 1)
      return next
    })
  }

  const toggleInboxDrawer = () => {
    setLeftDrawerMode((curr) => {
      const next = curr === "inbox" ? null : "inbox"
      if (next === "inbox") setProjectsFocusToken((t) => t + 1)
      return next
    })
  }

  const selectProject = (projectId: string) => {
    setSelectedProjectId(projectId)
    const firstTask = planner.document.tasks.find(
      (t) => t.projectId === projectId && !t.parentTaskId,
    )
    if (firstTask) {
      setSelectedTaskId(firstTask.id)
    }
  }

  const handleSelectTask = (taskId: string) => {
    setSelectedTaskId(taskId)
    setIsTaskInspectorOpen(true)
  }

  const selectedTask = useMemo(() => {
    if (!selectedTaskId) return undefined
    return planner.document.tasks.find((t) => t.id === selectedTaskId)
  }, [planner.document.tasks, selectedTaskId])

  const selectedProject =
    planner.document.projects.find((project) => project.id === selectedProjectId) ??
    planner.document.projects[0]
  const activeSelectedProjectId = selectedProject?.id ?? null

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

  const exportBackup = () => {
    const backup = planner.exportBackup()
    if (!backup) return
    const url = URL.createObjectURL(new Blob([backup], { type: "application/json" }))
    const link = document.createElement("a")
    link.href = url
    link.download = "planner-backup.json"
    link.click()
    URL.revokeObjectURL(url)
  }

  const importBackup = (file: File) => {
    void file.text().then((raw) => {
      planner.restore(raw)
    })
  }

  // Active date range text for top bar
  const activeReferenceDate = new Date(referenceDate)
  activeReferenceDate.setDate(activeReferenceDate.getDate() + weekOffset)
  const currentWeek = getWeek(activeReferenceDate)

  const dateHeadingText =
    viewMode === "today"
      ? new Intl.DateTimeFormat("en-GB", {
          day: "numeric",
          month: "short",
          weekday: "short",
        }).format(activeReferenceDate)
      : `${new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric" }).format(currentWeek[0]).toUpperCase()} – ${new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "long" }).format(currentWeek[6]).toUpperCase()}`

  const providerLabel =
    planner.providerMode === "simulated-ai"
      ? "✨ AI: Preview"
      : planner.providerMode === "gemini-api"
        ? "🤖 AI: Live"
        : "⚡ AI: Local"

  const showLeftDrawer = leftDrawerMode !== null
  const showRightDrawer = isTaskInspectorOpen && Boolean(selectedTask)

  return (
    <div className="app-shell" data-theme={theme}>
      {/* Floating Top Navigation Bar */}
      <header className="floating-top-bar">
        <div className="top-bar__left">
          <div className="brand-minimal-icon" title="Command Centre">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M18.178 8c5.096 0 5.096 8 0 8-3.058 0-4.077-2.667-6.178-5.333C9.899 8 8.88 5.333 5.822 5.333c-5.096 0-5.096 8 0 8 3.058 0 4.077-2.667 6.178-5.333"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <div className="top-bar__date-switcher">
            <button
              aria-label={viewMode === "today" ? "Previous day" : "Previous week"}
              className="date-nav-btn"
              onClick={() => setWeekOffset((w) => w - (viewMode === "today" ? 1 : 7))}
              type="button"
            >
              ‹
            </button>
            <span className="top-bar__date-label">{dateHeadingText}</span>
            <button
              aria-label={viewMode === "today" ? "Next day" : "Next week"}
              className="date-nav-btn"
              onClick={() => setWeekOffset((w) => w + (viewMode === "today" ? 1 : 7))}
              type="button"
            >
              ›
            </button>
          </div>
        </div>

        <div className="top-bar__center">
          <QuickCaptureBar
            inputRef={quickCaptureInputRef}
            onCreateQuickTask={planner.createQuickTask}
            projects={planner.document.projects}
            selectedProjectId={activeSelectedProjectId}
          />
        </div>

        <div className="top-bar__right">
          <span
            aria-live="polite"
            className={`save-status save-status--${planner.notice.tone}`}
            role="status"
          >
            <span aria-hidden="true" className="save-status__icon">
              {planner.notice.tone === "success" ? "✓" : "!"}
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

          {planner.document.policy ? (
            <select
              aria-label="Planning Mode"
              className="top-bar-policy-dropdown"
              onChange={(e) =>
                planner.updatePolicy({
                  ...planner.document.policy,
                  preset: e.target.value as PolicyPreset,
                })
              }
              value={planner.document.policy.preset}
            >
              <option value="balanced">Mode: Balanced</option>
              <option value="focus">Mode: Focus</option>
              <option value="deadline">Mode: Deadline</option>
            </select>
          ) : null}

          {planner.hasOverdueSessions ? (
            <button
              className="button button--warning button--small"
              onClick={planner.repairAndReschedule}
              title="Repair overdue sessions"
              type="button"
            >
              ⚠️ Repair
            </button>
          ) : null}

          <button
            className="button button--primary button--small top-bar-auto-plan-btn"
            onClick={() => planner.generateAndApplyPlan()}
            type="button"
          >
            Auto-Plan Week
          </button>

          <button
            aria-label="Manage schedules"
            className="top-bar-icon-pill"
            onClick={() => setShowScheduleModal(true)}
            title="Schedules (🗓)"
            type="button"
          >
            🗓
          </button>

          <button
            aria-label="Recurring task engine"
            className="top-bar-icon-pill"
            onClick={() => setShowRecurringModal(true)}
            title="Recurring Tasks (🔁)"
            type="button"
          >
            🔁
          </button>

          <button
            className="top-bar-today-pill"
            onClick={() => {
              setWeekOffset(0)
              setViewMode("week")
            }}
            type="button"
          >
            Today
          </button>

          <button
            className="button button--secondary button--small ai-mode-badge-btn"
            onClick={() => setShowAiSettings(true)}
            title="AI Configuration"
            type="button"
          >
            {providerLabel}
          </button>

          <BackupControls className="top-bar-backup-actions" compact onExport={exportBackup} onImport={importBackup} />
        </div>
      </header>

      {/* Main Multi-Column Spatial Layout */}
      <main
        className={[
          "spatial-main-shell",
          isDesktop && showLeftDrawer ? "has-left-drawer-open" : "",
          isDesktop && showRightDrawer ? "has-right-drawer-open" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <NavDock
          activeDrawer={leftDrawerMode}
          onFocusQuickCapture={() => quickCaptureInputRef.current?.focus()}
          onToggleInbox={toggleInboxDrawer}
          onToggleProjects={toggleProjectsDrawer}
          onToggleTheme={toggleTheme}
          theme={theme}
        />

        <ProjectPanel
          dependencies={planner.document.dependencies}
          focusToken={projectsFocusToken}
          hidden={!showLeftDrawer}
          mode={leftDrawerMode ?? "projects"}
          onCloseDrawer={() => setLeftDrawerMode(null)}
          onCreateDependency={planner.createDependency}
          onCreateProject={planner.createProject}
          onCreateSubtask={planner.createSubtask}
          onCreateTask={planner.createTask}
          onSelectProject={selectProject}
          onSelectTaskId={handleSelectTask}
          onSetTaskCompletion={planner.setTaskCompletion}
          onTriggerAi={handleTriggerAi}
          onUpdateTask={planner.updateTaskConstraints}
          projects={planner.document.projects}
          selectedProjectId={activeSelectedProjectId}
          selectedTaskId={selectedTaskId}
          taskCountByProject={taskCountByProject}
          tasks={planner.document.tasks}
          taskSessions={planner.document.taskSessions}
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
          onSelectTaskId={handleSelectTask}
          onSetViewMode={setViewMode}
          onSetWeekOffset={setWeekOffset}
          onToggleSessionLock={planner.toggleSessionLock}
          onUpdatePolicy={planner.updatePolicy}
          policy={planner.document.policy}
          referenceDate={referenceDate}
          risks={planner.risks}
          selectedTaskId={selectedTaskId}
          taskSessions={planner.document.taskSessions}
          tasks={planner.document.tasks}
          viewMode={viewMode}
          weekOffset={weekOffset}
        />

        <TaskPanel
          allTasks={planner.document.tasks}
          dependencies={planner.document.dependencies}
          hidden={!showRightDrawer}
          onClose={() => setIsTaskInspectorOpen(false)}
          onCreateDependency={planner.createDependency}
          onCreateSubtask={planner.createSubtask}
          onDeleteDependency={planner.deleteDependency}
          onDeleteTask={planner.deleteTask}
          onMoveTask={planner.moveTask}
          onSetTaskCompletion={planner.setTaskCompletion}
          onTriggerAi={handleTriggerAi}
          onUpdateTask={planner.updateTaskConstraints}
          projects={planner.document.projects}
          schedules={planner.document.schedules ?? []}
          task={selectedTask}
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

      {/* Schedules Modal */}
      {showScheduleModal ? (
        <ScheduleModal
          onClose={() => setShowScheduleModal(false)}
          onCreateSchedule={planner.createSchedule}
          onDeleteSchedule={planner.deleteSchedule}
          onUpdateSchedule={planner.updateSchedule}
          schedules={planner.document.schedules ?? []}
        />
      ) : null}

      {/* Recurring Modal */}
      {showRecurringModal ? (
        <RecurringModal
          onClose={() => setShowRecurringModal(false)}
          onTriggerRecurrence={planner.triggerRecurrenceGeneration}
          tasks={planner.document.tasks}
        />
      ) : null}
    </div>
  )
}

const getWeek = (date: Date): Date[] => {
  const current = new Date(date)
  current.setUTCHours(0, 0, 0, 0)
  const day = current.getUTCDay()
  const diff = current.getUTCDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(current.setUTCDate(diff))

  return Array.from({ length: 7 }, (_, index) => {
    const next = new Date(monday)
    next.setUTCDate(monday.getUTCDate() + index)
    return next
  })
}
