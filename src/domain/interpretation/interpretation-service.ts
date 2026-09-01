import { GeminiApiProposalProvider } from './gemini-provider'
import { HeuristicProposalProvider } from './heuristic-provider'
import { SimulatedAiProposalProvider } from './simulated-ai-provider'
import type { ProposalPort } from './proposal-port'

export type ProviderMode = 'simulated-ai' | 'heuristic' | 'gemini-api'

export class InterpretationService {
  private readonly heuristic = new HeuristicProposalProvider()
  private readonly simulated = new SimulatedAiProposalProvider()
  private readonly gemini = new GeminiApiProposalProvider()

  public getProvider(mode: ProviderMode): ProposalPort {
    switch (mode) {
      case 'simulated-ai':
        return this.simulated
      case 'heuristic':
        return this.heuristic
      case 'gemini-api':
        return this.gemini
    }
  }
}

export const defaultInterpretationService = new InterpretationService()
