# Security review findings (external pass, 2026-08-22)

Status: open

## Problem

An external code review of the current tree (not tied to any single in-flight
feature) found two concrete defects that fall under `docs/engineering/delivery-harness.md`'s
"Privacy and security regressions" tier but have no regression coverage today.
Filed as independent tickets so either can be claimed and landed without waiting
on the other.

## User outcome

Both findings are fixed with permanent regression coverage under the ordinary
`npm test` gate, per the existing delivery harness contract.

## Acceptance criteria

- [x] `.scratch/security-review-findings/issues/01-api-cors-wildcard-default.md` resolved.
- [x] `.scratch/security-review-findings/issues/02-content-script-innerhtml-xss.md` resolved.
- [ ] `.scratch/security-review-findings/issues/03-harness-missing-boundary-and-adversarial-tiers.md` resolved.

## Out of scope

- General security audit of the rest of the codebase — this covers only the
  findings below.
