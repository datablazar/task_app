import { HeuristicProposalProvider } from './heuristic-provider'
import type {
  InterpretationContext,
  ProposalPort,
  TaskInterpretationResult,
} from './proposal-port'

export class SimulatedAiProposalProvider implements ProposalPort {
  public readonly provenance = 'simulated-ai' as const
  private readonly fallback = new HeuristicProposalProvider()

  public async interpretTask(
    taskTitle: string,
    context: InterpretationContext,
  ): Promise<TaskInterpretationResult> {
    // Simulate lightweight LLM inference latency (50ms) for realistic UX responsiveness
    await new Promise((resolve) => setTimeout(resolve, 50))

    const heuristic = await this.fallback.interpretTask(taskTitle, context)
    const lower = taskTitle.toLowerCase()

    // Enhanced AI rationale and nuanced decompositions
    let enhancedDecomposition = heuristic.decomposition
    if (lower.includes('podcast')) {
      enhancedDecomposition = {
        subtasks: [
          'Episode outline & guest question prep',
          'Record audio track & room tone check',
          'Post-production edit & audio mastering',
          'Publish show notes & distribution links',
        ],
        confidence: 0.94,
        rationale: 'AI generated end-to-end podcast production lifecycle.',
      }
    } else if (lower.includes('course') || lower.includes('curriculum')) {
      enhancedDecomposition = {
        subtasks: [
          'Learning objectives & module syllabus',
          'Lecture slides & interactive exercises',
          'Assessment rubric & problem set solution key',
        ],
        confidence: 0.92,
        rationale: 'AI structured university-level course design workflow.',
      }
    } else if (lower.includes('migration') || lower.includes('database')) {
      enhancedDecomposition = {
        subtasks: [
          'Schema diff & backward compatibility audit',
          'Write automated forward/rollback migration scripts',
          'Staging benchmark & data integrity validation',
        ],
        confidence: 0.95,
        rationale: 'AI generated zero-downtime database migration checklist.',
      }
    }

    return {
      provenance: this.provenance,
      duration: heuristic.duration
        ? {
            ...heuristic.duration,
            confidence: Math.min(0.96, heuristic.duration.confidence + 0.1),
            rationale: `AI inference: ${heuristic.duration.rationale}`,
          }
        : undefined,
      deadline: heuristic.deadline
        ? {
            ...heuristic.deadline,
            confidence: Math.min(0.98, heuristic.deadline.confidence + 0.05),
            rationale: `AI extracted temporal constraint: ${heuristic.deadline.rationale}`,
          }
        : undefined,
      decomposition: enhancedDecomposition,
      dependency: heuristic.dependency
        ? {
            ...heuristic.dependency,
            confidence: Math.min(0.95, heuristic.dependency.confidence + 0.08),
            rationale: `AI dependency graph reasoning: ${heuristic.dependency.rationale}`,
          }
        : undefined,
    }
  }
}
