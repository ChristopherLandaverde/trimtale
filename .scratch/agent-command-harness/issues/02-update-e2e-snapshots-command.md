# Add a closed command for updating Playwright snapshots

Status: resolved

## Objective

`docs/engineering/delivery-harness.md`'s "UX and accessibility regressions"
section documents the one sanctioned way to intentionally update a Chromium
visual baseline:

```bash
npm run build
npx playwright test tests/e2e/navigation-extension.spec.ts --update-snapshots
npm run verify
```

That middle line is a bare `npx` invocation, which `scripts/agent-harness.mjs`
deliberately keeps out of scope (`.scratch/agent-command-harness/spec.md`,
"Out of scope": *"Dependency installation or arbitrary package execution"*).
Every time this documented, expected workflow is needed, it falls outside the
harness and re-triggers authorization — even though the invocation itself is
exactly as fixed and deterministic as the nine commands already in the
allowlist.

This ticket adds **one** new closed command for this **one** specific,
already-documented invocation. It does not open a general `npx` allowance —
the executable stays `npm`, matching every other harness entry.

## Regression contract

Required test level: deterministic unit/behavioral test under the ordinary
`npm test` gate, extending `scripts/agent-harness.test.ts`.

Required invariants:

- Positive: the new command name resolves to a fixed `npm run <script>`
  invocation (no `npx`, no bare executable other than `npm`/`git`) that runs
  `playwright test --update-snapshots` across the full E2E suite from the
  repository root.
- Safety: the new command still rejects extra arguments, same as every
  existing entry.
- The existing "keeps risky executable surfaces outside the allowlist" test
  in `agent-harness.test.ts` continues to pass with the new entry included.

## Work

- Add a fixed `package.json` script, e.g. `test:e2e:update-snapshots`, wrapping
  `npm run build && playwright test --update-snapshots` (mirroring the
  existing `test:e2e` script's shape).
- Add a corresponding `update-snapshots` entry to the `commands` map in
  `scripts/agent-harness.mjs`.
- Update the README's "Agent command harness" section and
  `docs/engineering/delivery-harness.md`'s snapshot-update instructions to
  reference `npm run agent -- update-snapshots` instead of the raw `npx` line.
- Extend `scripts/agent-harness.test.ts` per the regression contract above.
- Add a concise change record.

## Done when

- The regression contract runs in `npm test`.
- `npm run verify` passes.
- README and `docs/engineering/delivery-harness.md` no longer instruct a bare
  `npx` invocation for this workflow.

## Resolution Notes

- Added `test:e2e:update-snapshots` as a fixed npm script.
- Added `npm run agent -- update-snapshots` as the closed harness entry for reviewed
  Playwright visual-baseline updates.
- Extended `scripts/agent-harness.test.ts` to assert the exact command mapping and
  argument rejection.
- Updated README and `docs/engineering/delivery-harness.md` so the sanctioned
  snapshot workflow no longer uses a bare `npx` invocation.
