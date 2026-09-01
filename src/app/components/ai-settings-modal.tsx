import { useState } from 'react'
import type { FormEvent } from 'react'
import type { ProviderMode } from '../../domain/interpretation'

interface AiSettingsModalProps {
  currentMode: ProviderMode
  currentApiKey: string
  onSave: (mode: ProviderMode, apiKey: string) => void
  onClose: () => void
}

export const AiSettingsModal = ({
  currentMode,
  currentApiKey,
  onSave,
  onClose,
}: AiSettingsModalProps) => {
  const [mode, setMode] = useState<ProviderMode>(currentMode)
  const [apiKey, setApiKey] = useState<string>(currentApiKey)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    onSave(mode, apiKey.trim())
    onClose()
  }

  return (
    <div aria-modal="true" className="calendar-dialog-overlay" role="dialog">
      <div className="ai-settings-modal">
        <header className="ai-settings-modal__header">
          <h2>AI Intelligence & Proposal Settings</h2>
          <button
            aria-label="Close AI settings"
            className="ai-settings-modal__close"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </header>

        <form onSubmit={handleSubmit}>
          <div className="ai-settings-modal__body">
            <p className="ai-settings-modal__intro">
              Choose how the planner interprets task titles to propose durations, extract deadlines, decompose subtasks, and infer dependencies.
            </p>

            <div className="ai-settings-options">
              <label
                className={`ai-settings-card ${mode === 'simulated-ai' ? 'is-selected' : ''}`}
              >
                <input
                  checked={mode === 'simulated-ai'}
                  name="ai-provider"
                  onChange={() => setMode('simulated-ai')}
                  type="radio"
                  value="simulated-ai"
                />
                <div className="ai-settings-card__content">
                  <div className="ai-settings-card__title">
                    <span>🧪 Simulated AI (Preview Mode)</span>
                    <span className="badge badge--recommended">Recommended</span>
                  </div>
                  <p>
                    Experience rich GenAI proposals, realistic confidence scores, and structured rationales 100% offline without requiring any API key or network connection.
                  </p>
                </div>
              </label>

              <label className={`ai-settings-card ${mode === 'heuristic' ? 'is-selected' : ''}`}>
                <input
                  checked={mode === 'heuristic'}
                  name="ai-provider"
                  onChange={() => setMode('heuristic')}
                  type="radio"
                  value="heuristic"
                />
                <div className="ai-settings-card__content">
                  <div className="ai-settings-card__title">
                    <span>⚡ Local Rules (Deterministic)</span>
                  </div>
                  <p>
                    Instant rule-based pattern matching using local regex date parsing and keyword duration tables. Zero latency.
                  </p>
                </div>
              </label>

              <label className={`ai-settings-card ${mode === 'gemini-api' ? 'is-selected' : ''}`}>
                <input
                  checked={mode === 'gemini-api'}
                  name="ai-provider"
                  onChange={() => setMode('gemini-api')}
                  type="radio"
                  value="gemini-api"
                />
                <div className="ai-settings-card__content">
                  <div className="ai-settings-card__title">
                    <span>🤖 Live Google Gemini API</span>
                  </div>
                  <p>
                    Connects directly to Google Gemini 2.5 Flash via your personal API key stored securely only on this device.
                  </p>
                </div>
              </label>
            </div>

            {mode === 'gemini-api' ? (
              <div className="ai-settings-api-key">
                <label htmlFor="gemini-api-key-input">Google AI Studio API Key</label>
                <input
                  id="gemini-api-key-input"
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  type="password"
                  value={apiKey}
                />
                <span className="ai-settings-api-key__hint">
                  Your key is stored locally in your browser and sent directly to Google AI Studio endpoints.
                </span>
              </div>
            ) : null}
          </div>

          <footer className="ai-settings-modal__footer">
            <button className="button button--secondary button--small" onClick={onClose} type="button">
              Cancel
            </button>
            <button className="button button--primary button--small" type="submit">
              Save Settings
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}
