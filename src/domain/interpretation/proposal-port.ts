import type { ProposalProvenance, Task } from '../model'

export interface DurationEstimateProposal {
  estimateMinutes: number
  confidence: number // 0.0 - 1.0
  rationale: string
}

export interface DeadlineExtractProposal {
  dueAt?: string // ISO timestamp
  cleanedTitle: string
  confidence: number
  rationale: string
}

export interface SubtaskDecompositionProposal {
  subtasks: string[]
  confidence: number
  rationale: string
}

export interface DependencyInferenceProposal {
  prerequisiteTaskId?: string
  prerequisiteTaskTitle?: string
  confidence: number
  rationale: string
}

export interface TaskInterpretationResult {
  provenance: ProposalProvenance
  duration?: DurationEstimateProposal
  deadline?: DeadlineExtractProposal
  decomposition?: SubtaskDecompositionProposal
  dependency?: DependencyInferenceProposal
}

export interface InterpretationContext {
  existingTasks: Task[]
  referenceDate: Date
  apiKey?: string
}

export interface ProposalPort {
  readonly provenance: ProposalProvenance
  interpretTask(taskTitle: string, context: InterpretationContext): Promise<TaskInterpretationResult>
}
