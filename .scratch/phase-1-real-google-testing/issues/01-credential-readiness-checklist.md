# Document credential readiness checklist

Status: proposed

## Problem

The real Google lane needs a repeatable setup checklist that proves readiness without
printing, committing, or over-broadly authorizing credentials.

## Regression Contract

- Document required environment variables, token-store expectations, and preflight
  commands.
- Confirm the checklist keeps publication execution separate from publication OAuth
  consent.
- Run documentation validation before resolving.

## Acceptance Criteria

- [ ] Checklist names `npm run preflight:google` and `npm run preflight:publication`.
- [ ] Checklist states which flags are required for read, write, and publication
      sessions.
- [ ] Checklist says secrets must not be pasted into issues, specs, logs, or commits.
