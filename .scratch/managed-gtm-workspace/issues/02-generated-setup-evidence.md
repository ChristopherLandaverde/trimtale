# Generate a reviewable setup before workspace preparation

Status: resolved

## Outcome

A confirmed navigation or lead-form tracking specification produces a real downloadable GTM setup and marks setup generation as passed before the managed workspace is prepared.

## Acceptance criteria

- [x] Navigation confirmation generates a `navigation_click` container file and exposes a real download.
- [x] Lead-form confirmation reports its existing `generate_lead` setup as generated.
- [x] Missing measurement or container context remains pending and cannot claim generation.
- [x] Generated guidance reuses the recognized managed workspace and no longer instructs creation of a new workspace per setup.
- [x] Evidence keeps generation, GTM runtime, GTM access, browser verification, and platform confirmation separate.
- [x] Chromium protects the visible generated state and downloaded navigation artifact.
- [x] `npm run verify` passes.

## Comments

- 2026-08-22: Claimed after the live demo correctly showed workspace preparation but left setup generation pending because the navigation conversation had no generation bridge.
- 2026-08-22: Resolved with real navigation and form generation evidence, a parsed navigation download, a missing-measurement safeguard, managed-workspace guidance, and reviewed visual baselines. `npm run verify` passed with 114 deterministic tests and 25 Chromium workflows.
