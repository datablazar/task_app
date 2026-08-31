# 0002: Local-first storage

Status: Accepted  
Date: 2026-08-31

## Context

The first user is one person. Accounts, servers and synchronisation increase cost and delay validation of the scheduling value.

## Decision

Start as an offline-capable browser/PWA using versioned IndexedDB repositories plus tested versioned JSON export/import. Keep storage behind ports so cloud storage can replace or synchronise with it later.

## Consequences

Early infrastructure cost is £0 and development is faster. Backup UX and migrations are mandatory; multi-device use and remote background work wait for a later iteration.

## Rejected alternatives

- Cloud database from day one: premature cost/auth/sync complexity.
- Unversioned browser state: unacceptable migration and recovery risk.
