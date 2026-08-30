# Assistant approval-gated publish exploratory review

Date: 2026-08-30

Build: `codex/resume-blocked-workflow` working tree after approval-gated publish
implementation.

Environment: Playwright Chromium 1234, unpacked extension from `apps/extension/dist`,
local fixture at `http://127.0.0.1:14173/`, local API at
`http://127.0.0.1:18787/`, verification target at `http://127.0.0.1:4175/`,
and deterministic intercepted Google/workflow responses. No real Google credentials
or GTM workspace were used.

## Scenarios exercised

### Exact fingerprint publication

1. Confirmed a navigation-click setup on the fixture page.
2. Started `Prepare GTM version` and reached immutable version `version-8`.
3. Selected `Publish version-8`.

Observed: the assistant called the publish route once, rendered approved fingerprint
`version-8`, rendered published version `version-8`, removed the publish action, and
kept browser verification and platform confirmation pending.

### Backend approval guard

The workflow runner test publishes only after exact fingerprint approval. A wrong
fingerprint returns an approval block before any Google publish call. A second publish
attempt after the operation is already published also blocks before a second Google
publish call.

### Existing negative and adversarial states

The missing-measurement path still withholds setup and operation actions. The
validation-blocked path still withholds immutable version evidence. Page-controlled
target labels still render as inert text.

## Visual review

The published operation card keeps publication, browser verification, and platform
confirmation as separate rows. The card remains readable in the assistant panel and
does not overlap the composer.

## Findings

No blocker or high-severity findings remain for approval-gated publication.

Post-publication browser verification, platform receipt confirmation, and rollback
approval remain follow-on workflow slices.

## Review result

Result: passed for exact fingerprint approval-gated publication.
