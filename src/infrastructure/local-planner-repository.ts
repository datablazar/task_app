import { parseBackup, serialiseBackup } from '../domain/backup'
import { failure, success } from '../domain/result'
import type { BackupFailure } from '../domain/backup'
import type { PlannerDocument } from '../domain/model'
import type { Result } from '../domain/result'

export const plannerStorageKey = 'pa-planner:document:v1'

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export interface RepositoryFailure {
  code: 'storage-read-failed' | 'storage-write-failed' | 'stored-data-invalid'
  message: string
}

export class LocalPlannerRepository {
  public constructor(
    private readonly storage: StorageLike,
    private readonly storageKey = plannerStorageKey,
  ) {}

  public load(): Result<PlannerDocument | null, RepositoryFailure> {
    let raw: string | null
    try {
      raw = this.storage.getItem(this.storageKey)
    } catch {
      return failure({
        code: 'storage-read-failed',
        message: 'PA Planner could not read local storage in this browser.',
      })
    }

    if (raw === null) {
      return success(null)
    }

    const parsed = parseBackup(raw)
    if (!parsed.ok) {
      return failure({
        code: 'stored-data-invalid',
        message: `Saved planner data could not be read safely: ${parsed.error.message}`,
      })
    }
    return success(parsed.value)
  }

  public save(document: PlannerDocument): Result<void, BackupFailure | RepositoryFailure> {
    const backup = serialiseBackup(document)
    if (!backup.ok) {
      return backup
    }
    try {
      this.storage.setItem(this.storageKey, backup.value)
    } catch {
      return failure({
        code: 'storage-write-failed',
        message: 'PA Planner could not save to local storage in this browser.',
      })
    }
    return success(undefined)
  }

  public restore(raw: string): Result<PlannerDocument, BackupFailure | RepositoryFailure> {
    const parsed = parseBackup(raw)
    if (!parsed.ok) {
      return parsed
    }
    const saved = this.save(parsed.value)
    if (!saved.ok) {
      return saved
    }
    return success(parsed.value)
  }
}
