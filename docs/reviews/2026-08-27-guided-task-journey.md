# Guided task journey review

Date: 2026-08-27

## Environment

- Built production extension in Chromium.
- Deterministic local API, lead-form fixture, and verification target.
- Compact 348-pixel website-agent surface and reload across the two exact local
  origins.

## Scenarios

1. Opened the compact home, expanded healthy connection detail, selected the form
   starter, reviewed the exact plan, opened task details, reloaded, and continued from
   the Apply boundary.
2. Queued a second request behind pending intake, then stopped the first response and
   inspected the resulting queue, focus, and task state.
3. Exercised unavailable service, wrong-organization, and exact-origin resume-mismatch
   states without bypassing the visible website-agent controls.
4. Rendered markup-bearing container and target labels, then inspected the page and
   website agent for execution, disclosure, overlap, and stale controls.

## Observations

- The compact home exposes three starters and one visible six-stage journey.
- Healthy GTM context is one line until expanded; the toggle stays within its card and
  retains focus after expansion.
- The exact plan remains visible before application while full plans, receipts,
  bindings, and evidence remain available in the task-details drawer.
- Reload restores one exact-origin Continue setup card without showing competing
  starters or applying the plan. The other local origin offers no continuation.
- A queued prompt becomes an ordinary user turn when dispatched. Stop ends only the
  pending response, removes its stale queue chip, and advances the queued request.
- Markup-bearing names remain inert text. Stored continuation data excludes prompts,
  private values, cookies, credentials, identity, and arbitrary labels.
- Application, publication, and rollback remain three separate exact approvals.

## Findings

- Medium, resolved: the connection-detail toggle initially overlaid task content.
  Card-relative positioning and the expanded-context screenshot now protect it.
- Medium, resolved: a dispatched queue chip remained visible and Stop stranded the
  queued request. Two Chromium regressions now protect both transitions.
- Medium, resolved: the reload card competed with fresh-start suggestions. The resume
  state now hides those starters and has a reviewed screenshot baseline.
- No unresolved blocker, high-, medium-, or low-severity finding.

## Evidence

- `tests/e2e/guided-task-journey.spec.ts`: compact home, safe queue and Stop, artifact
  drawer, exact-origin privacy-filtered reload, and no accidental application.
- `tests/e2e/guided-task-journey.spec.ts-snapshots/guided-artifact-drawer-linux.png`.
- `tests/e2e/guided-task-journey.spec.ts-snapshots/guided-resume-card-linux.png`.
- Reviewed compact connection, sign-in, verification, navigation, and adversarial
  Chromium baselines in their existing E2E suites.
- Base-aware documentation check: 98 records valid.
- `npm run verify`: 463 deterministic tests and 86 Chromium journeys passed.
