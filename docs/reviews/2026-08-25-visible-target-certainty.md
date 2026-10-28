# Visible target-certainty review

Date: 2026-08-25

Build: current working tree.

Target: deterministic local form and link pages with the built production extension
and controlled GTM/GA4 context.

## Scenarios

1. Requested successful submissions on a page with one automatically resolved form.
2. Requested outbound, download, email, and phone-link tracking on a page containing
   one match for each interaction.
3. Selected current-page phone scope and compared the candidate and confirmed states.
4. Used attacker-shaped outbound, download, and email values.

## Evidence

- The automatically resolved form received one green confirmed outline and a generic
  label before setup review.
- Each known-link request produced one amber marker only on its matching element. The
  selected phone scope changed its marker to green.
- Link markers used generic interaction labels. Destinations, contact values, and
  visible link text remained on the page and did not enter the agent task.
- The existing multiple-form numbered candidate and confirmed contracts remained
  unchanged in focused regression runs.
- The full gate exposed a one-pixel width drift in the existing connected-evidence
  screenshot. Its test-only surface was pinned to 382px, and the reviewed baseline
  passed five fresh Chromium repetitions without changing production styles.
- Final verification passed 404 deterministic tests and 61 Chromium journeys.

## Findings

- No blocker or high-severity finding remains.
- Medium: a long page-inspection receipt can squeeze its label into one character per
  line in the compact overlay. Follow-up is recorded in
  `.scratch/conversational-tracking-specs/issues/38-readable-action-receipts.md`.
