---
schema: PA/2
updated: 2026-09-01
phase: I0
state: spec-only
next: I0-bootstrap
lang: en-GB
repo: https://github.com/datablazar/task_app
---

# PA Planner: canonical context

Portable current spec+state for coding agents. Git owns code/history; ADRs own detailed reasoning. Authoritative unless user overrides. Keywords: **MUST/NOT, SHOULD, MAY**.

## 0 Agent protocol

1. Read all; inspect repo; continue from §12. Never restart/redesign/claim unverified work.
2. Make the smallest coherent vertical change; preserve unrelated user work.
3. Finish with proportionate tests, then update header, §11 status, §12 state, §13 hand-off, and §14 only for changed decisions. Commit state/ADR updates with the work they describe.
4. UK English. State assumptions/blockers. Never store secrets, chain-of-thought, chat, speculative claims, generated artefacts or verbose diaries here.
5. Keep <8k tokens: integrate durable facts; max 3 hand-off lines; Git/ADRs hold detail. Run `node scripts/validate-project-context.mjs`.

Authority: current user > executable tests/contracts > this file > accepted ADRs > code reality > Git history > old discussion. If sources conflict, investigate and record; never silently choose. Syntax: status `TODO|DOING|BLOCKED|DONE|DEFERRED`; evidence=path/test/SHA. Hand-off=`date|change|evidence|next`.

## 1 Goal + laws

Build a high-quality, low-cost, single-user, local-first web/PWA: projects/tasks/subtasks feed an internal calendar that autonomously schedules/replans flexible work around constraints; later ingest NL/files.

Success: fast capture; rich/optional constraints; valid day/week plan; immediate sensible replan after change; visible fixed/locked/flexible/provisional/completed/missed states; risks/reasons/assumptions; exact Undo; offline use; backup/restore; useful with all optional inference implementations unavailable.

| ID | Law |
|---|---|
| P1 | Calendar is command centre; projects/tasks supply work. |
| P2 | Code calculates; optional inference interprets ambiguity only. |
| P3 | Value precedence: user > calendar import > confirmed learned preference > inference > system default. |
| P4 | Optional inference returns validated typed proposals only: no scheduling, storage writes, hard-rule relaxation or external action. |
| P5 | Autonomy is explainable, attributable, revisioned and exactly reversible. |
| P6 | Same snapshot+policy version => same schedule. |
| P7 | Offline/provider-failure operation is mandatory. |
| P8 | Modular monolith + usable vertical slices; abstract only real boundaries. |
| P9 | £0 until value proven; cloud/accounts/integrations deferred. |
| P10 | Quality requires invariants, human-reviewed golden plans, a11y and correction data. |

## 2 Scope

**MVP I0–I5:** project/task/subtask CRUD+completion+dependencies; availability/fixed/protected/preferred time; breaks/session limits; manual day/week calendar; deterministic auto-plan/replan; deadline risks; reason codes; revision/Undo; local persistence+versioned JSON backup; PWA; optional capability-selected inference for priority/duration/characteristics/clarification.

**Later, gated:** intelligent inbox/NL; source-linked file dump; protected AI proxy; cloud sync; Google then Microsoft calendar; recurrence/reminders/briefings; energy/location/resources; native/mobile/team; user-approved external actions.

**Defer:** general agent/chat-first UI, routine implementation-consensus voting, vector DB, microservices, Electron, Kubernetes, premium calendar components, simultaneous provider/calendar integrations, autonomous messaging/booking.

## 3 Cost policy

- I0–I3: local, £0 infrastructure, no optional inference; use mocks and deterministic fixtures.
- I4: benchmark candidate implementations on labelled synthetic cases; select a qualified implementation per capability. Add alternatives only for measured quality/privacy/reliability gain.
- Never invoke optional inference inside scheduling. Call only for missing/ambiguous semantics or explicit request.
- Cache by capability + relevant normalised input + policy/schema/implementation versions; invalidate on relevant change.
- Prefer rule/cache/user clarification before an inference call; escalate only for consequential ambiguity. No routine consensus.
- Enforce applicable daily/monthly spend and usage caps, per-capability limits, allow-list, hard stop and visible usage.
- Require short strict structured results; batch only non-urgent evaluation/bulk/file work when cheaper.
- External/free service tiers: use synthetic/non-sensitive data only unless current data terms are explicitly accepted. Re-check price, retention and free tiers before use.
- No paid service/dependency without user approval+decision record. Prefer FullCalendar Standard (MIT), not premium resource views.

