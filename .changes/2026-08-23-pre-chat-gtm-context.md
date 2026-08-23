# Show authenticated GTM context before chat

Change record version: 2

Issue: `.scratch/conversational-tracking-specs/issues/22-pre-chat-gtm-context.md`

## Summary

Opening the website assistant now shows the page-observed GTM ID, exact API-authorized
account and container, and effective backend capability before the practitioner enters
a tracking request. Explicit offline, OAuth, unobserved, inaccessible, and ambiguous
states replace the former hidden/manual diagnostic handoff.

## Why

A practitioner could find the form but could not tell whether the local service was
running, whether GTM API authorization was connected, which account/container matched
the page, or what access level was safe. That uncertainty made every first instruction
start without essential operational context.

## Behavior

- The first connection read starts only when the assistant opens; page load alone
  performs no account discovery. A named refresh control repeats the bounded check.
- One exact authorized match shows public ID, account name, container name, and
  read-only, edit, or publication capability.
- Local-service offline, OAuth unconfigured, Google disconnected, no page container,
  inaccessible ID, duplicate API match, and multiple page IDs remain distinct.
- The service worker accepts only bounded GTM IDs and uses two fixed loopback endpoints.
  It strips unexpected status fields and never forwards raw failure bodies.
- Account/container names pass strict runtime decoding and render as inert text.
- Browser cookies and Google web-login state are not inspected. No profile/email scope,
  credential, token, raw API error, GTM write, workspace preparation, or publication is
  introduced.
- Existing post-specification access checks and managed-workspace actions remain
  available and independently guarded.

## Regression coverage

- Backend recognition now asserts safe account identity alongside the exact container.
- Five new built-extension journeys cover delayed loading, exact identity, refresh,
  offline, unconfigured/disconnected, no-container, inaccessible, ambiguous, and
  multiple-container states while ensuring chat remains usable.
- Matched and offline cards have dedicated reviewed baselines. Six existing expanded
  assistant/candidate baselines were intentionally replaced to include the new card or
  its resulting layout; the collapsed orb remains unchanged.

## Verification

- Focused backend: 16 passed.
- Deterministic corpus: 264 passed across 37 files.
- New connection-context Chromium matrix: 5 passed.
- Complete Chromium suite during baseline review: 33 passed.
- `npm run verify` passed local preflight, 36 change records, every build and strict
  check, 264 deterministic tests across 37 files, and all 33 Chromium journeys.
- The exact-base documentation check and GitHub Verify remain merge gates.

## Exploratory review

[`docs/reviews/2026-08-23-pre-chat-gtm-context.md`](../docs/reviews/2026-08-23-pre-chat-gtm-context.md)
records deterministic state review and an isolated read-only live review. The live page
showed `GTM-PCJ3Q5RK`, `Premium Carpet Company Test`, `ConsentFlow Verification`, and
`READ-ONLY` before chat. Two medium findings were resolved; no blocker or high-severity
finding remains.

## Documentation

Issue 22, the accepted conversational specification, current capabilities, exploratory
review, and this change record define delayed discovery, identity/access semantics,
visible states, privacy, and authority boundaries.

## Rollback

Revert this change to remove the pre-chat card and account field from recognition.
Existing manual access checks, GTM authorization, generation, and managed-workspace
boundaries remain independently reversible.
