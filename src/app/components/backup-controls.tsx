import { useId } from 'react'

interface BackupControlsProps {
  className?: string
  compact?: boolean
  onExport: () => void
  onImport: (file: File) => void
}

export const BackupControls = ({
  className,
  compact = false,
  onExport,
  onImport,
}: BackupControlsProps) => {
  const inputId = useId()
  const importLabel = compact ? 'Import' : 'Import backup'
  const exportLabel = compact ? 'Export' : 'Export backup'

  return (
    <div className={`backup-actions ${className ?? ''}`}>
      <label className="button button--secondary" htmlFor={inputId}>
        {importLabel}
      </label>
      <input
        accept="application/json,.json"
        className="visually-hidden"
        id={inputId}
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) {
            onImport(file)
          }
          event.target.value = ''
        }}
        type="file"
      />
      <button className="button button--primary" onClick={onExport} type="button">
        {exportLabel}
      </button>
    </div>
  )
}
