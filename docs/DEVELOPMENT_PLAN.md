---
plan: development
version: 1
status: current
last_reviewed: 2026-09-01
next_review: before-I0-completion-or-material-change
---

# Development plan

## Purpose

This is the practical build sequence for the Personal Assistant Planner. It turns the roadmap in [PROJECT_CONTEXT.md](../PROJECT_CONTEXT.md) into small, independently useful milestones.

Read the context file and linked ADRs before starting work. This plan does not override them.

## Outcome

Create a local-first planner that helps one person capture work, automatically schedule it around real constraints, explain material changes and safely revise the plan when circumstances change.

The first useful version must work without remote services or optional inference. Later capability must strengthen the deterministic core, never replace it.

## Plan governance

This is the current forward-looking plan, not a detailed history. `PROJECT_CONTEXT.md` records current state; ADRs record durable reasoning; Git records implementation history.

### Review triggers

Review this plan:

- Before starting or closing an iteration.
- At least once during each active iteration.
- When user needs, scope, priority, risks, cost, privacy, architecture, dependencies or completion gates materially change.
- When evidence shows the existing plan is failing, blocked or no longer the best route to the intended outcome.

### Review process

Answer these five questions briefly:

1. Is the intended outcome still correct?
2. Is the active iteration still the best next step?
3. Does its completion gate still prove the right thing?
4. What evidence, risk, blocker or user feedback changes the plan?
5. Is the result `CURRENT`, `UPDATE`, `DEFER` or `BLOCKED`?

If the result is `UPDATE`, revise the relevant future milestone and increment `version` only when scope, order or a completion gate changes. If it changes a durable architectural, privacy, cost or public-interface decision, add or supersede an ADR. Update `last_reviewed`, `next_review` and one compact entry in Review record for every review. Keep at most five entries; Git retains older detail.

## Delivery rules

- Finish one milestone before beginning the next.
- Each milestone must leave the app usable, tested and simpler to extend.
- Keep scope bounded. Put non-essential ideas in the deferred backlog rather than expanding an active milestone.
- Preserve hard scheduling constraints and exact Undo throughout.
- Do not add remote storage, authentication, external calendars or paid services until their stated gate is met.
- Update the current state and hand-off in `PROJECT_CONTEXT.md` when verified work changes the plan.

## Milestone sequence

### I0 — Foundation

**Goal:** establish a reliable local development base and prove that data can survive a full backup cycle.

Build:

- Application shell, navigation and error boundaries.
- Strict domain types for projects and tasks.
- Repository interfaces and versioned local storage.
- Versioned JSON export and import.
- Test setup, fixtures and one-command local run.

Done when:

- A project and task can be created, persisted, exported, imported and read back unchanged.
- Invalid imported data fails clearly without corrupting existing data.
- The basic test suite and context validator pass.

Do not add automatic scheduling, remote services or optional inference here.

### I1 — Manual planner

**Goal:** make the application useful before automation.

Build:

- Projects, tasks, subtasks, completion and reopening.
- Working hours, protected time and fixed events.
- Manual task sessions in day and week calendar views.
- Task details: duration, priority, deadline, earliest start, preferred windows, session limits, splitting, breaks and dependencies.
- Basic edit history and Undo.

Done when:

- A user can manually construct a week that persists offline.
- Time-zone, keyboard and accessibility checks pass for core task/calendar journeys.
- Fixed events and protected time are visually and behaviourally distinct.

### I2 — Reference scheduler

**Goal:** create a correct, explainable automatic planner.

Build:

- Availability calculation from working time, protected time, fixed events and locked sessions.
- Dependency graph validation and cycle detection.
- Deterministic task ranking and allocation.
- Session splitting, break enforcement and deadline-risk reporting.
- Schedule revisions, reason codes and exact Undo.

Done when:

- The scheduler preserves every hard constraint in its invariant suite.
- Equal snapshots and policy versions produce equal results.
- Impossible work is explicit rather than hidden.
- Adding a fixed event produces a valid revision with factual reasons and exact Undo.

