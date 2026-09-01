interface NavDockProps {
  isProjectsOpen: boolean
  onToggleProjects: () => void
  isTasksOpen?: boolean
  onToggleTasks?: () => void
  onFocusSearch?: () => void
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  onOpenSettings?: () => void
}

export const NavDock = ({
  isProjectsOpen,
  onToggleProjects,
  isTasksOpen,
  onToggleTasks,
  onFocusSearch,
  theme,
  onToggleTheme,
  onOpenSettings,
}: NavDockProps) => {
  return (
    <nav className="nav-dock" aria-label="Main Navigation Dock">
      <div className="nav-dock__top">
        {/* Projects / Folder Icon */}
        <button
          aria-expanded={isProjectsOpen}
          aria-label="Toggle Projects Drawer"
          className={`nav-dock__btn ${isProjectsOpen ? 'is-active' : ''}`}
          onClick={onToggleProjects}
          title="Projects"
          type="button"
        >
          <div className="nav-dock__folder-box">
            <svg
              className="nav-dock__icon"
              fill="currentColor"
              height="18"
              viewBox="0 0 24 24"
              width="18"
            >
              <path d="M19.5 21a3 3 0 0 0 3-3v-4.5a3 3 0 0 0-3-3h-1.5V9a3 3 0 0 0-3-3h-3.379a3 3 0 0 1-2.121-.879L8.379 4.043A3 3 0 0 0 6.257 3.164H4.5A3 3 0 0 0 1.5 6.164V18a3 3 0 0 0 3 3h15Z" />
            </svg>
            {isProjectsOpen ? <span aria-hidden="true" className="nav-dock__badge-dot" /> : null}
          </div>
        </button>

        {/* Inbox / Messages Icon */}
        <button
          aria-expanded={isTasksOpen}
          aria-label="Toggle Tasks Drawer"
          className={`nav-dock__btn ${isTasksOpen ? 'is-active-subtle' : ''}`}
          onClick={onToggleTasks}
          title="Inbox & Tasks"
          type="button"
        >
          <svg
            className="nav-dock__icon"
            fill="none"
            height="18"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.75"
            viewBox="0 0 24 24"
            width="18"
          >
            <rect height="16" rx="3" width="20" x="2" y="4" />
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
          </svg>
        </button>

        {/* Search Icon */}
        <button
          aria-label="Search and quick capture"
          className="nav-dock__btn"
          onClick={onFocusSearch}
          title="Search / Quick Capture (⌘K)"
          type="button"
        >
          <svg
            className="nav-dock__icon"
            fill="none"
            height="18"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.75"
            viewBox="0 0 24 24"
            width="18"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.35-4.35" />
          </svg>
        </button>
      </div>

      <div className="nav-dock__bottom">
        {/* Sun / Theme / Settings Icon */}
        <button
          aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
          className="nav-dock__btn nav-dock__btn--bottom"
          onClick={onToggleTheme}
          onContextMenu={(e) => {
            e.preventDefault()
            onOpenSettings?.()
          }}
          title={theme === 'light' ? 'Switch to Dark Mode (or right-click for AI settings)' : 'Switch to Light Mode'}
          type="button"
        >
          <svg
            className="nav-dock__icon"
            fill="none"
            height="19"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.75"
            viewBox="0 0 24 24"
            width="19"
          >
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
          </svg>
        </button>
      </div>
    </nav>
  )
}
