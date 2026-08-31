# 0003: Modular monolith

Status: Accepted  
Date: 2026-08-31

## Context

The product needs clean scheduling, storage, intelligence and UI boundaries but initially has one application and one user. Multiple packages/services would add coordination overhead before reuse exists.

## Decision

Use one strict TypeScript application with framework-independent domain/scheduler modules and port-based infrastructure. Extract packages only when a server or second application consumes them; add services only for a demonstrated deployment boundary.

## Consequences

The system remains understandable and cheap while preserving future extraction paths. Dependency rules and tests must prevent boundary erosion.

## Rejected alternatives

- Microservices/large monorepo initially: unjustified operational complexity.
- Unstructured single application module: cheap initially but costly to extend/test.
