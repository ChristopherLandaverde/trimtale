# Exploratory review: rollback approval

Date: 2026-10-31. Build: `claude/71-rollback-approval`. Playwright-managed Chromium (Chrome for Testing 153) with the unpacked extension, local fixture site, viewport 1280×800. The workflow API is the deterministic mock in `tests/e2e/helpers/workflow-fixtures.ts`. **No real Google account or container was used.** "Before" is `main` at `edfd95e` driven by the same script.

Job of this step: after a published version fails browser verification, a practitioner with publish access sees exactly what a rollback will restore and replace, deliberately approves it as themselves, and rolls back while that approval is current.

## Scenarios

| Scenario | Path | Screenshot |
|---|---|---|
| Rollback-required card, before: one inline "Rollback live-7" click, sent `approvedBy: "website assistant"` | baseline | [before](2026-10-31-rollback-approval/before-rollback-required.png) |
| Rollback-required card, after: "Review rollback", rollback stage not passed | happy | [after](2026-10-31-rollback-approval/after-rollback-required.png) |
| Review opened: container, restores `live-7`, replaces `version-8`; approve disabled; focus in the input | happy | [after](2026-10-31-rollback-approval/after-rollback-review-empty.png) |
| Lowercase `gtm-test123` typed: approve stays disabled | negative | [after](2026-10-31-rollback-approval/after-rollback-review-wrong.png) |
| Exact `GTM-TEST123` typed: approve enabled | happy | [after](2026-10-31-rollback-approval/after-rollback-review-ready.png) |
| Approved, not rolled back: approver email shown, separate "Roll back to live-7" | happy | [after](2026-10-31-rollback-approval/after-rollback-approved.png) |
| Rolled back: "Restored prior live version live-7; approved by practitioner@example.test" | happy | [after](2026-10-31-rollback-approval/after-rolled-back.png) |
| Rollback refused as `approval_expired`: nothing rolled back, rollback stage says the approval expired, back to review | negative | [after](2026-10-31-rollback-approval/after-rollback-stale-approval.png) |
| Rollback target `<img src=x onerror=alert(1)>` plus 100+ characters | adversarial | [after](2026-10-31-rollback-approval/after-rollback-review-adversarial.png) |

The hostile target rendered as text, with no `img` element in the panel and no dialog. The typed confirmation is exact and case-sensitive in the UI, and the backend repeats it (`confirmation_mismatch`). Neither request body carries an approver.

## Findings

| Severity | Finding | Status |
|---|---|---|
| medium | Rollback reuses publication's refusal codes (`approval_expired`, `approver_changed`, `confirmation_mismatch`). Keyed on the code alone, a refused rollback would show publication copy ("Nothing was published") and mark the publication approval stage unpassed. | Fixed here: refusals with `stage: "rollback"` get rollback copy and leave the publication stages alone; covered in `setup-operation-presenter.test.ts`. |
| medium (pre-existing) | Clicking a confirmed navigation link for browser verification navigates the page, and the assistant on the new page does not reload the operation card. The old rollback e2e passed only by clicking before navigation finished. The two-step flow made the race visible. | The e2e now answers that navigation with 204 so the page stays put. Product follow-up for Christopher: reload the stored operation after a post-publication navigation. |
| low | A very long rollback target wraps across several lines inside the approve button. | Accepted; real GTM fingerprints are short numeric strings. Same behavior as the publish review. |
| low | The approved card states the expiry in the viewer's local time; the backend enforces it in UTC. | Accepted, as for publish. |

No blocker or high-severity findings.
