# 0005: Standard calendar component

Status: Accepted  
Date: 2026-08-31

## Context

Calendar interaction is central but expensive to build accessibly and reliably. The MVP needs day/week time grids, selection and drag/resize—not resource scheduling.

## Decision

Use FullCalendar Standard behind feature-level components. Do not use premium resource views in the MVP. Keep product/domain state outside the library so it can be replaced if needed.

## Consequences

Development time and licence cost fall substantially. Styling and accessibility still require product QA; library event types must not become domain types.

## Rejected alternatives

- Custom grid initially: high implementation and accessibility cost.
- Premium scheduler: no MVP requirement justifies it.
