import { serialiseBackup } from '../domain/backup'
import { executeCommand } from '../domain/commands'
import type { BackupFailure } from '../domain/backup'
import type { CommandFailure, CommandSuccess, PlannerCommand } from '../domain/commands'
import type { PlannerDocument } from '../domain/model'
import type { Result } from '../domain/result'
import type {
  LocalPlannerRepository,
  RepositoryFailure,
} from '../infrastructure/local-planner-repository'

export type WorkspaceFailure = BackupFailure | CommandFailure | RepositoryFailure

/** Coordinates the command boundary with durable local storage. */
export class PlannerWorkspace {
  public constructor(private readonly repository: LocalPlannerRepository) {}

  public load(): Result<PlannerDocument | null, RepositoryFailure> {
    return this.repository.load()
  }

  public execute(
    document: PlannerDocument,
    command: PlannerCommand,
  ): Result<CommandSuccess, WorkspaceFailure> {
    const applied = executeCommand(document, command)
    if (!applied.ok) {
      return applied
    }

    const persisted = this.repository.save(applied.value.document)
    if (!persisted.ok) {
      return persisted
    }

    return applied
  }

  public restore(raw: string): Result<PlannerDocument, BackupFailure | RepositoryFailure> {
    return this.repository.restore(raw)
  }

  public export(document: PlannerDocument): Result<string, BackupFailure> {
    return serialiseBackup(document)
  }
}
