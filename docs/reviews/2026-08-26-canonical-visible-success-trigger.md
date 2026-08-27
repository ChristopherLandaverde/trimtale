# Canonical visible-success trigger review

Date: 2026-08-26

## Environment

- Built production extension in normal Chrome Stable.
- Authenticated local API bound to disposable GTM workspace `7`.
- Supported Tag Assistant preview for `GTM-PCJ3Q5RK` on the ConsentFlow target.
- Focused headed Chromium adversarial fixture after the full automated gate.

## Scenarios

1. Submitted the real form with the provider-accepted alias parameter set.
2. Replaced trigger `12` and dependent tag `7` with the exact reviewed canonical
   parameter set, refreshed GTM Preview, and submitted the form once.
3. Replayed the exact-preview workflow on a page with attacker-shaped target text and
   a private submitted value.

## Observations

- The alias trigger rendered as an empty ID selector in GTM. Tag Assistant observed
  the form success but kept `GA4 Event - generate_lead` under Tags Not Fired.
- The canonical trigger rendered an Element Visibility event after the success element
  became visible. Tag Assistant moved `GA4 Event - generate_lead` to Tags Fired.
- The operation bound exact draft evidence for setup `setup_c8ba6ac7eef7` and preview
  `1787793264804`, proving one matching GA4 request with no duplicate.
- Attacker-shaped text remained inert, and the private form value stayed page-owned.
  The completed assistant state exposed neither as executable markup or provider
  evidence.

## Findings

- Fixed: generated Element Visibility triggers used aliases that Google stored but its
  runtime ignored.
- Open: immutable version creation rotates the GTM quick-preview fingerprint after
  exact evidence is bound. Issue 20 owns this separate version-gate defect; nothing
  was versioned or published during this review.

## Evidence

- Failing-first canonical parameter regression, then 26 focused generator, compiler,
  and planner tests passed.
- `npm run verify`: 419 deterministic tests across 51 files and 71 Chromium journeys
  passed.
- Focused headed adversarial review: one journey passed; visual inspection confirmed
  inert attacker text, retained private page input, completed verification, and no
  publication.
- Real Tag Assistant: events `gtm_observability_smoke_success` and
  `gtm.elementVisibility`; `GA4 Event - generate_lead` under Tags Fired.
