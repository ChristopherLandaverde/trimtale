# Connect generation, browser verification, and GA4 evidence

Change record version: 2

Issue: `.scratch/conversational-tracking-specs/issues/23-connected-verification-evidence.md`

## Summary

One exactly recognized GTM/GA4 context now drives setup generation without proprietary
page meta tags, updates browser evidence in place, and can add separately gated,
read-only GA4 Realtime before/after correlation.

## Why

The pre-chat card proved which container was accessible, but generation, browser
verification, and platform confirmation remained disconnected or permanently pending.
Practitioners could not safely see one continuous evidence handoff.

## Behavior

- Exact live GTM inspection returns sorted, unique GA4 measurement IDs alongside safe
  account/container identity; zero or multiple destinations remain unresolved.
- Navigation and form generation consume one exact recognized context, with proprietary
  meta tags retained only as deterministic-fixture fallback.
- Guided form verification records named row handles, tolerates bounded late browser
  collection, and updates browser pass/failure in the original evidence path.
- A separately enabled Analytics read client maps one measurement ID to one accessible
  property/stream, records an expiring in-memory Realtime baseline, and confirms only
  after browser pass plus an aggregate count increase.
- Local disablement, inaccessible/ambiguous destinations, provider denial, expiry,
  pending counts, malformed data, and offline service remain safe distinct outcomes.
- No GTM/GA4 mutation, publication, cookies, form values, tokens, raw provider bodies,
  user-level identity, or event-level identity are introduced.

## Regression coverage

- Analytics unit tests cover exact enablement, property/stream resolution, pending then
  confirmed counts, disabled reads, ambiguity, expiry, and provider denial.
- GTM tests cover bounded measurement-ID extraction and separate Analytics scope
  request behavior.
- The form verdict corpus covers a visible successful outcome with one complete GA4
  request even when page-owned data-layer internals are unavailable.
- Built-extension journeys cover no-meta exact generation, a delayed browser request,
  aggregate platform pass, private-value omission, provider denial, attacker-shaped
  names, independent browser pass, fixed connection states, and reviewed visuals.

## Verification

- Focused unit regressions: 51 passed across Analytics, GTM, and form verdict tests.
- Focused Chromium connection/evidence matrix: 7 passed.
- First complete gate passed 270 deterministic tests and 31/35 Chromium journeys; four
  reviewed visual baselines reflected the corrected stable width and expanded evidence
  layout. Targeted replacements passed, including 3/3 candidate and 3/3 connection
  repeats.
- Final `npm run verify` passed local preflight, 37 change records, every build and
  strict check, 270 deterministic tests across 38 files, and all 35 Chromium journeys.
- Exact-base documentation and GitHub Verify remain merge gates.

## Exploratory review

[`docs/reviews/2026-08-23-connected-verification-evidence.md`](../docs/reviews/2026-08-23-connected-verification-evidence.md)
records deterministic happy/negative/adversarial review and the credentialed disposable
journey. Setup and browser evidence pass live; the external GA4 property has not yet
surfaced any Realtime rows (`rowCount: 0`) despite HTTP 204 collection, so the live
platform row honestly remains pending and the issue remains active.

## Documentation

Issue 23, the accepted conversational specification, current capabilities, the Google
workflow runbook, exploratory review, and this change record define exact context,
aggregate-correlation semantics, configuration, privacy, and recovery behavior.

## Rollback

Revert this change to remove recognized measurement IDs and Analytics start/confirm
routes from the visible flow. Existing pre-chat GTM recognition, setup meta fallback,
browser verdicts, and guarded GTM workflows remain independently reversible.
