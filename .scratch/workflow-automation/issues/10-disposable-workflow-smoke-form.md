# Add the disposable workflow smoke form

Status: claimed

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
- The disposable page is deployed with container `GTM-PCJ3Q5RK`.
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
