# Report provider operation progress

Delivery mode: specification
Status: open

## Question

How should the website agent represent long Google operations without encouraging a
duplicate retry?

## Proposed outcome

The agent displays the durable provider stage and whether one request is still active.
A display timeout remains distinct from provider failure, and retry is unavailable
while the same operation is in flight.

## Non-goals

- Changing Google quota behavior or provider semantics.
- Parallel mutation requests.
- Treating elapsed time as success or failure.
- Adding a second persistence path.

## Acceptance outline

- Planning, application, validation, versioning, publication, and rollback have
  distinct visible states.
- Reload recovers the durable stage without issuing a duplicate mutation.
- A provider error and a still-running request produce different action receipts.

## Comments

- 2026-08-26: Real no-change validation and version creation each outlasted the
  browser harness's display wait while the single backend operation continued safely.
