# Post-publication verification and the rollback card must survive navigation

Status: resolved

Severity: high

GitHub: #76

## Objective

After a published version is checked in the browser, the confirmed link navigates. The
check must finish on the next page, and its operation card, including **Review rollback**
for a failed publication, must render there. The post-publication run (operation,
request, click evidence, recorded result) is kept in the service worker and
`chrome.storage.session` per tab, and the next page reloads the stored operation.

## Regression contract

- `tests/e2e/navigation-extension.spec.ts`, "finishes post-publication verification on
  the next page when the link unloads first": no collection request, so the link unloads
  before anything is recorded. The new page records the failed evidence once and reaches
  **Review rollback**. The test fails without the fix and passes with it.
- `tests/e2e/navigation-extension.spec.ts`, both rollback tests: they now run through the
  real navigation to `/services`, with no 204 stub.
- `tests/e2e/navigation-extension.spec.ts`, "passes a working tag when the destination
  page sends its own page_view" and "fails a broken tag even when the destination page
  sends its own page_view": only the clicked document's requests count.
- `apps/extension/src/navigation-run.test.ts`: run validation and lifetime, settle delay,
  evidence merging, the clicked-document filter, and resuming only on the link's origin.

## Answer

Resolved in the #71 pull request (#75). The content script saves the run on the click
(`NAVIGATION_RUN_SAVE`). The service worker keeps any recorded result and finishes an
in-flight recording before it answers `NAVIGATION_RUN_RESUME`. The next page records
the evidence if nobody did, or reloads the stored operation, then renders its card.
