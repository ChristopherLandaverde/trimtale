# Preview one navigation match before confirmation

Status: resolved

## Objective

When one observed navigation group matches the tracking intent, highlight it immediately
as a reversible page-local preview. Let the practitioner confirm with `Enter`, remove
with `Escape` or a visible action, and change the selection without mutating GTM.

## Regression contract

- `packages/core/src/agent-turn.test.ts` proves a single supplied group produces
  preview-oriented Confirm, Remove, and Change actions while an ambiguous request keeps
  its group clarification.
- `tests/e2e/navigation-extension.spec.ts` proves one explicit match is highlighted as
  a candidate immediately after send, `Enter` confirms only while the composer is empty,
  and `Escape` or Remove clears the highlight and discards the local setup surface.
- The browser regression also proves preview and removal do not prepare a workspace,
  apply a GTM change, or publish.

## Done when

- A single valid candidate is visible on the page without an extra scope-picker click.
- Keyboard and visible controls expose the same confirm/remove behavior.
- Zero or multiple valid candidates still require a bounded clarification.
- Removing a preview or confirmed local selection leaves an explicit no-GTM-change receipt.

## Comments

- 2026-08-23: Added immediate candidate highlighting for one valid group, automatic
  post-response composer focus, `Enter` confirmation, `Escape` and visible removal,
  local-draft cleanup, and explicit no-GTM-change receipts. Focused Chromium coverage
  and the ordinary 37-journey gate pass. Exploratory inspection found and fixed clipped
  top-edge preview labels; the permanent page-wide baseline covers the remediation.
