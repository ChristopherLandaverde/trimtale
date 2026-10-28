# ConsentFlow unpublished-version review

Date: 2026-08-23

Build: `9681abb` on `feat/semantic-navigation-scopes`.

Target: `https://consentflow-psi.vercel.app/`, container `GTM-PCJ3Q5RK`, measurement
destination `G-YV879ECLRV`.

## Scenarios

1. Loaded ConsentFlow with the built extension and confirmed visible edit access,
   account, container, and GA4 destination.
2. Requested successful submissions of the disposable form as leads.
3. Used visible controls to review and approve the specification, prepare the managed
   workspace, and inspect the calculated change plan.
4. Opened the exact application confirmation and confirmed only after it stated that
   the operation writes, validates, versions, and does not publish.
5. Inspected the final accessible workflow result and independently re-read the live
   GTM container.

## Evidence

- Plan: create `Form success - visible_element`, update managed
  `GA4 Event - generate_lead`, and leave `Page URL` unchanged.
- Validation passed with zero compiler errors and preview fingerprint
  `1787537271064`.
- Immutable version 4 was created with fingerprint `1787537272032`.
- The prior-live evidence records version 3 fingerprint `1787458659661`.
- The independent live read still returned version 3.
- Playwright observed no approval, publish, or rollback request.
- The page remained intact and the workbench exposed the final result through its
  labelled `GTM workflow result` region.

## Findings

- No blocker or high-severity finding.
- Medium: version 4 uses the discovered visible success region rather than the
  previously published data-layer event. Review that signal choice before publication.
- Expected boundary: browser verification cannot prove unpublished version 4 on the
  live page.
