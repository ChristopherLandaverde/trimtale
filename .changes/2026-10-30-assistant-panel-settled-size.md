# Remember only settled assistant panel sizes

Change record version: 2

Issue: `.scratch/assistant-setup-operation/issues/02-operation-timeline-ui.md` (visual-baseline stability carryover; roadmap step 0 "form-highlight snapshot flake")

## Summary

The assistant panel's `ResizeObserver` now ignores sizes observed while its width or height transition is running and records the settled size on `transitionend`. It also records the size in content-box terms, which is what `applyPreferences()` writes.

## Why

There were two latent bugs, and both made Linux screenshots nondeterministic:

1. **Open-transition race.** Opening the panel animates width from 48px to 380px over 180ms. The observer saved every intermediate width as the user's preference. Submitting a request inside that window called `applyPreferences()`, which froze the panel part-way open. Reproduced: 312px instead of 380px. On CI this showed up as the panel's left edge moving 1–5px between attempts (`form-candidate-highlights`).
2. **Border growth.** The observer stored `getBoundingClientRect()`, the border-box size, and `applyPreferences()` reapplied it as a content-box width. The panel therefore grew by its 2px border every time preferences were reapplied after a settled resize.

## Behavior

The panel now opens to, and stays at, its preferred size: 380px content plus a 1px border on each side. User drag-resizes are still remembered, after their transition settles.

## Regression coverage

- New E2E test `conversation-intake.spec.ts`, "keeps the assistant fully open when a request is sent during the open transition". It sends a request 60ms after opening and asserts `style.width` is `380px`, then sends a second request and asserts the width is still `380px`. Without the fix it fails with `312px`, and with only the race fix it fails with `382px`.
- Baselines regenerated because the panel no longer carries the extra 2px of growth (384px → 382px wide). Each diff is confined to the panel:
  - darwin: `assistant-evidence-path`, `assistant-managed-workspace`, `assistant-navigation-scope`, `form-candidate-highlights`, `form-confirmed-highlight`
  - linux: the same set, taken from the CI-rendered actuals, with the first attempt and the retry byte-identical

## Verification

- `npm run check`: exit 0.
- `npx vitest run`: 263/264 locally. The one failure is the known `agent-harness.test.ts` assertion that the checkout directory is named `gtm-observability`.
- `npm run build`: exit 0.
- `npx playwright test`: 37/37 on macOS, twice in a row.
- Linux: the PR's `Verify` workflow.

## Exploratory review

The only visible change is that the panel is 2px narrower and no longer opens part-way. I checked it visually in the regenerated screenshots, with no separate Chromium session. There are no new controls, copy or flows.

## Documentation

None.
