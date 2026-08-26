# Form-highlight visual isolation review

Date: 2026-08-25

## Scope

Reviewed the candidate and confirmed form-highlight baselines after excluding the
assistant shell from those two screenshot captures. Production extension rendering was
not changed.

## Evidence

- The prior expected image, stable failing image, and pixel diff showed unchanged page
  highlights with a 16px assistant-content scroll difference.
- Fresh-profile diagnosis also exposed a separate one-pixel assistant-shell drift while
  target labels, borders, and form geometry remained unchanged.
- The replacement candidate baseline shows both numbered amber targets without
  occlusion.
- The replacement confirmed baseline shows only Contact sales with its green border and
  confirmation label. Newsletter signup has no highlight.
- The assistant is restored immediately after each capture, and the same journey still
  asserts its target-selection copy, review action, specification, and approval path.

## Findings

No blocker or high-severity finding remains. The new baselines cover only the page
surface named by the regression contract; assistant behavior retains non-visual
coverage here and visual coverage in its dedicated journeys.

The full gate also exposed an independent one-pixel width toggle in the Enhanced
Measurement card and automatic-coverage task element screenshots. Both actual images
were inspected against their approved baselines. Their content was unchanged; the
347px parent width rewrapped one task sentence. Fixing each test surface to its approved
348px border-box width preserved both baselines across 20 focused repetitions.

## Result

Passed visual inspection, ten consecutive form-highlight repetitions, 20 focused
Enhanced Measurement repetitions, and the complete 55-journey Chromium gate.
