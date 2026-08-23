# Resumable tracking-setup automation

Status: accepted

## Problem

The deterministic product and delivery harness are reliable, but progress can still
pause on repeated local readiness checks, duplicate CI runs, missing integration
configuration, ambiguous GTM entity comparisons, interrupted writes, and approval
that is not bound to an exact version.

## User outcome

A tracking practitioner can move from a confirmed tracking specification through a
reviewable tracking change plan, idempotent managed-workspace application, validation,
version review, explicit publication approval, publication, and post-publication
evidence. An interrupted operation resumes from verified Google and browser state
without duplicating entities or broadening approval.

## Workflow

```text
local readiness
  -> confirmed tracking specification
  -> generated tracking setup
  -> recognized container and managed workspace
  -> tracking change plan
  -> idempotent application
  -> workspace validation
  -> immutable version fingerprint
  -> publication approval for that fingerprint
  -> publication
  -> post-publication browser and platform evidence
  -> retain the prior live version as rollback evidence
```

## Safety invariants

- Local and deterministic verification never require Google credentials.
- Credential readiness reports configuration presence and validity, never values.
- A tracking change plan is read-only and deterministic for equivalent inputs.
- Only the marked managed workspace may receive automated entity changes.
- Every write re-reads container and workspace state and is safe to repeat.
- Unknown equivalence, ownership, capacity, synchronization, validation, or fingerprint
  state stops mutation with an explicit result.
- Publication approval applies to one exact immutable version fingerprint and expires
  when that fingerprint or the live container changes.
- Production publication is never part of ordinary CI and never follows from a broad
  command authorization.
- Post-publication failure produces rollback guidance and evidence; it does not hide or
  silently reinterpret the failed result.

## Acceptance criteria

- [x] One local preflight checks repository, runtime, dependency, and browser readiness.
- [x] One separate credential-safe preflight checks Google integration configuration.
- [x] Pull requests run one current verification job; merged `main` is verified again.
- [ ] Tracking change plans classify create, reuse, no-op, and conflict behavior.
- [ ] A durable operation record can resume after interruption from freshly read state.
- [ ] Managed-workspace application is idempotent and ownership constrained.
- [ ] Workspace validation produces reviewable compiler and change evidence.
- [ ] Version creation records an immutable fingerprint and prior live version.
- [ ] Publication requires approval bound to that fingerprint.
- [ ] Post-publication verification and rollback evidence complete the operation.

## Out of scope

- Removing explicit production publication approval.
- Automatically resolving human-owned GTM entity or workspace conflicts.
- Treating browser evidence as platform confirmation.
- Running credentialed Google writes in ordinary pull-request CI.
