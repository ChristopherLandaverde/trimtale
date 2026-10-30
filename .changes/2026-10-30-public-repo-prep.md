# Public repository preparation

Change record version: 2

Issue: none; tracked in the owner's portfolio plan as the make-Trimtale-public checklist.

## Summary

Replaced the real IDs of the disposable test GTM container, its account and GA4 property in
docs and notes with placeholders, and added a security policy, a contributing guide and
issue templates ahead of making the repository public.

## Why

The repository is about to become public. Readers need a private route for vulnerability
reports and a clear path to contribute, and the docs shouldn't carry real account and
container identifiers.

## Behavior

- The disposable test container's public ID, its account and container numbers, its GA4
  measurement ID and the account display name are replaced with placeholders in 10 docs and notes files. The
  evidence they describe is unchanged.
- Added `SECURITY.md`, `CONTRIBUTING.md` and `.github/ISSUE_TEMPLATE/`.
- Rewrote the stale Google, permissions and publishing sections of
  `docs/security-and-publishing.md` to match the current routes, environment gates and manifest.
- No code, tests or build output changed. No license is added; the owner chooses it.
- Git history still contains the original IDs; whether to keep or replace history is the
  owner's decision before the repository goes public.

## Regression coverage

None needed: documentation and repository metadata only.

## Verification

`npm run check:change-docs` passes. `git grep` finds none of the redacted IDs.

## Exploratory review

Not applicable: no user-visible product surface changed.

## Documentation

`SECURITY.md`, `CONTRIBUTING.md`, issue templates, and redactions in `docs/`, `.changes/`
and `.scratch/`.
