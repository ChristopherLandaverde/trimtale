# Make npm preflight reliable in managed sandboxes

Status: resolved

## Objective

Keep the local readiness gate truthful when the managed execution environment allows
an npm version subprocess to exit successfully but suppresses its stdout while
reporting a sandbox error. A supported npm installation must not be classified as npm
version `0` merely because that subprocess result is incomplete.

## Regression contract

Required test level: deterministic unit/behavioral coverage under the ordinary
`npm test` gate, extending `scripts/workflow-preflight.test.ts`.

Required invariants:

- A successful npm version subprocess with non-empty stdout remains the primary
  version source.
- When subprocess stdout is empty, a valid npm version from npm's standard
  `npm_config_user_agent` lifecycle environment is accepted.
- Malformed or absent subprocess and lifecycle version evidence fails closed as
  version `0`.
- The real `npm run preflight` command reports the installed npm 10 runtime as ready
  in the managed local environment.

## Work

- Separate npm-version evidence resolution from readiness evaluation.
- Add the lifecycle-environment fallback without logging environment values.
- Add permanent positive and fail-closed regressions.
- Record the internal workflow change and full verification evidence.

## Done when

- The regression contract runs in `npm test`.
- `npm run preflight` reports the actual supported runtime as ready locally.
- `npm run verify` passes.

## Comments

- 2026-08-23: Claimed after the pre-workflow audit reproduced a false `npm 10+`
  failure with npm `10.9.8`; the sandboxed child result had empty stdout despite a
  zero status and an `EPERM` error condition.
- 2026-08-23: Added subprocess-precedence, lifecycle-fallback, and malformed-evidence
  regressions in `scripts/workflow-preflight.test.ts`. The real agent preflight now
  reports `READY`; `npm run verify` passed 202 deterministic tests across 29 files and
  all 25 Chromium workflows.
