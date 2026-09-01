# 0004: Capability-selected inference

Status: Accepted
Date: 2026-09-01

## Context

Some capabilities benefit from optional interpretation, but the project must remain independent of any specific implementation or hosting arrangement. Most early functionality is deterministic and requires no inference.

## Decision

Define stable inference contracts, evaluate candidate implementations against labelled cases, and select the qualified implementation separately for each capability. An implementation may be deterministic heuristics, an external inference service, or user clarification. Cache decisions, cap applicable usage and escalate selectively.

## Consequences

The product remains portable and avoids premature integration work. Evaluation and failure-safe behaviour are required before using personal data.

## Rejected alternatives

- One prescribed implementation for all capabilities: creates avoidable lock-in and stale assumptions.
- Treating every capability as requiring inference: wastes cost and obscures deterministic options.
