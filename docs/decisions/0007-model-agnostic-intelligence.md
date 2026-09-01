# 0007: Model-agnostic intelligence

Status: Accepted
Date: 2026-09-01
Supersedes: [0004](0004-single-llm-provider.md); AI-specific wording in [0001](0001-deterministic-scheduler.md)

## Context

The product needs optional help with semantically incomplete information, but the development plan must not prescribe a model, vendor, hosting mode or coding assistant. Those choices can change with capability, cost, privacy, reliability and availability.

## Decision

Define intelligence as capability-selected inference behind stable contracts. For each capability, evaluate qualified implementations against the same acceptance criteria. An implementation may be deterministic heuristics, a local or remote model, or user clarification. The selected implementation may change without changing domain or scheduler contracts.

## Consequences

The product remains portable across model types and vendors. Selection is evidence-led: quality, calibration, latency, cost, privacy, reliability and failure behaviour. Model-specific configuration belongs in deploy-time infrastructure, never the core development plan.

## Rejected alternatives

- Prescribing a vendor or model family: creates avoidable lock-in and stale assumptions.
- Treating all capabilities as requiring a model: wastes cost and obscures deterministic options.
