import { HeuristicProposalProvider } from './heuristic-provider'
import type {
  InterpretationContext,
  ProposalPort,
  TaskInterpretationResult,
} from './proposal-port'

export class GeminiApiProposalProvider implements ProposalPort {
  public readonly provenance = 'gemini-api' as const
  private readonly fallback = new HeuristicProposalProvider()

  public async interpretTask(
    taskTitle: string,
    context: InterpretationContext,
  ): Promise<TaskInterpretationResult> {
    if (!context.apiKey || context.apiKey.trim().length === 0) {
      return this.fallback.interpretTask(taskTitle, context)
    }

    try {
      const prompt = `You are a cognitive task planning assistant. Analyze the task title below and return a JSON object with:
1. "estimateMinutes": integer estimated duration (15 to 240 min)
2. "durationRationale": brief rationale for duration
3. "dueAt": ISO UTC timestamp if a deadline is mentioned in title relative to reference date ${context.referenceDate.toISOString()}, or null
4. "cleanedTitle": task title with any date/time phrases removed
5. "subtasks": array of 2 to 4 actionable subtasks, or null
6. "prerequisiteTitle": title of a prerequisite task from this existing list [${context.existingTasks.map((t) => `"${t.title}"`).join(', ')}] if one must complete before this task, or null.

Task Title: "${taskTitle}"`

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 6000)

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(context.apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
            },
          }),
          signal: controller.signal,
        },
      )
      clearTimeout(timeoutId)

      if (!response.ok) {
        return this.fallback.interpretTask(taskTitle, context)
      }

      const json = (await response.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[]
      }
      const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text
      if (!rawText) {
        return this.fallback.interpretTask(taskTitle, context)
      }

      const parsed = JSON.parse(rawText) as {
        estimateMinutes?: number
        durationRationale?: string
        dueAt?: string | null
        cleanedTitle?: string
        subtasks?: string[] | null
        prerequisiteTitle?: string | null
      }

      const matchingPrereq = parsed.prerequisiteTitle
        ? context.existingTasks.find(
            (t) => t.title.toLowerCase() === parsed.prerequisiteTitle?.toLowerCase(),
          )
        : undefined

      return {
        provenance: this.provenance,
        duration: parsed.estimateMinutes
          ? {
              estimateMinutes: parsed.estimateMinutes,
              confidence: 0.95,
              rationale: parsed.durationRationale ?? 'Gemini AI estimated duration.',
            }
          : undefined,
        deadline:
          parsed.dueAt && !Number.isNaN(Date.parse(parsed.dueAt))
            ? {
                dueAt: parsed.dueAt,
                cleanedTitle: parsed.cleanedTitle ?? taskTitle,
                confidence: 0.96,
                rationale: 'Gemini AI extracted deadline.',
              }
            : undefined,
        decomposition:
          Array.isArray(parsed.subtasks) && parsed.subtasks.length > 0
            ? {
                subtasks: parsed.subtasks,
                confidence: 0.95,
                rationale: 'Gemini AI generated subtask breakdown.',
              }
            : undefined,
        dependency: matchingPrereq
          ? {
              prerequisiteTaskId: matchingPrereq.id,
              prerequisiteTaskTitle: matchingPrereq.title,
              confidence: 0.92,
              rationale: `Gemini AI inferred dependency on “${matchingPrereq.title}”.`,
            }
          : undefined,
      }
    } catch {
      // Fallback seamlessly to local heuristic on any error / timeout
      return this.fallback.interpretTask(taskTitle, context)
    }
  }
}
