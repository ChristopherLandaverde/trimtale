# Define exact-preview readiness

Delivery mode: implementation
Status: resolved

## Production outcome

Before the website agent enables an exact draft browser run, it displays one readiness
receipt for the durable operation, current page, recognized container, loaded
container, and supported human Tag Assistant handoff. Local mismatches block
confirmation. The practitioner must explicitly confirm that Google shows the current
target as Connected; that confirmation is bound to the current operation, Preview
fingerprint, container, and page.

## Proposed outcome

An action receipt names the recognized container, managed workspace, bound preview,
connected target, debug state, and loaded container. The browser-run action remains
unavailable until every required condition matches the durable operation.

## Non-goals

- Automating Google sign-in or an undocumented Tag Assistant interface.
- Treating a debug cookie alone as exact-preview evidence.
- Creating a version or granting publication authority.
- Persisting a Connected claim across a browser restart or changed Preview binding.

## Authorization

The user authorized continuing the agreed product-slice sequence on 2026-08-27 after
Issue 23 completed.

## Regression contract

- `tests/e2e/conversational-form.spec.ts` proves an exact browser run is unavailable
  until the loaded container and current target match and the practitioner confirms
  Google shows Connected.
- The same suite proves a wrong loaded container or changed target blocks confirmation
  and explains the mismatch without a workflow API request.
- Existing exact-Preview journeys continue through verification, immutable version
  creation, publication approval, and live verification after readiness confirmation.

## Comments

- 2026-08-26: Recorded after the real workflow showed that an open Tag Assistant tab,
  a validated quick preview, and a connected target are separate facts.
- 2026-08-27: Google documents the Connected state in Tag Assistant but no supported
  page API for reading it; its URL debug signal is optional. The accepted boundary is
  therefore local container/target proof plus one explicit practitioner confirmation,
  never a cookie-only Connected claim.
- 2026-08-27: Implemented the receipt and non-durable confirmation gate for exact form
  and known-interaction runs. Target drift blocks with no workflow mutation, all
  affected journeys cross the gate, and full verification passed with 421 deterministic
  tests and 75 Chromium journeys.
