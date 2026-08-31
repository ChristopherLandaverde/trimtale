# Harden browser verification privacy and adversarial coverage

Status: resolved

Blocked by: 01, 02, 03

## Objective

Prove that post-publication verification persists only bounded, privacy-filtered
evidence and remains safe around attacker-shaped page content.

## Regression contract

Add tests covering:

- Form input values do not enter persisted evidence.
- Cookies, storage, OAuth tokens, and arbitrary page text do not enter persisted
  evidence or assistant messages.
- Attacker-shaped labels and URLs render as inert text.
- Duplicate and missing Google requests produce bounded next actions.
- Raw browser/network errors are not echoed into the transcript or API response.

## Notes

Use sentinel values in deterministic fixtures. This issue is a blocker before using
the workflow for client-facing proof reports.

## Resolution Notes

- Added permanent extension evidence-capture regressions in
  `apps/extension/src/evidence-capture.test.ts`.
- Coverage now proves private form values, token-shaped strings, local/session
  storage-shaped fields, hostile page URLs, raw browser/network error strings,
  attacker collection hosts, unsafe query parameters, and private page-location query
  values do not enter persisted post-publication form evidence.
- Non-Google collection URLs are dropped and produce the bounded
  `tag_fired_request_missing` verdict while platform confirmation remains
  `unverified`.
- Focused regression passed: `npm test -- apps/extension/src/evidence-capture.test.ts`.
