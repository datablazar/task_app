# PA Planner — project packet

**Use:** read or upload this file first when working on the project. It is the compact current contract, delivery map and active decision rationale. Code, tests and migrations own executable behaviour; Git owns history.

## Snapshot

| Item | Current truth |
|---|---|
| State | Milestone I2 complete; preparing Milestone I3 (Planning quality). |
| Active milestone | **I3 — Planning quality** |
| Next bounded outcome | Stability, load balance, missed work, and policy presets. |
| Evidence required | Golden cases improving without correctness loss; interactive representative workload. |
| Blocker | None. |
| Last verified | 2026-09-01 |

## Outcome

Build a high-quality, low-cost, single-person, local-first web planner. Projects, tasks and subtasks feed an internal calendar that creates and repairs a practical schedule around real constraints. The product must remain useful offline and without optional interpretation; later unstructured capture, files and remote capability must strengthen—not replace—the reliable core.

## Non-negotiables

1. The calendar is the command centre; projects and tasks supply work.
2. Only deterministic code allocates or replans time. Optional interpretation may propose uncertain task facts, never schedule, write data, relax a hard rule or act externally.
3. Authority is `user > imported calendar > confirmed preference > interpreted proposal > default`.
4. Hard constraints are inviolate; infeasible work is surfaced as a risk, never hidden.
5. Every material automatic change is attributable, explainable, revisioned and exactly undoable. Equal input plus policy produces the same plan.
6. Local/offline operation and failure-safe optional features are mandatory. No paid infrastructure or personal-data remote service until its benefit, terms and safeguards are approved.
7. Prefer a small modular application and useful vertical slices. Extract packages, services or abstractions only for a demonstrated boundary.

## Product boundary

**Core (I0–I5):** projects/tasks/subtasks with completion/reopening; dependencies; working, protected and preferred time; fixed events; session and break limits; manual day/week planning; deterministic planning/replanning; risks and reasons; revisions/Undo; versioned local data and backup/restore; installable responsive product; bounded optional interpretation for incomplete priority, duration and task characteristics.

**Later, behind gates:** reviewable unstructured inbox; source-linked file workspace; one justified remote capability at a time; recurrence, reminders, preferences, energy/location/resources and user-approved actions.

**Do not build early:** accounts, synchronisation, broad conversation UI, direct calendar/file mutation, routine external calls, vector search, microservices, desktop wrapper, orchestration infrastructure or premium calendar features.

## Architecture and core contract

```text
UI -> commands/queries -> domain -> pure planner
                         -> repository port -> local data
                         -> proposal port   -> optional interpretation
```

- Keep domain and planner independent of UI, persistence and optional services. Validate every external input at the boundary.
- Use stable IDs; UTC instants plus IANA time zone; versioned persisted data; provenance for uncertain facts.
- Core records: `Project`, `Task`, `Dependency`, `FixedEvent`, `TaskSession`, `Availability`, `Policy`, `Revision` and `ProposalDecision`.
- All mutations use typed commands: validate atomically, record the reason/revision, declare whether replanning is needed and return a typed result or failure. Imports, manual changes and future proposals use the same path.
- Exact framework, calendar component and package choices belong in code and the package manifest once an I0/I1 need proves them; they are not durable project knowledge yet.

### Planning engine

Input: current time/zone, tasks/dependencies, fixed and existing sessions, availability and policy. Output: sessions, unscheduled work, risks, a change set, reasons and diagnostics.

Hard rules: fixed and locked time, working/protected time, earliest start, dependencies, task windows, session min/max, breaks, remaining work and time zones; completed work is never scheduled. Validate the dependency graph and reject cycles before allocation. A feasible deadline is protected; an impossible one becomes an explicit risk.

Soft ranking: deadline safety, user priority, dependency criticality, preferred-time fit, continuity and balanced load; avoid fragmentation, needless switches and disruption. Start with a transparent deterministic greedy reference, validate its invariants independently, then improve only when representative golden cases show a benefit.

## Interaction standard

