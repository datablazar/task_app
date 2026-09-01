import { describe, expect, it } from 'vitest'
import { HeuristicProposalProvider } from './heuristic-provider'
import { SimulatedAiProposalProvider } from './simulated-ai-provider'
import { GeminiApiProposalProvider } from './gemini-provider'
import { executeCommand } from '../commands'
import { createEmptyPlannerDocument } from '../model'
import type { Task } from '../model'

describe('Interpretation & Proposal Providers (Milestone I4)', () => {
  const refDate = new Date('2026-08-31T09:00:00.000Z') // Monday 9:00 UTC

  describe('HeuristicProposalProvider', () => {
    const provider = new HeuristicProposalProvider()

    it('Capability 1: Extracts natural language deadlines relative to reference date', async () => {
      const resFriday = await provider.interpretTask('Submit final thesis draft by Friday at 5pm', {
        existingTasks: [],
        referenceDate: refDate,
      })
      expect(resFriday.deadline).toBeDefined()
      expect(resFriday.deadline?.dueAt).toBe('2026-09-04T17:00:00.000Z')
      expect(resFriday.deadline?.cleanedTitle).toBe('Submit final thesis draft')
      expect(resFriday.deadline?.confidence).toBeGreaterThanOrEqual(0.9)

      const resTomorrow = await provider.interpretTask('Prepare team agenda due tomorrow', {
        existingTasks: [],
        referenceDate: refDate,
      })
      expect(resTomorrow.deadline).toBeDefined()
      expect(resTomorrow.deadline?.dueAt).toBe('2026-09-01T17:00:00.000Z')
      expect(resTomorrow.deadline?.cleanedTitle).toBe('Prepare team agenda')
    })

    it('Capability 2: Estimates task durations from explicit tokens and semantic keywords', async () => {
      const resExplicit = await provider.interpretTask('Review code changes 45m', {
        existingTasks: [],
        referenceDate: refDate,
      })
      expect(resExplicit.duration?.estimateMinutes).toBe(45)
      expect(resExplicit.duration?.confidence).toBe(0.98)

      const resStandup = await provider.interpretTask('Engineering team standup', {
        existingTasks: [],
        referenceDate: refDate,
      })
      expect(resStandup.duration?.estimateMinutes).toBe(15)

      const resResearch = await provider.interpretTask('Research transformer attention architecture', {
        existingTasks: [],
        referenceDate: refDate,
      })
      expect(resResearch.duration?.estimateMinutes).toBe(90)
    })

    it('Capability 3: Proposes actionable subtask decompositions for multi-step goals', async () => {
      const resLaunch = await provider.interpretTask('Launch new mobile app release', {
        existingTasks: [],
        referenceDate: refDate,
      })
      expect(resLaunch.decomposition?.subtasks).toHaveLength(3)
      expect(resLaunch.decomposition?.subtasks[0]).toContain('Pre-launch')

      const resWorkshop = await provider.interpretTask('Host interactive Python workshop', {
        existingTasks: [],
        referenceDate: refDate,
      })
      expect(resWorkshop.decomposition?.subtasks).toHaveLength(3)
      expect(resWorkshop.decomposition?.subtasks[1]).toContain('slide')
    })

    it('Capability 4: Infers prerequisite dependency relationships between project tasks', async () => {
      const existingTasks: Task[] = [
        {
          id: 't-design',
          projectId: 'p1',
          title: 'Design API Spec',
          completed: false,
          createdAt: refDate.toISOString(),
          updatedAt: refDate.toISOString(),
        },
      ]

      const resInfer = await provider.interpretTask('Implement API endpoints', {
        existingTasks,
        referenceDate: refDate,
      })

      expect(resInfer.dependency).toBeDefined()
      expect(resInfer.dependency?.prerequisiteTaskId).toBe('t-design')
      expect(resInfer.dependency?.prerequisiteTaskTitle).toBe('Design API Spec')
      expect(resInfer.dependency?.confidence).toBeGreaterThanOrEqual(0.8)
    })
  })

  describe('SimulatedAiProposalProvider (Preview Mode)', () => {
    const provider = new SimulatedAiProposalProvider()

    it('returns rich AI rationales and domain decompositions with simulated-ai provenance', async () => {
      const res = await provider.interpretTask('Launch weekly engineering podcast', {
        existingTasks: [],
        referenceDate: refDate,
      })

      expect(res.provenance).toBe('simulated-ai')
      expect(res.decomposition?.subtasks).toHaveLength(4)
      expect(res.decomposition?.rationale).toContain('AI generated')
      expect(res.decomposition?.confidence).toBeGreaterThanOrEqual(0.9)
    })
  })

  describe('GeminiApiProposalProvider (Safe Fallback & Live Integration)', () => {
    const provider = new GeminiApiProposalProvider()

    it('safely and seamlessly falls back to heuristic provider when no API key is provided', async () => {
      const res = await provider.interpretTask('Engineering sync 15m', {
        existingTasks: [],
        referenceDate: refDate,
        apiKey: '', // Empty key
      })

      expect(res.provenance).toBe('heuristic')
      expect(res.duration?.estimateMinutes).toBe(15)
    })
  })

  describe('Proposal Decision Auditing and Command Execution', () => {
    it('records accepted and rejected proposal decisions with provenance in revisions', () => {
      const baseDoc = createEmptyPlannerDocument('Europe/London')
      const p1 = executeCommand(baseDoc, {
        type: 'create-project',
        id: 'p1',
        revisionId: 'rev-1',
        occurredAt: refDate.toISOString(),
        title: 'Podcast Launch',
      })
      const t1 = executeCommand(p1.ok ? p1.value.document : baseDoc, {
        type: 'create-task',
        id: 't1',
        revisionId: 'rev-2',
        occurredAt: refDate.toISOString(),
        projectId: 'p1',
        title: 'Record Episode 1',
      })
      if (!t1.ok) throw new Error()

      // Record accepted duration proposal
      const decisionResult = executeCommand(t1.value.document, {
        type: 'record-proposal-decision',
        id: 'prop-1',
        revisionId: 'rev-3',
        occurredAt: refDate.toISOString(),
        decision: {
          id: 'prop-1',
          taskId: 't1',
          capability: 'duration-estimate',
          provenance: 'simulated-ai',
          confidence: 0.94,
          summary: 'Set duration to 45 minutes.',
          accepted: true,
          occurredAt: refDate.toISOString(),
        },
      })

      expect(decisionResult.ok).toBe(true)
      if (!decisionResult.ok) throw new Error()
      expect(decisionResult.value.document.proposals).toHaveLength(1)
      expect(decisionResult.value.document.proposals[0].provenance).toBe('simulated-ai')
      expect(decisionResult.value.revision.kind).toBe('proposal-accepted')
    })
  })
})
