import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PlannerApp } from './app/planner-app'
import './styles.css'

const root = document.getElementById('root')

if (!root) {
  throw new Error('Application root element not found.')
}

createRoot(root).render(
  <StrictMode>
    <PlannerApp />
  </StrictMode>,
)
