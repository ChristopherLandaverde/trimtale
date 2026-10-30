# Batch Dependabot updates #51–#53

Change record version: 2

Issue: none (dependency maintenance)

## Summary

Apply all three Dependabot updates in one lockfile:
- vitest and @vitest/mocker 3.2.7 → 5.0.5 (#53)
- vite 7.3.6 → 7.3.7 (#52), now a direct devDependency `^7.3.7`
- source-map-js 1.2.1 → 1.2.2 (#51)

## Why

This clears the three open Dependabot PRs in one coherent lockfile. The individual PRs failed CI only because they had no change record.

## Behavior

There is no product change. vite is used only by vitest, and the extension, API and fixture builds use the root `esbuild@0.25.12`, which is unchanged.

vite is pinned to 7.x on purpose. Dependabot's #53 lockfile let vitest 5 pull vite 8.3.5. vite 8 declares an optional peer `esbuild@^0.27 || ^0.28`, which conflicts with the root `esbuild@^0.25` that the product builds use. npm 10's `npm ci` on CI rejects that with ERESOLVE, which is why #53 failed in seconds. Declaring `vite@^7.3.7` keeps the tree valid (`npm ls` exits 0). Moving to vite 8 requires bumping esbuild first, which is a separate decision.

## Regression coverage

No test changes.

## Verification

- `npm ls`: exit 0. `npx npm@10 ci`, the npm major used on CI: OK.
- `npm run check`: exit 0.
- `npx vitest run` on vitest 5.0.5: 263/264. The one failure is the known `agent-harness.test.ts` assertion that the checkout directory is named `gtm-observability`, and the worktree has a different name.
- `npm run build`: exit 0.
- `npx playwright test`: 36/36 on macOS.
- The PR's `Verify` workflow covers Linux.

## Exploratory review

Not applicable. This is a dev-dependency update with no user-visible surface.

## Documentation

None.
