# Review a lead-form operation plan

Change record version: 2

Issue: `.scratch/conversational-tracking-specs/issues/25-review-form-operation-plan.md`

## Summary

The workbench can explicitly prepare a connected lead-form workspace and show its
durable GTM change plan. Planning cannot apply or publish changes.

## Why

Practitioners need to move a confirmed `generate_lead` setup toward GTM from the same
workbench without crossing the application boundary.

## Behavior

- Connected edit access exposes `Prepare workspace & plan` after setup approval.
- The extension sends the confirmed specification and exact connected context to the
  existing planning route.
- Only bounded action names and states return to the page.
- Invalid, conflicting, and unavailable plans fail closed and state that nothing was
  applied or published.
- Application, versioning, publication, rollback, navigation, and model behavior are
  unchanged.

## Regression coverage

`tests/e2e/conversational-form.spec.ts` proves a valid plan is reviewable without a
resume request. It also proves a forbidden action and markup-shaped label fail closed
without DOM injection.

## Verification

`npm run verify` passed local preflight, 40 change records, strict checks and builds,
307 deterministic tests across 44 files, and all 39 Chromium journeys.

## Exploratory review

[`docs/reviews/2026-08-23-form-operation-plan.md`](../docs/reviews/2026-08-23-form-operation-plan.md)
records the valid and adversarial planning paths. No blocker or high-severity finding
remains.

## Documentation

The accepted conversational specification, current-capabilities inventory, issue 25,
exploratory report, and this change record define the exposed planning boundary.
