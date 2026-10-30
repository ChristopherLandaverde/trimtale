# Exploratory review: publish confirmation

Date: 2026-10-30. Build: `feat/publish-confirmation` (stacked on `feat/assistant-focosys-ux`). Playwright-managed Chromium with the unpacked extension, local fixture site, panel 400×760. The workflow API is the deterministic mock in `tests/e2e/helpers/workflow-fixtures.ts`. **No real Google account or container was used.** "Before" is the `feat/assistant-focosys-ux` build driven by the same script.

Job of this step: a practitioner with publish access sees exactly what one publish will change, deliberately approves it as themselves, and publishes it while that approval is current.

## Scenarios

| Scenario | Path | Screenshot |
|---|---|---|
| Versioned operation card, before: one inline "Publish version-8" click | baseline | [before](2026-10-30-publish-confirmation/before-versioned.png) |
| Versioned operation card, after: "Review and approve", approval stage not yet passed | happy | [after](2026-10-30-publish-confirmation/after-versioned.png) |
| Review opened: container, workspace, version, replaced version, two changes; approve disabled; focus in the input | happy | [after](2026-10-30-publish-confirmation/after-review-empty.png) |
| Lowercase `gtm-test123` typed: approve stays disabled | negative | [after](2026-10-30-publish-confirmation/after-review-wrong.png) |
| Exact `GTM-TEST123` typed: approve enabled | happy | [after](2026-10-30-publish-confirmation/after-review-ready.png) |
| Approved, not published: approver email shown, separate "Publish version-8" | happy | [after](2026-10-30-publish-confirmation/after-approved.png) |
| Publish refused as `approval_expired`: approval stage unpassed, nothing published, back to review | negative | [after](2026-10-30-publish-confirmation/after-stale-approval.png) |
| Change name `<img src=x onerror=alert(1)>` plus 100+ characters | adversarial | [after](2026-10-30-publish-confirmation/after-review-adversarial.png) |

The hostile change name rendered as text, with no `img` element in the panel and no dialog. The typed-confirmation check is exact and case-sensitive in the UI, and the backend repeats it (`confirmation_mismatch`).

## Findings

| Severity | Finding | Status |
|---|---|---|
| medium | Before this change, the "Publication approval" stage showed ✓ on a versioned operation while its text said approval was still required. | Fixed here; covered in `setup-operation-presenter.test.ts`. |
| medium | After a refused stale approval, the approval stage still showed ✓. | Fixed here: `approval_expired` and `approver_changed` show it unpassed. |
| low | GTM paths in the review wrapped mid-word. | Fixed: they wrap only after `/`. |
| low | The approved card states the expiry in the viewer's local time; the backend enforces it in UTC. | Accepted. |
| low (follow-up) | Rollback still sends `approvedBy: "website assistant"`, and the rollback route records no approver. | Out of scope. Logged in issue 06 for Christopher. |

No blocker or high-severity findings.
