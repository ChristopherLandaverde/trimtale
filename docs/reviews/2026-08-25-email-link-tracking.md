# Email-link tracking review

Date: 2026-08-25

Build: current working tree.

Target: deterministic local contact page with the built production extension and a
controlled exact GTM/GA4 context.

## Scenarios

1. Requested email-link tracking on a page with one `mailto:` link, selected
   current-page scope, reviewed the setup, approved generation, and prepared the
   managed-workspace plan.
2. Requested the same tracking on a page with no observable `mailto:` link.
3. Used an address, subject, body, and visible link text containing private and
   instruction-shaped sentinel values.

## Evidence

- Page inspection reported one email link without showing its address or visible text.
- Review exposed `email_click`, current-page scope, analytics consent, automatically
  collected page context, and every excluded value class before approval.
- The generated artifact and managed-workspace request contained no address, `mailto:`
  destination, subject/body sentinel, or visible link text.
- The no-evidence path rendered a blocked task and exposed no scope, review, approval,
  preparation, or download action.
- Attacker-shaped markup rendered as inert page text and did not enter assistant state.

## Findings

- No blocker or high-severity finding remains.
- Medium: response-list autoscroll can initially place the heading of a long review
  above the compact overlay viewport. The card remains scrollable and the privacy rows
  and exact approval remain visible. Follow-up is recorded in
  `.scratch/conversational-tracking-specs/issues/36-long-review-scroll-context.md` and
  deferred with UI-polish work.
- Final `npm run verify` passed 404 deterministic tests and all 60 Chromium journeys.
