# 0001: Deterministic scheduler; bounded LLM proposals

Status: Accepted
Date: 2026-08-31

Inference-specific wording is superseded by [0007](0007-model-agnostic-intelligence.md); the deterministic scheduler decision remains accepted.

## Context

Scheduling must honour time, dependencies and user constraints, remain testable/offline, and explain or undo every change. LLM-generated calendars are variable and provider-dependent, but LLMs add value when task information is semantically incomplete.

## Decision

A pure, versioned deterministic engine alone allocates and replans time. LLMs may return narrow schema-validated proposals for missing semantic values; normal domain commands validate and apply them. Models cannot write storage, schedule directly, weaken hard constraints or take external actions.

## Consequences

Schedules are reproducible, auditable and provider-independent; ambiguity still benefits from AI. This requires provenance, confidence, validation and explicit orchestration.

## Rejected alternatives

- LLM constructs calendar: insufficient determinism/auditability.
- No LLM: loses value on incomplete human input.
