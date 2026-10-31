# Exploratory review: captured request in the verdict evidence

Date: 2026-10-30. Build: `feat/captured-request-gif`, local API and fixture site,
Playwright-managed Chromium with the unpacked extension (`apps/extension/dist`), 1280×800, panel at
its default 380 px width. Each run was driven from the assistant's visible controls (request
"Track successful submissions of this form", Contact sales, review, confirm, start verification),
then the Contact sales form was submitted with `private-sentinel@example.com`, and "Show evidence"
was opened. Screenshots are of the panel at real size, scrolled to the end of the evidence list.

## Scenarios

| Scenario | Path | Verdict | `network.*` rows shown | Screenshot |
|---|---|---|---|---|
| `ajax_success` | happy | `browser_verified` | count `1`; host `127.0.0.1:14173`, `tid` G-TEST123456, `en` generate_lead, `ep.form_id` contact, `ep.form_name` Contact sales | [happy-default-size.png](2026-10-30-captured-request-evidence/happy-default-size.png) |
| `validation_failure` | negative | `expected_non_conversion` | count `0`; no request rows | [negative-validation.png](2026-10-30-captured-request-evidence/negative-validation.png) |
| `missing_required_parameter` | negative | `missing_parameter` | count `1`; host, `tid`, `en` only; the absent `form_id`/`form_name` rows are omitted, matching the finding text | [negative-missing-parameter.png](2026-10-30-captured-request-evidence/negative-missing-parameter.png) |
| `duplicate_request` | ambiguous | `duplicate_fire` | count `2`; one set of `[0]` rows (first request only) | [ambiguous-duplicate.png](2026-10-30-captured-request-evidence/ambiguous-duplicate.png) |
| Hostile page (`?adversary=datalayer`, plus an init script that rewrites the page's own GA4 beacon to set `ep.form_name=<img src=x onerror=alert(1)>`code`xxx…`, `uid=user-42`, `ep.email=private@example.com`, and `dl`/`ep.page_location` with `?email=…&token=secret`) | adversarial | `browser_verified` | count `1`; `ep.form_name` shown as literal text, cut to 80 characters with `…`; no `uid`, `ep.email`, `dl`, `page_location`, `token` or email anywhere in the panel; no dialog fired | [adversarial-hostile-beacon.png](2026-10-30-captured-request-evidence/adversarial-hostile-beacon.png) |

The typed email never appeared in the panel in any run. Field paths wrap only at their dots at the
default panel width (`network.ga4Requests[0].` / `host`), and values stay in their own mono column.

## Findings

| Severity | Finding | Status |
|---|---|---|
| low | With the longer `network.ga4Requests[0].*` labels the label column grew to its 62% cap and squeezed values, so `browser_verified` wrapped mid-word. | Fixed here: the label column is capped at 55% (`panel-styles.ts`); labels wrap at dots instead. |
| low | A page controls the form values in its own GA4 request, so `ep.form_name` can show page-authored text. It is what the request carried (accurate evidence), rendered via `textContent` and bounded. | Accepted; covered by the presenter unit test "bounds attacker-shaped form values". |
| low | On the fixture the verdict text says the request went "to Google Analytics" while the host row shows `127.0.0.1:14173`, the fixture's stand-in endpoint. On a real site the host is a Google Analytics host. | Accepted; the README caption and GIF alt text name the local fixture endpoint. |

No blocker or high findings.
