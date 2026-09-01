# Architecture decision records

ADRs preserve consequential reasoning; Git preserves implementation history; `PROJECT_CONTEXT.md` preserves the compact current view.

Status: `Proposed | Accepted | Superseded | Rejected`. Never rewrite an accepted decision's history: add a new ADR and mark the old one superseded.

| ADR | Decision | Status |
|---|---|---|
| [0001](0001-deterministic-scheduler.md) | Deterministic scheduler; bounded inference proposals | Accepted in part |
| [0002](0002-local-first-storage.md) | Local-first storage | Accepted |
| [0003](0003-modular-monolith.md) | Modular monolith | Accepted |
| [0004](0004-single-llm-provider.md) | One evaluated LLM provider first | Superseded |
| [0005](0005-standard-calendar-component.md) | Standard calendar component | Accepted |
| [0006](0006-defer-cloud-integrations.md) | Defer cloud and integrations | Accepted |
| [0007](0007-model-agnostic-intelligence.md) | Model-agnostic intelligence | Accepted |

Template: `# NNNN: title`; metadata (`Status`, `Date`); `Context`; `Decision`; `Consequences`; `Rejected alternatives`.
