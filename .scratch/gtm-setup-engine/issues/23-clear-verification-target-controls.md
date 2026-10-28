# Keep verification targets clear of agent controls

Delivery mode: implementation
Status: resolved

## Problem

On a narrow Tag Assistant target viewport, the expanded website agent and sticky site
header can overlap a confirmed form control. The agent can be collapsed, but the
verification guidance does not tell the practitioner to clear the target before the
interaction.

## Proposed outcome

Starting a browser run leaves the confirmed interaction target operable at supported
viewport sizes without hiding the evidence state or changing the confirmed target.

## Non-goals

- Automatically submitting a form.
- Reading or moving private form values.
- Changing GTM trigger visibility thresholds.
- Widening the exact-preview or publication boundary.

## Authorization

The user authorized continuing the agreed product-slice sequence on 2026-08-27. This
slice is limited to keeping the confirmed target operable while retaining a visible
verification state.

## Evidence

The 2026-08-26 real Preview review placed the success element at `y=756` in a
`751`-pixel viewport after an intercepted submit attempt. Centering the confirmed form
before activation produced `gtm.elementVisibility` and one `generate_lead` request.

## Regression contract

`tests/e2e/conversational-form.spec.ts` exercises a confirmed form behind a sticky
header in a narrow viewport, uses ordinary pointer interaction, and proves the target
remains operable while the active state stays visible and private form values remain
outside extension evidence.

## Comments

- 2026-08-26: Recorded as a medium follow-up. It does not invalidate the durable
  resume or request-classification outcomes.
- 2026-08-27: The failing-first narrow-viewport journey placed the confirmed form
  behind a sticky header and the expanded agent. Starting verification now centers
  that form and exposes a 166-by-50 `Verification active` dock. An ordinary pointer
  submission completed exact versioning, and the private sentinel remained outside
  durable evidence. `npm run verify` passed 421 deterministic tests and 74 Chromium
  journeys; exploratory review found no unresolved finding.