## 4 Architecture

I0–I5:

```text
React UI -> commands/queries -> domain -> pure scheduler
                              -> repository ports -> IndexedDB
                              -> inference port -> mock/qualified implementation
```

```text
src/{app,features,domain,scheduler,intelligence,storage,shared}
tests/{scenarios,integration,e2e}
```

Rules: domain imports no React/storage/inference/calendar UI; scheduler is pure/no I/O; UI imports no DB/inference SDK; implementations depend on ports; validate all external input; no dumping-ground managers/helpers/utils.

Extract `domain/scheduler/contracts` packages only when server/second app consumes them. Add serverless AI proxy only for deployed AI; cloud DB only for multi-device/remote backup/webhooks/sharing. Candidate (verify terms): Cloudflare Pages + narrow authenticated Worker + D1; all replaceable via ports.

Baseline: Node 24.20.0 LTS via NVM; npm; strict TypeScript; React+Vite; IndexedDB+migrations; FullCalendar Standard; Zod; Vitest+RTL+fast-check+Playwright; Temporal-compatible date layer (no scattered raw `Date` maths); accessible code-native UI; PWA after core stability. Versioned JSON import/export from I0; round-trip tested. Secrets only environment/server bindings, never client/Git.

## 5 Domain + commands

Stable IDs; UTC instants + IANA zone; versioned persistence; provenance for uncertainty.

| Entity | Core fields/responsibility |
|---|---|
| Project | id,name,description,status,colour,dates,default policy |
| Task | id,project,parent,title,description,status,total/remaining duration,priority,deadline,earliest start,windows,session min/max,splittable,break,lock/mode,provenance |
| Dependency | predecessor,successor,`finish-before-start` initially,lag |
| FixedEvent | start,end,zone,availability effect,source/ref |
| TaskSession | task,start,end,state,lock,revision,reasons |
| Availability | weekly windows,protected time,date exceptions,zone |
| Policy | daily cap,session/break defaults,focus/context/disruption/load weights,version |
| Revision | trigger,input/policy versions,add/move/remove,risks,prior state,reasons,time |
| InferenceDecision | capability,implementation/version,policy/schema versions,input hash,result,confidence,validation,disposition,command |

```ts
type Source='user'|'calendar'|'learned'|'inference'|'system';
type Sourced<T>={value:T;source:Source;confidence?:number;decisionId?:string;confirmedAt?:string};
```

Commands: project create/update/archive; task create/update/complete/reopen; dependency add/remove; set availability; fixed-event CRUD; session lock/unlock/move; reschedule; apply-AI-proposal; undo-revision; import-backup. Every command MUST validate invariants, transact atomically, audit, declare replan need and return typed result/failure. Manual/AI/file/calendar inputs all use commands.

## 6 Scheduler

```ts
type Snapshot={now;zone;tasks;dependencies;fixedEvents;existingSessions;availability;policy};
type Result={sessions;unscheduled;risks;changes;reasonCodes;diagnostics;inputHash;policyVersion};
interface Optimiser{generate(x:Snapshot):Result}
```

**Hard:** fixed/locked blocks; working/protected time; earliest start; dependencies; task windows; session min/max; breaks; remaining duration; zones. Deadline hard when feasible; otherwise explicit risk/impossibility.

**Soft utility:** deadline safety/slack, explicit priority, dependency criticality, preferred-window fit, continuity, load balance; penalise fragmentation, context switch, disruption.

