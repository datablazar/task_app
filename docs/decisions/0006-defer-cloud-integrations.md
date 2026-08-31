# 0006: Defer cloud and integrations

Status: Accepted  
Date: 2026-08-31

## Context

Authentication, cloud state, calendar synchronisation and file ingestion create privacy, conflict, deployment and recurring-cost work before core scheduling quality is proven.

## Decision

Complete and validate the local manual planner, deterministic scheduler and bounded intelligence first. Add only the cloud capability that solves a demonstrated problem: protected AI proxy and/or sync, then Google Calendar, then Microsoft; file ingestion follows stable command/proposal pipelines.

## Consequences

The useful core arrives sooner and later integrations inherit validation, audit and Undo. Remote access and multi-device use remain deferred.

## Rejected alternatives

- Build every integration alongside MVP: high rework and slow feedback.
- Direct file/calendar mutation: bypasses domain safeguards.
