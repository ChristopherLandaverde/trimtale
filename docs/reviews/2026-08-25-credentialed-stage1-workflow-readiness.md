# Credentialed Stage 1 workflow readiness

Date: 2026-08-25

Target: `https://consentflow-psi.vercel.app/`, container `GTM-PCJ3Q5RK`, measurement
destination `G-YV879ECLRV`.

## Scenarios

1. Ran saved-session preflight and confirmed the ordinary launcher keeps publication
   scope and execution disabled.
2. Started the authenticated backend and performed read-only exact-container
   recognition through the configured extension origin.
3. Launched the new headed Stage 1 lane and confirmed the loaded production extension,
   page origin, and sole observed GTM public ID all matched the configured target.
4. Exercised automated negative cases for off-target workspace preparation,
   publication, and rollback.

## Evidence

- The saved OAuth session connected successfully with container-edit capability.
- Recognition returned exactly `GTM-PCJ3Q5RK`, one GA4 destination
  `G-YV879ECLRV`, live version 3, and one remaining workspace slot.
- The Stage 1 launcher reached its ready state with publication enabled only inside the
  public-ID-locked process.
- The readiness review made no GTM workspace, version, publication, or rollback
  mutation.
- Off-target regression cases made zero Google requests.

## Findings

- No blocker or high-severity finding in the launcher or target lock.
- Outstanding acceptance work: use the website agent and supported human Tag Assistant
  handoff to verify the exact draft, create and approve one immutable version, publish
  it, and collect live browser evidence or execute the recorded rollback.
- Verification-harness finding: the full gate produced four screenshot mismatches
  while the associated behavioral journeys passed. The baselines were not changed.

The review proves readiness and containment, not end-to-end real Google success.
