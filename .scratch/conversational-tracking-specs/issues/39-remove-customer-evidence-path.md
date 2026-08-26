# Remove the customer-facing evidence path

Delivery mode: implementation
Status: resolved

## Production outcome

The website agent no longer renders the eight-stage Evidence path card. Customers see
only the connected GTM/GA4 context, page markers, action receipts, review state, and
the concise browser/platform verification result relevant to their current decision.

## Non-goals

- Removing structured run evidence, privacy filtering, verdict logic, provider checks,
  exact-draft binding, or automated evidence assertions.
- Removing the pre-chat GTM/GA4 connection card, action receipts, page highlights, or
  final verification result.
- Adding a demo-only runtime branch or changing setup and publication authority.

## Authorization

The user explicitly requested removing the Evidence path from the final customer
project on 2026-08-25 and confirmed the proposed behavior and non-goals.

## Regression contract

- `tests/e2e/navigation-extension.spec.ts` proves a confirmed navigation setup exposes
  its action and page markers without rendering the Evidence path or its internal
  stage labels.
- `tests/e2e/connected-verification-evidence.spec.ts` proves browser and GA4 results,
  provider-denied state, retry behavior, and privacy boundaries remain visible in the
  task result without an Evidence path.

## Dependencies

- Issue 23 connected verification evidence remains the authoritative backend and
  verdict contract; this slice changes only its customer presentation.

## Comments

- 2026-08-25: Removed the duplicate eight-stage card and kept connection context,
  page markers, receipts, final browser/platform results, safe provider failure, and
  retry behavior. Visual review found no unresolved blocker or high-severity issue.
  `npm run verify` passed 404 deterministic tests and 61 Chromium journeys; all builds,
  typechecks, preflight checks, and 71 change records passed.
