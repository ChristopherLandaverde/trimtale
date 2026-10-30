# Refresh stale Linux managed-workspace baseline

Change record version: 2

Issue: `.scratch/assistant-setup-operation/issues/02-operation-timeline-ui.md`

## Summary

Replace `tests/e2e/navigation-extension.spec.ts-snapshots/assistant-managed-workspace-linux.png` with the screenshot the GitHub Actions Linux runner renders for the current assistant UI.

## Why

Commit `c340e21` intentionally added the "Prepare GTM version" action to the managed-workspace timeline and refreshed only the darwin baselines. The Linux baseline still showed the pre-`c340e21` UI without that button, so the `Verify` workflow on `main` has failed since 2026-08-30 (run 33335140984: 8864 differing pixels, ratio 0.06, on both the first attempt and the retry).

## Behavior

No product behavior changes. Only one Linux visual baseline is replaced. Thresholds, retries and test code are unchanged.

## Regression coverage

The replacement image is the `assistant-managed-workspace-actual.png` that CI captured in run 33335140984. The first attempt and the retry produced byte-identical images (sha1 `ff99d6c7…`), so the render is deterministic on the runner. Its layout matches the reviewed `assistant-managed-workspace-darwin.png` from `c340e21`. The image was not regenerated in the `mcr.microsoft.com/playwright:v1.62.1-noble` container because that image renders differently from `ubuntu-latest`: three Linux baselines that pass on CI fail there, with font-metric and scroll offsets.

## Verification

- `npm run check`: exit 0.
- `npx vitest run`: 263/264 locally. The one failure is `scripts/agent-harness.test.ts`, which asserts that the checkout directory is named `gtm-observability`, and this worktree has a different name. All 264 pass under the correct directory name.
- The PR's `Verify` workflow is the authoritative Linux check for this baseline.

## Exploratory review

Not applicable. There is no product or UI change. The baseline catches up with UI that was already reviewed in `docs/reviews/2026-08-30-assistant-setup-operation.md`.

## Documentation

None.
