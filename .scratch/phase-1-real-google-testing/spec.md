# Phase 1 Real Google Testing Plan

Status: proposed

## Objective

Define the credential-gated testing lane that follows the completed local Phase 1
workflow and refactor scope. The goal is to prove the product can safely run against
disposable Google Tag Manager resources without weakening the existing boundary:
browser-observed Google collection requests are evidence, but they are not platform
confirmation.

## Current Baseline

The local deterministic product loop is complete and verified:

```text
confirm tracking intent
  -> generate setup
  -> recognize GTM access
  -> prepare managed workspace
  -> apply owned entities
  -> validate workspace
  -> create immutable version
  -> approve exact fingerprint
  -> publish
  -> browser verification
  -> rollback if verification fails
```

The extension and local E2E already confirm the browser side of the Google boundary:
the assistant can observe a network request shaped like the expected Google collection
hit and advance the durable operation from `published` to `completed`. This confirms
browser delivery behavior only. It does not confirm GA4 processing, reporting,
attribution, Ads conversion receipt, or any other destination-side result.

## Testing Lanes

### Lane 0: Local Regression Gate

Purpose: protect the accepted product loop without credentials.

Commands:

- `npm run preflight`
- `npm run check:change-docs`
- `npm run check`
- `npm test`
- `npm run test:e2e`
- `npm run verify`

Pass condition:

- All local checks pass.
- The assistant still separates browser verification from platform confirmation.
- Publication and rollback remain approval-gated in visible assistant workflows.

### Lane 1: Credential Readiness

Purpose: prove the developer machine can run the real Google lane without printing or
committing secrets.

Commands:

- `npm run preflight:google`
- `npm run preflight:publication`

Pass condition:

- Required OAuth and publication settings are present.
- Publication execution remains disabled unless explicitly enabled for the approved
  disposable session.
- No command output contains OAuth client secrets, refresh tokens, access tokens, or
  raw credential payloads.

### Lane 2: Disposable Container Dry Run

Purpose: exercise real discovery, recognition, managed workspace capacity, planning,
application, validation, and immutable version creation against a disposable GTM
container while stopping before publication.

Pass condition:

- The observed public container is uniquely recognized.
- The managed workspace is created or reused without editing human-owned workspaces.
- The operation reaches `versioned`.
- The operation records the immutable version fingerprint and prior live version
  fingerprint.
- Nothing is published.

### Lane 3: Approved Disposable Publication Smoke

Purpose: publish one exact disposable version after explicit fingerprint approval,
then prove the browser can observe the expected Google collection request.

Pass condition:

- Approval names the exact immutable version fingerprint displayed by the assistant.
- Publication succeeds only with `GOOGLE_GTM_PUBLICATION_ENABLED=true`.
- Browser verification records one expected Google collection request.
- The durable operation reaches `completed`.
- The UI says `Platform confirmation unavailable`.
- No logs, persisted evidence, or assistant messages contain private form values,
  cookies, OAuth credentials, or arbitrary page-controlled markup.

### Lane 4: Rollback Drill

Purpose: prove a failed disposable publication can restore the exact prior live
version fingerprint after explicit rollback approval.

Pass condition:

- A controlled failed browser verification moves the operation to `rollback_required`.
- The assistant displays the recorded prior live fingerprint.
- Rollback runs only after approving that exact target fingerprint.
- The operation reaches `rolled_back`.
- No autonomous rollback occurs.

### Lane 5: Platform Confirmation Research Gate

Purpose: decide whether the product should ever claim destination-side confirmation.

This lane cannot be marked implemented by browser network evidence. It requires a
separate product and technical decision for a destination-side signal such as GA4
DebugView, Data API reporting, BigQuery export, Google Ads conversion diagnostics, or
another platform-owned receipt.

Pass condition:

- A specific platform evidence source is selected.
- Its latency, permissions, quota, privacy, and failure modes are documented.
- The UI language distinguishes `browser_verified` from any platform-specific
  confirmation.
- No Phase 1 workflow depends on this lane.

## Safety Invariants

- Real Google writes never run in ordinary `npm run verify`.
- Disposable testing must use disposable GTM containers and disposable site fixtures.
- Publication and rollback require exact fingerprint approval.
- A broad git, shell, or agent authorization is not publication approval.
- Browser evidence can complete the Phase 1 product loop, but it cannot become
  platform confirmation.
- Secrets stay in local environment variables or owner-only token stores; they are
  never committed, logged, or copied into scratch specs.
- Any failed real-Google write stops with bounded recovery guidance and a retained
  prior live fingerprint.

## Acceptance Criteria

- [x] Lane 1 has a documented, repeatable credential-readiness checklist.
- [ ] Lane 2 has a disposable dry-run procedure that stops at immutable version
      creation.
- [ ] Lane 3 has an approved publication smoke procedure with browser verification
      evidence and no platform-confirmation claim.
- [ ] Lane 4 has a rollback drill using the recorded prior live fingerprint.
- [ ] Lane 5 has a product decision record before any destination-side confirmation
      language is implemented.

## Out of Scope

- Running real Google writes in CI.
- Using production customer containers.
- Treating extension/network evidence as GA4 or Ads platform receipt.
- Adding a new destination-side confirmation integration in this planning slice.
