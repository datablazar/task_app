# Repository working protocol

1. Read `PROJECT.md`, then inspect Git, affected code and relevant tests. User instructions override repository files.
2. Continue from the active milestone. Make the smallest coherent vertical change; preserve unrelated work and use UK English.
3. Treat code, tests and migrations as implementation truth; `PROJECT.md` as current intent, state and durable rationale; Git as history. Do not duplicate one in another.
4. Before a milestone boundary or a material scope, priority, risk, cost, privacy, architecture or gate change, apply the review rule in `PROJECT.md`. If nothing changes, write nothing.
5. Before hand-off, run proportionate checks. Update `PROJECT.md` only when current truth changes; update the relevant Durable choices row, or add a separate decision record only when a consequential choice cannot fit there. Commit related implementation, tests and current-state changes together.
6. Never add secrets, transcripts, hidden reasoning, generated clutter or work diaries. Prefer clear contracts, tests and small commits over process records.