### I3 — Planning quality

**Goal:** make schedules realistic enough to follow.

Build:

- Preserve stable sessions where possible.
- Reduce fragmentation and unnecessary context switching.
- Balance workload across days.
- Handle missed sessions.
- Add clear policy presets.
- Add human-reviewed golden planning scenarios.

Done when:

- The improved scheduler matches or beats the reference across golden scenarios without violating invariants.
- Replanning feels interactive with representative personal workloads.
- The reasons for changes remain understandable.

### I4 — Optional inference

**Goal:** help when task information is incomplete without weakening deterministic planning.

Build:

- Stable contracts for `inferPriority`, `estimateDuration`, `classifyTaskCharacteristics` and `needsClarification`.
- Provenance, confidence, caching, usage limits and failure handling.
- Labelled evaluation cases and acceptance thresholds.
- Contextual display of assumptions, with confirmation and correction.

Done when:

- Every capability can be disabled or fail without blocking normal planning.
- An implementation is selected only after passing quality, privacy, reliability, latency and cost evaluation.
- Optional inference cannot write storage, alter hard constraints or allocate calendar time directly.

### I5 — Installable local product

**Goal:** make the core easy to use daily.

Build:

- Installable offline application.
- Responsive Today and task-capture views.
- Hardened backup/restore and migration experience.
- Optional static deployment that exposes neither personal data nor secrets.

Done when:

- The app installs, opens and works offline.
- Backup/restore is clear and tested.
- Core paths remain usable on narrow screens.

### I6 — Intelligent inbox

**Goal:** turn unstructured capture into safe, reviewable work.

Build:

- Natural-language capture.
- Proposed project association, duplicate detection and task breakdown.
- Batch review, acceptance, rejection and correction.
- Preference proposals based on repeated confirmed changes.

Done when:

- Every proposal has traceable input, validation and Undo.
- Ambiguous or high-impact proposals request clarification.

### I7 — Only justified remote capability

**Goal:** add the first remote feature only when it solves a demonstrated problem.

Choose one, not all:

- Protected remote inference gateway.
- Multi-device synchronisation.
- One external-calendar integration.

Done when:

- Authentication, conflict handling, recovery and cost controls are tested.
- Repeated operations are safe and do not duplicate data.
- The feature has a clear user benefit that the local-first version cannot provide.

### I8 — File workspace

**Goal:** derive traceable task proposals from stored material.

Build:

- File intake and local extraction where practical.
- Source-linked candidate projects, tasks, dates and dependencies.
- Batch processing for non-urgent work.
- Duplicate/conflict detection and incremental reprocessing.

Done when:

- No source directly mutates project data.
- Every accepted change uses a normal domain command and can be traced and undone.

### I9 — Broader PA capability

**Goal:** add one useful capability at a time without turning the product into an opaque automation system.

Potential work includes recurring tasks, briefings, reminders, energy/resource constraints or user-approved actions.

For each addition, define:

```text
input -> interpretation (if needed) -> validated command
      -> deterministic effect -> audit -> Undo
```

## Cross-milestone quality gates

Before completing any milestone:

- Run relevant unit, integration and end-to-end tests.
- Check keyboard access, focus order, contrast and non-colour status cues for changed UI.
- Check migrations and backup/import whenever persisted data changes.
- Check scheduler invariants and golden scenarios whenever allocation changes.
- Check that optional inference failure leaves core functionality available.
- Update `PROJECT_CONTEXT.md` with verified state, next task and any blocker.
- Add an ADR only when a durable architectural, privacy, cost or public-interface decision changes.

## Current focus

Start with **I0 — Foundation**. The immediate task is to initialise the minimal application and tests, then implement the create → persist → export → import vertical slice.

Do not begin I1 until that slice is demonstrably correct.

## Review record

- 2026-09-01 | Initial plan review | CURRENT | I0 remains the correct next step; review before I0 completion or a material trigger.
