# Repository agent protocol

Applies to every agent and the whole repository.

1. Read `PROJECT_CONTEXT.md` completely, then inspect Git and relevant files before planning or editing.
2. Read `docs/DEVELOPMENT_PLAN.md` before starting or closing an iteration, or when scope, risks or priorities may have changed.
3. Read linked ADRs before changing an accepted decision. User instructions outrank repository documents.
4. Continue from the recorded phase/next task; do not restart settled work or claim unverified completion.
5. Make bounded changes, preserve unrelated work, use UK English and run proportionate tests.
6. Before finishing, update `PROJECT_CONTEXT.md` when work changes verified state, roadmap status, next task, blockers, contracts or decisions. Apply the plan review protocol when triggered. Add/supersede an ADR for consequential reasoning. Commit these with the related implementation.
7. If no context update is warranted, state why in the hand-off. Never add transcripts, secrets, chain-of-thought or verbose diaries.
8. Follow `CONTRIBUTING.md`; ensure `node scripts/validate-project-context.mjs` passes.
