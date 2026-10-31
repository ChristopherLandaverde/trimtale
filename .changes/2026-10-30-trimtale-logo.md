# Give Trimtale a logo and extension icons

Change record version: 2

Issue: none (README standards pass before the repository goes public)

## Summary

Added the Trimtale logo, a paper sail with two telltale ribbons on an ink rounded tile, and
wired it into the extension as its 16, 32, 48 and 128 px icons. The README hero now uses it.

## Why

The extension showed Chrome's generated letter icon in the toolbar and on
`chrome://extensions`, and the README had no mark. The name comes from sailing telltales, so
the mark shows them streaming off a sail.

## Behavior

New: the manifest declares `icons` (16/32/48/128) and `action.default_icon` (16/32); the
extension build copies `src/icons/icon-*.png` into `dist/icons/`. Unchanged: permissions,
commands, content scripts and every assistant workflow.

The 16 px icon is drawn from its own SVG on a 16 px grid (`apps/extension/src/icons/icon-16.svg`)
because the full mark's tapered ribbons blur to grey at that size. 32, 48, 128 px and the 256 px
README image come from `docs/media/logo.svg`. `node scripts/render-logo.mjs` regenerates all
PNGs with Playwright's Chromium.

## Regression coverage

`scripts/extension-icons.test.ts` checks that the manifest declares the four icon sizes and the
two toolbar sizes, that each path is a PNG of the declared square size, and that the build copies
the icons. The Playwright E2E suite loads the built extension, so a missing icon file would fail
extension load there.

## Verification

`npm run verify` (see the pull request for the run's output). The built extension was loaded in
Playwright's Chromium and `chrome://extensions` showed the new icon; `chrome.management` reported
icons at 16, 32, 48 and 128 px.

## Exploratory review

Not run as a full workflow review: only the icon changed, and no assistant flow, copy or state
changed. The icon was inspected at 16, 32, 48, 128 and 256 px on light and dark backgrounds, and
on the real `chrome://extensions` page with the unpacked build loaded.

## Documentation

README hero rebuilt to the readme-standards template (logo, stats line, badges, nav row) and a
Contributing section added; the fixture scenario count was corrected from 18 to 23.