Pipeline: validate/cycles -> availability minus occupied -> graph/eligibility/criticality/slack -> candidate slots on configurable quantum -> deterministic rank+allocate/update/repeat -> bounded local improvement -> independent invariant validation/fail safe -> diff/reasons/reversible revision.

Reasons: `DEADLINE_RISK,DEPENDENCY_READY,FIXED_CONFLICT,PREFERRED_WINDOW,SESSION_SPLIT,MISSED_REALLOCATED,PRIORITY_DISPLACED,LOAD_BALANCED,LOCK_PRESERVED,UNSCHEDULABLE`.

Start with explainable greedy reference, retain as fallback/oracle. Consider beam/local/constraint optimisation only when golden cases prove need.

## 7 Intelligence

Typed capabilities: I4=`inferPriority,estimateDuration,classifyTaskCharacteristics,needsClarification`; later=`suggestProject,detectDuplicates,proposeBreakdown,extractWorkCandidates,interpretScheduleInstruction,explainRevision`.

Flow: rule/confirmed/cache -> qualified capability implementation -> schema+fact/conflict/invariant checks -> (high confidence, low risk, reversible) provisional apply+disclose; else ask user or approved escalation; invalid/outage/budget => deterministic default/clarification.

Each capability selects its implementation through the same port; implementations MAY be deterministic heuristics, local or remote models, or user clarification. No implementation type is prescribed. Send minimum facts, not corpus. Facts/inferences remain separate; user can confirm/correct. Ask on low confidence, conflict, major displacement, wide duration uncertainty or sensitive/high-stakes issue. Log implementation/version/policy/schema/input hash, measured usage/cost, confidence, validation and disposition; redact sensitive data. Implementation failure never blocks CRUD/planning.

Before changing an implementation, policy or schema, pass versioned labelled evaluation: schema validity, accuracy, unsupported claims, calibration, abstention/clarification, fact conflict, latency, cost and stability.

## 8 UX

Nav: `Today|Calendar|Projects|Inbox|Settings` (Inbox disabled until ready). Today=next plan/risks/revision; Calendar=authoritative dominant day/week; Projects=hierarchy/dependencies; Inbox=capture/proposals; Settings=availability/policy/intelligence/privacy/usage/backup.

Quick task: title,project,duration,deadline,priority; progressive advanced: earliest start,windows,session limits/split,dependencies,break,mode. Calendar states differ beyond colour. Selection shows task+constraints+reasons+assumptions+lock/move consequences. Group auto-changes into inspectable Undoable revisions; avoid notification noise/chat panel. AI appears only as contextual suggestions/assumptions/clarifications.

Design: calm trustworthy editorial command centre; dominant calendar; cool-neutral + one accent + semantic risks; open rails/lists/grid, few nested cards; deliberate type/spacing; desktop calendar, excellent narrow Today/capture. Full keyboard, focus, screen-reader labels, contrast, non-colour cues, reduced motion, responsive order.

## 9 Quality

Every change: typecheck+relevant tests. UI: keyboard/a11y. Scheduler: properties+golden diff. Storage: migration+backup round-trip. Intelligence: failures+evaluation. Release: core Playwright flow.

Properties: no overlaps/out-of-hours; fixed/locked unchanged; dependencies/session/break rules hold; allocation <= remaining; completed not future-scheduled; impossibility explicit; Undo restores logically identical state; equal input deterministic.

Golden measures: deadline success/risk, fragmentation, switches, disruption, load balance, preferred fit. New optimiser must match/beat reference without correctness regression.

E2E: create project/tasks/constraints -> auto-plan -> add fixed event -> valid reasoned replan -> inspect -> exact Undo -> complete/miss -> replan -> export/import equivalent.

Release gate: zero known hard violations; deterministic; exact Undo; validated/provenance inference; offline/implementation-failure operation; migrations/backups tested; primary journeys accessible; no secret exposure.

## 10 Multi-agent development

- Primary implementer owns integration, tests and browser QA.
- Independent reviewer covers scheduler/domain/security, adversarial tests and difficult bugs.
- Specialist agent handles isolated UI prototypes, library research or alternative algorithms.

