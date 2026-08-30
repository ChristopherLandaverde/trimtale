# Add the disposable workflow smoke form

Change record version: 2

Issue: `.scratch/workflow-automation/issues/10-disposable-workflow-smoke-form.md`

## Summary

Track the disposable verification target in the main workspace and add its real form
success interaction to the ordinary build, test, and Chromium harness.

## Why

The published disposable GTM operation needs evidence from a real successful form
outcome before it can honestly advance from `published` to `completed`.

## Behavior

The verification page now exposes `#workflow-smoke-form`, reveals a success message
only after native form validation succeeds, and pushes one metadata-only
`gtm_observability_smoke_success` event. Local and CI execution use a test container and
do not contact GTM or GA4. Deployment and live evidence remain separately
approval-gated and are out of scope for this code change.

## Regression coverage

Deterministic render tests protect the container installation, required form, event
metadata, privacy boundary, and container-ID validation. A local Chromium journey
protects invalid and successful submissions and confirms that entered email values do
not enter the event payload.

## Verification

- `npx vitest run apps/verification-target/src/render.test.ts`: 3 tests passed.
- `npm run build --workspace @gtm-observability/verification-target`: passed.
- `npm run typecheck --workspace @gtm-observability/verification-target`: passed.
- `npx playwright test tests/e2e/verification-target.spec.ts`: 1 Chromium test passed.
- `npm run verify`: passed with 205 deterministic tests across 30 files and all 26
  Chromium workflows.

## Exploratory review

Reviewed empty, adversarial-invalid, and successful submissions in Chromium. The form
emitted one metadata-only signal on success and no signal for invalid input. See
`docs/reviews/2026-08-23-disposable-workflow-smoke-form.md`.

## Documentation

Added the exploratory review and updated the tracked workflow issue. Existing live
operation documentation remains accurate until the separate deployment and evidence
steps are complete.
