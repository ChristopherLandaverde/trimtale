# Exploratory review: assistant on Focosys UX standards

Date: 2026-10-30. Build: `feat/assistant-focosys-ux`, local API and fixture site, Playwright-managed Chromium with the unpacked extension (`apps/extension/dist`), 1280×800, panel 400×640. "Before" images come from `origin/main` (`1d8e577`) built and driven by the same script.

Screenshots here use the real bundled fonts. The committed Playwright baselines force Arial through `tests/e2e/visual-stability.css`, so they show layout, not type.

Job of the panel: a marketer opens the assistant on their own page to set up tracking for an outcome, then learns whether the browser actually sends it and what to fix next.

## Scenarios

| Scenario | Path | Before | After |
|---|---|---|---|
| Panel opened, OAuth not configured | empty / connection state | [before](2026-10-30-assistant-focosys-ux/before-open.png) | [after](2026-10-30-assistant-focosys-ux/after-open.png) |
| Navigation scope picker | happy | [before](2026-10-30-assistant-focosys-ux/before-navigation-picker.png) | [after](2026-10-30-assistant-focosys-ux/after-navigation-picker.png) |
| Confirmed navigation evidence path | happy | [before](2026-10-30-assistant-focosys-ux/before-evidence-path.png) | [after](2026-10-30-assistant-focosys-ux/after-evidence-path.png) |
| Page highlights for confirmed links | happy, page | [before](2026-10-30-assistant-focosys-ux/before-page-confirmed-highlights.png) | [after](2026-10-30-assistant-focosys-ux/after-page-confirmed-highlights.png) |
| Lead verified (`ajax_success`) | happy | [before](2026-10-30-assistant-focosys-ux/before-verdict-verified.png) | [after](2026-10-30-assistant-focosys-ux/after-verdict-verified.png), [evidence open](2026-10-30-assistant-focosys-ux/after-verdict-verified-evidence.png) |
| Endpoint returns 500 (`server_error`) | negative | [before](2026-10-30-assistant-focosys-ux/before-verdict-submission-failed.png) | [after](2026-10-30-assistant-focosys-ux/after-verdict-submission-failed.png) |
| Browser validation blocks submit | negative | [before](2026-10-30-assistant-focosys-ux/before-verdict-validation.png) | [after](2026-10-30-assistant-focosys-ux/after-verdict-validation.png) |
| `analytics_storage` denied | ambiguous | [before](2026-10-30-assistant-focosys-ux/before-verdict-consent.png) | [after](2026-10-30-assistant-focosys-ux/after-verdict-consent.png) |
| Two lead requests for one submit | negative | [before](2026-10-30-assistant-focosys-ux/before-verdict-duplicate.png) | [after](2026-10-30-assistant-focosys-ux/after-verdict-duplicate.png) |
| Lead request missing parameters | negative | [before](2026-10-30-assistant-focosys-ux/before-verdict-missing-parameter.png) | [after](2026-10-30-assistant-focosys-ux/after-verdict-missing-parameter.png) |
| Endpoint 503 while the page showed success and sent a lead (`server_error_with_success_event`, from #63's fixture, run on a trial merge with #63) | conflicting | n/a | [after](2026-10-30-assistant-focosys-ux/after-verdict-endpoint-conflict.png) |
| Keyboard: evidence toggle then Shift+Tab | accessibility | n/a | [after](2026-10-30-assistant-focosys-ux/after-keyboard-focus.png) |
| Hostile form label on a dark page | adversarial | n/a | [page](2026-10-30-assistant-focosys-ux/after-page-adversarial.png), [finding](2026-10-30-assistant-focosys-ux/after-adversarial-finding.png) |

The adversarial page served a form whose `aria-label` was `<img src=x onerror=alert(1)>` followed by a backticked word and about 200 characters. The label rendered as text in the question, the buttons and the finding: the panel contained no `img` element, no dialog fired, the backticks were not turned into code, and the finding truncated the label to 60 characters. The ink-outline highlights with a state halo stayed visible on the dark page.

## What changed on screen

- Every run verdict is a finding card: status tag (`✓ VERIFIED`, `× BROKEN`, `! REVIEW`, `– NOT CHECKED`), a plain-language title, then Observed / Why / Fix / Verify. The raw `verdict.*` fields and observation counts sit behind "Show evidence" in IBM Plex Mono.
- When the form endpoint fails or rejects a submission but the page still shows success (#63), the finding names that conflict and the HTTP status. When a lead request was sent anyway, it warns that GA4 may count a lead that does not exist, instead of claiming nothing reached GA4.
- The lowercase fallback (`submission failed. Fix the form…`) is gone; every verdict code has its own copy.
- The panel is on Focosys tokens: paper and ink, 4–6px radius, no gradients, blur or depth shadows, DM Sans for sentences and IBM Plex Mono for labels and evidence. Text is 13px or larger, labels 11px.
- The collapsed launcher is an ink square with a lime `T`, not a conic-gradient orb.
- Connection badges carry a symbol as well as a word (`□ READ-ONLY`, `! NOT CONFIGURED`).

## Findings

| Severity | Finding | Status |
|---|---|---|
| medium (pre-existing) | Setup-operation copy still leads with workflow codes (`GTM setup operation reached await_approval`, `Setup operation blocked: …`). | Out of scope here. The publish-confirmation change that follows rewrites this flow. |
| low | Highlight labels for links at the very top of the page are clipped by the viewport (labels sit above the target). | Pre-existing, unchanged. |
| low | `expected_non_conversion` shows `– NOT CHECKED` while its evidence row reads `verdict.browserVerification: failed`. The tag describes what the run could test; the evidence is the raw contract. | Decision for Christopher (see PR). |
| low | The content script grows from about 133 KB to 250 KB because five woff2 faces are inlined. | Accepted: no network font load and no page-CSP exposure. |

No blocker or high-severity findings.

## Contrast (WCAG 2.x, computed)

ink on paper 14.36, ink on raised 13.36, secondary on paper 5.27, secondary on raised 4.90, warning on paper 5.20, warning on raised 4.83, paper on exception 5.00, ink on lime 14.35, ink on blue 8.59, lime on ink 14.35.
