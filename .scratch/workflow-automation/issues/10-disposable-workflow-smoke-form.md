# Add the disposable workflow smoke form

Status: resolved

## Objective

Close the missing-interaction boundary in the published disposable GTM exercise with a
real `#workflow-smoke-form` that produces the already configured success event only
after a valid form outcome.

## Regression contract

Required test levels:

- Deterministic render and safety tests under `npm test` in
  `apps/verification-target/src/render.test.ts`.
- A real local Chromium journey under `npm run test:e2e` in
  `tests/e2e/verification-target.spec.ts`.

Required invariants:

- The tracked verification-target workspace renders the exact
  `#workflow-smoke-form` and an initially hidden success element.
- An invalid submission shows no success outcome and pushes no
  `gtm_observability_smoke_success` event.
- One valid submission reveals the success outcome and pushes exactly one event with
  `form_id` and `form_name`, without including entered form values.
- The page retains its validated GTM container installation and remains buildable in
  the ordinary repository gate.
- Deployment and real Google evidence remain separately approval-gated; local CI never
  contacts GTM or GA4.

## Work

- Bring the previously deployed verification-target source into the current main
  workspace and ordinary build/typecheck/test harness.
- Replace the signal-only demo action with the real disposable form and success state.
- Add the local static-server and Chromium journey needed for credential-free coverage.
- After the code PR merges, deploy only to the linked disposable Vercel target and
  perform the separately gated live evidence operation.

## Done when

- The deterministic and Chromium regression contracts pass in `npm run verify`.
- The disposable page is deployed with container `GTM-XXXXXXX`.
- A real valid submission produces one normalized `browser_verified` run with platform
  confirmation still `unverified`.
- The published operation advances to `completed` only from that passing evidence.

## Comments

- 2026-08-23: Claimed after PR #34 closed the visual reliability carryover. Historical
  source exists on unmerged branch `feature/google-gtm-integration` at commit `cb2238b`;
  generated local artifacts and the Vercel link remain, but main has no tracked target
  workspace. This slice will restore the source deliberately instead of merging the
  old branch's unrelated integration changes.
- 2026-08-23: Added deterministic render coverage and a real local Chromium journey.
  Exploratory Chromium review passed empty, adversarial-invalid, and successful paths;
  entered email values remained outside the event payload. Deployment and credentialed
  Google evidence remain pending after the code PR.
- 2026-08-23: Full `npm run verify` passed with 205 deterministic tests across 30 files
  and all 26 Chromium workflows.
- 2026-08-23: ConsentFlow-Debugger PR #1 merged as `663d57c` after all seven hosted
  checks passed. The additive landing-page form was deployed to the approved
  `consentflow` production project as Vercel deployment
  `dpl_9AAiTgLfLjeL1yZS5G6cw7B5NAsT`; direct checks confirmed credential and Vercel
  metadata paths return `404`.
- 2026-08-23: Real Chromium run
  `run_spec_disposable_form_smoke_v3_1787493019725` observed the valid form outcome,
  one metadata-only data-layer event, and exactly one `generate_lead` request with
  `form_id`, `form_name`, and `dl=https://consentflow-psi.vercel.app/`. The normalized
  verdict was `browser_verified`, browser verification passed, and platform
  confirmation remained `unverified`. Operation
  `operation_spec_disposable_form_smoke_v3` advanced from `published` to `completed`;
  no rollback was required. Owner-only evidence is retained under `.data/run-evidence/`.
