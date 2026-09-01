# Personal Assistant Planner

A local-first task and calendar application that automatically builds and repairs a realistic schedule. Deterministic rules enforce constraints; optional, capability-selected inference handles bounded ambiguity.

## Start here

- [Canonical project context](PROJECT_CONTEXT.md): current goals, contracts, roadmap, status and next task.
- [Decision records](docs/decisions/README.md): durable architectural reasoning.
- Agent entry points: [repository protocol](AGENTS.md), [compatibility entry points](CLAUDE.md) and [GEMINI.md].
- [Contribution protocol](CONTRIBUTING.md): required implementation, documentation and verification workflow.

Current phase: **I0 — foundation**. No application code has been implemented yet.

Repository checks automatically validate the context structure and require implementation-bearing pull requests to update the project state packet.

## Prerequisites

- NVM with Node.js 24.20.0 (`nvm install && nvm use`).
- npm 11 or the compatible npm bundled with Node 24.

This repository uses npm only. Commit `package-lock.json`; do not add `pnpm-lock.yaml` or `yarn.lock`.
