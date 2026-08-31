# Repository agent protocol

Applies to every agent and the whole repository.

1. Read `PROJECT_CONTEXT.md` completely, then inspect Git and relevant files before planning or editing.
2. Read linked ADRs before changing an accepted decision. User instructions outrank repository documents.
3. Continue from the recorded phase/next task; do not restart settled work or claim unverified completion.
4. Make bounded changes, preserve unrelated work, use UK English and run proportionate tests.
5. Before finishing, update `PROJECT_CONTEXT.md` when work changes verified state, roadmap status, next task, blockers, contracts or decisions. Add/supersede an ADR for consequential reasoning. Commit these with the related implementation.
6. If no context update is warranted, state why in the hand-off. Never add transcripts, secrets, chain-of-thought or verbose diaries.
7. Follow `CONTRIBUTING.md`; ensure `node scripts/validate-project-context.mjs` passes.
