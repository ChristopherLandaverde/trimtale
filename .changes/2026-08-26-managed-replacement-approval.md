# Add exact managed replacement approval

Change record version: 2

Issue: `.scratch/gtm-setup-engine/issues/17-explicit-managed-replacement.md`

## Summary

Add an exact, durable approval transition for replacing a same-name product-owned GTM
entity whose semantics differ from the generated setup.

## Why

The authorized Stage 1 setup found an older product-owned tag with the intended name.
Silent replacement was correctly blocked, but the workflow had no bounded way to
review and approve that exact managed change.

## Behavior

The planner exposes normalized current/proposed semantics and the current Google
fingerprint for reviewable managed conflicts. Approval binds the operation, source and
approved plan fingerprints, entity kind, entity signature, entity ID, and current
fingerprint. The Google adapter fresh-reads those bindings and ownership before a
conditional update. Approval makes only the ordinary application review available;
validation, exact preview, version, publication approval, and live verification remain
unchanged. Human-owned replacement, deletion, general collision resolution, GA4
writes, and broad mutation approval remain out of scope.

## Regression coverage

`packages/core/src/change-plan.test.ts` covers exact semantic review data.
`packages/core/src/tracking-operation.test.ts` covers durable entity and fingerprint
binding. `apps/api/src/workflow-runner.test.ts` covers no provider call before exact
approval and rejects mismatches. `apps/api/src/google-application.test.ts` covers the
fresh product-owned update and stale-fingerprint rejection.
`tests/e2e/conversational-form.spec.ts` covers visible review, inert attacker-shaped
semantics, exact approval payload, and the unchanged second application confirmation.

## Verification

`npm run verify` passed preflight, 84 change records, all workspace typechecks, 417
deterministic tests across 51 files, all builds, and 70 Chromium journeys.

## Exploratory review

See `docs/reviews/2026-08-26-managed-replacement-approval.md`. Headed Chromium covered
the pre-approval block, exact semantic review, approval transition, ordinary apply
confirmation, and markup-bearing semantics. The receipt-order finding was fixed. No
unresolved finding remains.

## Documentation

Updated the active issue, setup-engine approval contract, this change record, and the
headed exploratory review.
