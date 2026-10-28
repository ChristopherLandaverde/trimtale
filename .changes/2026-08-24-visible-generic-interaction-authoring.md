# Author generic interactions in the website agent

Change record version: 2

Issue: `.scratch/gtm-setup-engine/issues/10-visible-generic-interaction-authoring.md`

## Summary

Add a visible, privacy-safe generic interaction workflow to chat and allow its
confirmed setup to enter the durable GTM managed-workspace planner.

## Why

Stage 1 must shorten ordinary tagging work without creating a new generator or
workflow implementation for every event.

## Behavior

On a page with a phone link, the practitioner can request phone-call tracking, choose
sitewide or page-only firing, review automatic and excluded parameters, approve the
setup, download it, and—when container writes are enabled—review the managed-workspace
change plan. The event records call intent only. Phone numbers, `tel:` URLs, and
visible phone-link text are excluded from GA4 parameters.

## Regression coverage

Core tests cover reusable scope intake, deterministic setup construction, privacy,
compilation, and durable planning. A Chromium journey covers the user-visible review
and asserts that neither the generated artifact nor workflow request contains the
fixture phone number.

## Verification

`npm run verify` passes 375 unit tests and 52 Playwright Chromium journeys, including
the connected privacy-safe interaction workflow.

## Exploratory review

Chromium review confirmed the interaction count, scope question, consent and privacy
copy, explicit approval, downloadable artifact, and four-action change plan. The
assistant remained usable when no phone-link evidence existed.

## Documentation

The Stage 1 progress record now distinguishes this implemented visible path from the
remaining Tag Assistant, authenticated publication, Custom HTML vendor, and portal
work.
