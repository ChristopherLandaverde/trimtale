# License the project under AGPL-3.0

Change record version: 2

Issue: none; owner decision on 2026-10-30 ahead of making the repository public.

## Summary

Added the GNU AGPL v3.0 as `LICENSE`, declared `AGPL-3.0-only` in every `package.json`, and
replaced the README's "no license" note.

## Why

The repository is about to become public. Without a license it is all rights reserved, so
nobody could use or contribute to it. AGPL keeps hosted forks open while the owner can
still offer other terms.

## Behavior

No runtime behavior changes. `package-lock.json` picks up the new `license` fields.

## Regression coverage

None needed: license metadata only.

## Verification

`npm run check:change-docs` passes; CI runs `npm run verify`.

## Exploratory review

Not applicable: no user-visible product surface changed.

## Documentation

`LICENSE`, README License section.
