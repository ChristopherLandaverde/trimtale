# Batch Dependabot updates #51–#53

Change record version: 2

Issue: none (dependency maintenance)

## Summary

Take Dependabot's #53 manifest and lockfile (vitest and @vitest/mocker 3.2.7 → 5.0.5). Its resolution also includes source-map-js 1.2.2 (#51) and moves the transitive vite from 7.3.6 to 8.3.5, which supersedes #52's 7.3.7.

## Why

This clears the three open Dependabot PRs in one coherent lockfile. The individual PRs failed CI only because they had no change record.

## Behavior

There is no product change. vite is used only by vitest, and the extension, API and fixture builds use the root `esbuild@0.25.12`, which is unchanged.

Known wart: vite 8 declares an optional peer `esbuild@^0.27 || ^0.28`, so `npm ls` reports the root esbuild 0.25.12 as an invalid optional peer. vite 8 does not use esbuild for vitest's transforms, `npm ci` succeeds, and all tests pass. Bumping esbuild was left out of scope.

## Regression coverage

No test changes.

## Verification

- `npm ci`: OK.
- `npm run check`: exit 0.
- `npx vitest run` on vitest 5.0.5: 263/264. The one failure is the known `agent-harness.test.ts` assertion that the checkout directory is named `gtm-observability`, and the worktree has a different name.
- `npm run build`: exit 0.
- `npx playwright test`: 36/36 on macOS.
- The PR's `Verify` workflow covers Linux.

## Exploratory review

Not applicable. This is a dev-dependency update with no user-visible surface.

## Documentation

None.
