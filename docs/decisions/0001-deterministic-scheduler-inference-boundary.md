# 0001: Deterministic scheduler and bounded inference

Status: Accepted
Date: 2026-08-31

## Context

Scheduling must honour time, dependencies and user constraints, remain testable/offline, and explain or undo every change. Optional inference can help interpret semantically incomplete information, but must not control calendar allocation.

## Decision

A pure, versioned deterministic engine alone allocates and replans time. Optional inference may return narrow schema-validated proposals for missing semantic values; normal domain commands validate and apply them. Inference cannot write storage, schedule directly, weaken hard constraints or take external actions.

## Consequences

Schedules are reproducible, auditable and independent of the chosen inference implementation. This requires provenance, confidence, validation and explicit orchestration.

## Rejected alternatives

- Inference constructs the calendar: insufficient determinism and auditability.
- No optional inference: loses help for incomplete human input.
