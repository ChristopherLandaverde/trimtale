# Exact preview, bounded repair, and version evidence

Delivery mode: implementation
Status: in progress

## Production outcome

The agent exercises the exact managed-workspace draft on the website, binds evidence
to its fingerprint, performs bounded intent-preserving repair when needed, and creates
one reviewable container version only from the passing draft.

## Non-goals

- Scheduled monitoring.
- General incident diagnosis.
- Automatic publication.
- Repair that changes the confirmed business outcome.

## Authorization

The user authorized continuous Stage 1 implementation on 2026-08-24.

## Regression contract

- Browser journeys prove the exact draft rather than a generated approximation.
- `packages/core/src/draft-verification.test.ts` proves that any setup, workspace, or
  GTM preview change invalidates prior verification evidence.
- Repair attempts are bounded, individually receipted, preserve the confirmed intent,
  and stop on ambiguity.
- Static, client-routed, dynamic, excluded-page, and adversarial fixtures run through
  the same verification interface.

## Dependencies

- Issues 02 and 03; Issue 05 for the custom-code path.

## Preview decision

Stage 1 uses a supported human-assisted Tag Assistant handoff. The documented GTM
quick-preview response supplies compiler and temporary-version evidence but no browser
session handoff, so undocumented preview automation is excluded. Returned browser
evidence must still match the exact setup, workspace, and quick-preview fingerprints.

## Implemented checkpoint

- New durable operations now stop at `validated` with `run_preview` as the next step;
  no container version is created at that checkpoint.
- The website agent displays the three exact-draft fingerprints and guides the user
  to open GTM, select the managed workspace, start Preview, connect the site in Tag
  Assistant, and return for a guided browser run.
- Passing form or known-interaction evidence is normalized into one exact-draft run.
  The protected backend validates and binds that run before the operation can enter
  `draft_verified` and create an immutable version.
- Chromium regression journeys prove the fail-closed ordering for lead-form and
  privacy-safe phone-click setups.
- Failed exact-draft evidence now enters a durable two-attempt ledger only when its
  setup, workspace, and preview fingerprints are current. A concrete repair of the
  unchanged approved setup receives separate review, reapplication, provider
  validation, and new workspace/preview fingerprints before another browser run.
- Ambiguous, exhausted, stale, inconclusive, or intent-changing repair paths stop
  without creating a version or publishing.

## Remaining work

- Exercise the handoff against a real authenticated GTM workspace and Tag Assistant
  session; controlled provider responses do not satisfy that external acceptance
  criterion.
- Expand representative exact-preview fixtures beyond the two current browser paths.

## Comments

- 2026-08-26: Connected failed exact evidence to reviewable managed-entity repair,
  bounded durable attempt receipts, provider revalidation, and a mandatory refreshed
  exact-preview binding. Core and runner regressions cover ambiguity, exhaustion,
  intent preservation, exact approval, and no writes before review. Chromium covers
  the visible negative/repair/retry path and privacy boundary. `npm run verify` passed
  411 deterministic tests and 64 Chromium journeys; headed exploratory review has no
  unresolved finding. The issue remains open for real Tag Assistant interoperability
  and broader representative preview fixtures.
