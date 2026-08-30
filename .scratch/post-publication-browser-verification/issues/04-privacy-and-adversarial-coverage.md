# Harden browser verification privacy and adversarial coverage

Status: open

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
