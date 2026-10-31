# Exploratory review: rollback approval

Date: 2026-10-31. Build: `claude/71-rollback-approval`. Playwright-managed Chromium (Chrome for Testing 153) with the unpacked extension, local fixture site, viewport 1280×800. The workflow API is the deterministic mock in `tests/e2e/helpers/workflow-fixtures.ts`. **No real Google account or container was used.** "Before" is `main` at `edfd95e` driven by the same script.

Job of this step: after a published version fails browser verification, a practitioner with publish access sees exactly what a rollback will restore and replace, deliberately approves it as themselves, and rolls back while that approval is current.

## Scenarios

| Scenario | Path | Screenshot |
|---|---|---|
| Rollback-required card, before: one inline "Rollback live-7" click, sent `approvedBy: "website assistant"` | baseline | [before](2026-10-31-rollback-approval/before-rollback-required.png) |
| Rollback-required card, after: "Review rollback", rollback stage not passed (screenshot taken before #76 was fixed; the card now also renders on the page the link opens) | happy | [after](2026-10-31-rollback-approval/after-rollback-required.png) |
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
| high (pre-existing) | Clicking the confirmed link during browser verification navigates, and the assistant on the new page showed no operation card and no **Review rollback**. Click evidence held by the page's 180 ms and 1200 ms timers was lost on unload, so a failed live publication had no recovery in the page. The old rollback e2e passed only by clicking before the navigation finished. | Filed as [#76](https://github.com/ChristopherLandaverde/trimtale/issues/76) (`.scratch/workflow-automation/issues/12-post-publication-verification-survives-navigation.md`) and fixed in this PR. The run is kept in the service worker and session storage, and the next page finishes it and reloads the operation. The e2e tests use the real navigation, and a new e2e covers the unload-first path. |
| medium (follow-up) | A re-approval while a publish or rollback waits for Google makes the final save fail after Google succeeded (both flows). | Filed as [#77](https://github.com/ChristopherLandaverde/trimtale/issues/77); not in this PR. |
| high (found in re-review, fixed) | The first #76 fix counted every collection request in the tab after the click, including the destination page's own page_view. A working tag then read as `duplicate_fire`, and a broken tag as a false `browser_verified`. | Fixed here: only the clicked document's requests count. Two e2e tests cover both cases. |
| medium (follow-up) | The assistant panel uses an open shadow root, and the approve handlers do not check `isTrusted`, so a hostile page could drive a review. | Filed as [#78](https://github.com/ChristopherLandaverde/trimtale/issues/78); not in this PR. |
| low (follow-up) | Specification IDs depend on navigation key order in core. | Filed as [#79](https://github.com/ChristopherLandaverde/trimtale/issues/79); this PR works around it in the extension. |
| low | A very long rollback target wraps across several lines inside the approve button. | Accepted; real GTM fingerprints are short numeric strings. Same behavior as the publish review. |
| low | The approved card states the expiry in the viewer's local time; the backend enforces it in UTC. | Accepted, as for publish. |

No unresolved blocker or high-severity findings. The one high finding, #76, is fixed here.
