# Contribution protocol

## Before work

1. Read `AGENTS.md` and `PROJECT_CONTEXT.md`.
2. Inspect `git status`, current code/tests and relevant linked ADRs.
3. Confirm the bounded goal, invariants and acceptance evidence.
4. If starting/closing an iteration or facing a material change, review `docs/DEVELOPMENT_PLAN.md` using its Plan governance section.

## During work

- Preserve product laws and module boundaries; do not mix unrelated changes.
- Add tests with behaviour. Never expose secrets or bypass commands/validation.
- Create an ADR only for a consequential, durable choice; do not use ADRs as a work diary.

## Before hand-off

1. Run relevant tests plus `node scripts/validate-project-context.mjs`.
2. If verified state changed, update the context header, roadmap, §12 and one concise §13 hand-off line. If a decision changed, add/supersede its ADR and index/link it.
3. If a plan review was triggered, update the plan metadata and compact review record; change the plan version only when scope, order or a completion gate changes.
4. Commit implementation, tests and corresponding context/plan/ADR together. Use a concise outcome-focused message with test evidence.
5. If context genuinely did not change, explain why in the PR/hand-off.

Git owns detail; `PROJECT_CONTEXT.md` owns the compact current view; ADRs own durable reasoning. Never duplicate chat transcripts or large implementation narratives.
