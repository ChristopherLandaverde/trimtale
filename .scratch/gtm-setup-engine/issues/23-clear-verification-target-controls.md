# Keep verification targets clear of agent controls

Delivery mode: specification
Status: open

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

## Evidence

The 2026-08-26 real Preview review placed the success element at `y=756` in a
`751`-pixel viewport after an intercepted submit attempt. Centering the confirmed form
before activation produced `gtm.elementVisibility` and one `generate_lead` request.

## Regression contract

A built-extension journey should exercise a confirmed form in the narrow supported
viewport, use ordinary pointer interaction, and prove the target remains operable
while private form values remain outside extension evidence.

## Comments

- 2026-08-26: Recorded as a medium follow-up. It does not invalidate the durable
  resume or request-classification outcomes.