One issue/owner/branch; tests+evidence; different agent reviews; owner resolves; merge on gates. Parallelise disjoint modules only—never same domain type/migration/scheduler function/broad refactor. Prompts specify goal, scope, invariants, interfaces, acceptance and prohibitions. Resolve disagreement by law+test/benchmark, not model voting.

## 11 Roadmap

| ID | Deliverable / gate | Status |
|---|---|---|
| I0 | Skeleton, domain, IndexedDB/migrations, backup, tests; create/persist/export/restore project+task; one-command run | TODO |
| I1 | Manual planner: hierarchy, availability/fixed events/calendar/history; offline usefulness, transactions, zone+keyboard tests | TODO |
| I2 | Reference scheduler, splits/deps/risks/revisions/Undo; invariants+determinism+exact Undo | TODO |
| I3 | Stability/load/context/fragmentation/missed work/presets; golden improvement+interactive speed | TODO |
| I4 | Capability-selected inference+4 capabilities+cache/provenance/budgets/eval; measured benefit, failure-safe, no direct writes | TODO |
| I5 | Installable responsive PWA+backup+optional free static host; offline, no key/data exposure | TODO |
| I6 | Intelligent inbox/NL/duplicates/breakdown/preferences; traceable reversible proposals | DEFERRED |
| I7 | Only justified cloud proxy/sync/calendar; auth,idempotency,conflicts,recovery,cost approval | DEFERRED |
| I8 | File dump/local extraction/source-linked batched candidates; no direct mutation/duplicates | DEFERRED |
| I9 | Broader PA one vertical slice at a time; proposal->command->audit->Undo | DEFERRED |

## 12 Current state

Repo=`datablazar/task_app`; branch=`main`; initial remote base=`f9e8eb2`. Node 24.20.0 and npm 11.19.0 verified via NVM on Apple Silicon; repository-native context, ADR, agent and CI protocols exist; no app/package/tests. Active=`I0`; blocker=none. Next `I0-bootstrap`: initialise minimal React/Vite/TS/npm+tests; establish domain/storage boundaries; implement create-persist-export-import vertical slice; avoid unnecessary dependencies.

## 13 Hand-off (max 3; newest first)

- 2026-09-01|Made active development plan model agnostic; superseded provider-specific selection|context,ADR-0007|I0-bootstrap
- 2026-08-31|Standardised local/CI runtime on Node 24.20.0+NVM+npm|`.nvmrc`,workflow,context|I0-bootstrap
- 2026-08-31|Added self-enforcing Git/agent context protocol|agent files,CI validator,ADRs|I0-bootstrap

## 14 Decisions

- [D01](docs/decisions/0001-deterministic-scheduler.md)|Accepted in part|Deterministic scheduler; inference-specific wording superseded by D07.
- [D02](docs/decisions/0002-local-first-storage.md)|Accepted|IndexedDB+versioned backup first.
- [D03](docs/decisions/0003-modular-monolith.md)|Accepted|Modular monolith; extraction on trigger.
- [D04](docs/decisions/0004-single-llm-provider.md)|Superseded|Provider-specific selection; replaced by D07.
- [D05](docs/decisions/0005-standard-calendar-component.md)|Accepted|FullCalendar Standard; no premium MVP dependency.
- [D06](docs/decisions/0006-defer-cloud-integrations.md)|Accepted|Cloud/auth/integrations follow core quality.
- [D07](docs/decisions/0007-model-agnostic-intelligence.md)|Accepted|Select inference implementations by capability evidence, not model type/vendor.

## 15 Expansion/update rule

For new capability: add one terse scope+iteration/gate; create/supersede an ADR only if law/domain/cost/privacy/public interface changes; specify `input->interpret?->validated command->deterministic effect->audit->Undo`; add test evidence in §9; implementation detail belongs in code. Update §12 to verified reality and commit context/ADR with the change. Preserve laws, active contracts/work/evidence/decisions; remove repetition, stale narration and Git-recoverable detail.
