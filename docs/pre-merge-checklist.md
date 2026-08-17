# Current Release Status

Status: merged to `main` and deployed to production

## Branch

- Merged branch: `codex/no-login-gtm-setup`
- Current branch: `main`
- Latest merged adjustment commit: `c6f0288`
- Production API: `https://gtm-observability.vercel.app`
- Extension production build command: `npm run build:extension:prod`
- Extension production watch command: `npm run watch:extension:prod`

## Completed

- Local deterministic verification passes with `npm run verify`.
- Production API is deployed on Vercel.
- `GET /api/health` returns OK in production.
- `GET /api/google/status` reports Google integration disabled unless server credentials are configured.
- `GET /api/google/gtm/accounts` rejects unauthenticated access.
- `POST /api/setups` generates a GTM-compatible navigation-click setup.
- Chrome extension opens an in-page browser-action workbench overlay, not a side panel, new tab, or auto-closing popup.
- The workbench is bound to the source tab that opened it, preventing accidental scans of another HTTP tab.
- The workbench includes a GTM import and Preview checklist before browser verification can start.
- The workbench remembers manually entered GA4 Measurement IDs and public GTM Container IDs per site hostname after successful generation.
- Read-only GTM discovery paginates account and container results with `nextPageToken`.
- Production extension build points at the exact production API origin.
- Production extension builds write to `apps/extension/prod-dist`, separate from local E2E builds in `apps/extension/dist`.
- Security and publishing guardrails are documented.

## Remaining Human Acceptance Test

This is the remaining validation step that requires access outside the local harness:

1. Build the production extension artifact:

   ```bash
   npm run build:extension:prod
   ```

2. Load `apps/extension/prod-dist` as an unpacked Chrome extension.
3. Open the live ConsentFlow site.
4. Use the extension workbench overlay to discover and confirm navigation scope.
5. Generate and download the GTM container JSON.
6. In the ConsentFlow GTM container, import the file using **Merge into a new workspace**.
7. Start GTM Preview for ConsentFlow.
8. Use the extension guided verification flow.
9. Download the browser-verification evidence report.
10. Confirm no browser-only result is presented as GA4 platform confirmation.

## Issue Boundary

If the human acceptance test finds a GTM-import or ConsentFlow-specific issue, file it under `.scratch/navigation-tracking/issues/` before changing the implementation.
