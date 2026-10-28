# Security review findings (external pass, 2026-08-22)

Status: in progress

## Problem

An external code review of the current tree (not tied to any single in-flight
feature) found two concrete defects that fall under `docs/engineering/delivery-harness.md`'s
"Privacy and security regressions" tier but have no regression coverage today.
Filed as independent tickets so either can be claimed and landed without waiting
on the other.

A follow-up external review pass on 2026-08-26 found one further concrete
defect (issue 04, a duplicated-data drift risk rather than an exploitable
bug) and filed it in this same directory rather than opening a new spec, since
it is the same kind of independent, not-feature-tied finding.

## User outcome

Every finding below is fixed with permanent regression coverage under the
ordinary `npm test` gate, per the existing delivery harness contract.

## Acceptance criteria

- [x] `.scratch/security-review-findings/issues/01-api-cors-wildcard-default.md` resolved.
- [x] `.scratch/security-review-findings/issues/02-content-script-innerhtml-xss.md` resolved.
- [x] `.scratch/security-review-findings/issues/03-harness-missing-boundary-and-adversarial-tiers.md` resolved.
- [ ] `.scratch/security-review-findings/issues/04-duplicated-gtm-rest-alias-tables.md` resolved.

## Out of scope

- General security audit of the rest of the codebase — this covers only the
  findings below.
