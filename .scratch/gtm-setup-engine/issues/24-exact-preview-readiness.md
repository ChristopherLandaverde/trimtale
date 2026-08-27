# Define exact-preview readiness

Delivery mode: specification
Status: open

## Question

Which observable conditions must be true before the website agent enables an exact
draft preview run?

## Proposed outcome

An action receipt names the recognized container, managed workspace, bound preview,
connected target, debug state, and loaded container. The browser-run action remains
unavailable until every required condition matches the durable operation.

## Non-goals

- Automating Google sign-in or an undocumented Tag Assistant interface.
- Treating a debug cookie alone as exact-preview evidence.
- Creating a version or granting publication authority.

## Acceptance outline

- A matching connected Preview target enables the browser run.
- Missing, stale, live-only, or wrong-container state explains the failed condition.
- Rechecking readiness cannot mutate GTM or create a second operation.

## Comments

- 2026-08-26: Recorded after the real workflow showed that an open Tag Assistant tab,
  a validated quick preview, and a connected target are separate facts.