The product should feel calm, quick and trustworthy: dominant day/week calendar, fast capture, progressive constraints, clear fixed/locked/flexible/completed/missed states and contextual reasons for a change. Manual moves show their consequences and can be locked. Keyboard, focus, screen-reader support, contrast, non-colour cues, reduced motion and narrow-screen daily use are core quality—not polish deferred to the end.

## Delivery map

| Phase | Smallest outcome | Exit evidence |
|---|---|---|
| **I0 — Foundation** | Typed application base; local repository; versioned export/import; project/task vertical slice. | Exact data round trip; safe invalid import; build and relevant tests. (Completed) |
| **I1 — Manual planner** | Hierarchy, constraints, fixed events and manual calendar sessions. | A persistent offline week; accessible core journeys. (Completed) |
| **I2 — Reference planner** | Availability, cycle-safe dependencies, allocation, risks, revisions and Undo. | Invariants, determinism, rejected invalid graphs, factual replan and exact Undo. (Completed) |
| **I3 Now — Planning quality** | Stability, load balance, missed work and policy presets. | Golden cases improve without correctness loss; interactive representative workload. |
| **I4 — Optional interpretation** | Four bounded capabilities, confirmation, provenance, limits and evaluation. | Feature can fail/disable safely; each capability independently passes measured quality, privacy, reliability, latency and cost. |
| **I5 — Daily product** | Installable offline product, responsive Today/capture and robust recovery. | Offline use, clear tested backup/restore and narrow-screen core flow. |
| **I6–I9 Later** | Inbox; first justified remote capability; file workspace; broader PA slices. | Each addition follows `input -> validated command -> deterministic effect -> audit -> Undo`. |

## Quality and cost gate

For a changed behaviour, add proportionate automated evidence. Scheduling changes require hard-rule properties and human-reviewed golden scenarios; stored-data changes require migration and backup tests; changed UI requires keyboard/accessibility checks; release paths require an end-to-end core flow. Build ordinary check, test and deployment automation with I0; it must validate the application, not document headings. Keep infrastructure at £0 until the core proves value. Use synthetic/non-sensitive data for any trial of a remote service until its handling terms are explicitly accepted.

For I4, each capability selects a qualified implementation independently after labelled evaluation; user clarification is a valid result. Send only necessary facts, cache safe results by capability and relevant normalised versions, and enforce visible budget/usage limits before a call. Proposed/uncertain facts remain visibly provisional until confirmed, and confirmed corrections improve later evaluation. Failure, invalid output or a budget limit falls back to deterministic behaviour or clarification.

## Durable choices

| Choice | Why | Revisit when |
|---|---|---|
| Deterministic planner; optional interpretation only returns checked proposals. | Reproducible, offline-safe, explainable and undoable planning with help for incomplete input. | Golden cases show the boundary cannot meet the outcome. |
| Local versioned data plus tested export/import first. | Proves one-person value without account, synchronisation, privacy or infrastructure overhead. | A demonstrated multi-device, recovery or remote-work need exceeds local backup. |
| Modular monolith with domain, planner and repository boundaries. | Cheap and understandable now; retains real extraction paths. | A second application or deployed boundary genuinely consumes a module. |
| Remote capability, external calendar access and file processing follow a proven local core, one vertical capability at a time. | Avoids premature cost, privacy, conflict and integration work. | The preceding gate passes and a user benefit cannot be met locally. |

## Plan and record rule

Review the delivery map at a milestone boundary or when user need, evidence, scope, priority, risk, cost, privacy, architecture or completion gate materially changes. Ask: is the outcome right, is the next slice best, and does its evidence still prove value? If the answer changes, update the affected row and relevant decision in the same commit; if not, record nothing.

Update this packet only for changed current truth: outcome/non-negotiable, active milestone, next action, blocker, gate, architecture boundary or durable decision. Add a separate decision record only if a compact row cannot explain a consequential choice safely. Do not add hand-off diaries, routine review logs, chat transcripts, speculative implementation detail or information recoverable from Git. Keep it concise; prune before adding.
