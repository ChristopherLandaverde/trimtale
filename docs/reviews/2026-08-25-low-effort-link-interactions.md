# Low-effort link interaction review

Date: 2026-08-25

Build: current working tree.

Target: deterministic local resource pages with the built production extension and a
controlled GTM/GA4 connection response.

## Scenarios

1. Requested outbound-link tracking with one same-origin link, one external link, one
   downloadable file, and one email link while automatic outbound coverage was off.
2. Selected sitewide scope and reviewed the generated `outbound_click` setup.
3. Requested file-download tracking while the exact stream's automatic file-download
   setting was off and reviewed the current-page fallback setup.
4. Repeated both requests with exact-stream automatic coverage enabled.
5. Requested downloads on a page with no supported downloadable-file link.
6. Included an external destination, file name, query values, broken image, and
   markup-shaped content containing private sentinels.

## Evidence

- Page inspection distinguished one outbound link and one downloadable file link;
  the same-origin navigation and email link were not counted as either interaction.
- The review exposed event, scope, consent, automatically collected page context, and
  every excluded parameter class before approval.
- Generated artifacts and the managed-workspace plan contained no observed
  destination, query value, link text, or file name.
- Exact-stream automatic coverage rendered `Already covered` and exposed no setup,
  scope, review, or planning action.
- Missing page evidence rendered a blocked task and generated no setup.
- Attacker-shaped page content remained inert in both the page and assistant.

## Findings

- No blocker or high-severity product finding in this slice.
- The unrelated visual-contract blocker was resolved in
  `.scratch/conversational-tracking-specs/issues/12-form-candidate-highlight-snapshot-flake.md`.
  Final verification passed all 392 deterministic tests and 55 Chromium journeys.
