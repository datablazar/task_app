# 0004: One evaluated LLM provider first

Status: Superseded by [0007](0007-model-agnostic-intelligence.md)
Date: 2026-08-31

## Context

OpenAI, Anthropic and Google APIs are available, but integrating and testing all providers increases cost. Most early functionality is deterministic and needs no model.

## Decision

Define a provider-neutral intelligence port, benchmark economical models on labelled synthetic cases in I4, and implement only the winner first. Add another adapter only for measured quality, privacy or reliability benefit. Cache decisions, cap spend/tokens and escalate selectively.

## Consequences

Provider lock-in is limited without paying the integration cost upfront. Evaluation and failure-safe behaviour are required before enabling real personal data.

## Rejected alternatives

- Three adapters immediately: premature work and maintenance.
- Routine multi-model voting: excess cost/latency for little expected value.
