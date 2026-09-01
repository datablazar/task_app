import type { FC } from "react"

interface NavDockProps {
  activeDrawer: "projects" | "inbox" | null
  onToggleProjects: () => void
  onToggleInbox: () => void
  onFocusQuickCapture: () => void
  theme: "light" | "dark"
  onToggleTheme: () => void
}

export const NavDock: FC<NavDockProps> = ({
  activeDrawer,
  onToggleProjects,
  onToggleInbox,
  onFocusQuickCapture,
  theme,
  onToggleTheme,
}) => {
  return (
    <aside aria-label="Main Dock" className="nav-dock">
      <div className="nav-dock__inner">
        <button
          aria-label="Toggle Projects panel"
          aria-pressed={activeDrawer === "projects"}
          className={`nav-dock__btn ${activeDrawer === "projects" ? "is-active" : ""}`}
          onClick={onToggleProjects}
          title="Projects"
          type="button"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          </svg>
          <span className="nav-dock__dot" />
        </button>

        <button
          aria-label="Toggle Inbox & Tasks drawer"
          aria-pressed={activeDrawer === "inbox"}
          className={`nav-dock__btn ${activeDrawer === "inbox" ? "is-active" : ""}`}
          onClick={onToggleInbox}
          title="Inbox & Tasks"
          type="button"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
            <path
              d="M22 6l-10 7L2 6"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          </svg>
        </button>

        <button
          aria-label="Search and Quick Capture (⌘K)"
          className="nav-dock__btn"
          onClick={onFocusQuickCapture}
          title="Quick Capture (⌘K)"
          type="button"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="M20 20l-4-4" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
          </svg>
        </button>

        <div className="nav-dock__spacer" />

        <button
          aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
          className="nav-dock__btn nav-dock__theme-btn"
          onClick={onToggleTheme}
          title={theme === "light" ? "Dark Mode" : "Light Mode"}
          type="button"
        >
          <span aria-hidden="true" style={{ fontSize: "17px", lineHeight: 1 }}>
            {theme === "light" ? "🌙" : "☀️"}
          </span>
        </button>
      </div>
    </aside>
  )
}
