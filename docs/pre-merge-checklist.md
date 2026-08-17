# Pre-Merge Checklist

Status: ready for human GTM acceptance test

## Branch

- Branch: `codex/no-login-gtm-setup`
- Production API: `https://gtm-observability.vercel.app`
- Extension production build command: `npm run build:extension:prod`

## Completed without GTM credentials

- Local deterministic verification passes with `npm run verify`.
- Production API is deployed on Vercel.
- `GET /api/health` returns OK in production.
- `GET /api/google/status` reports Google integration disabled unless server credentials are configured.
- `GET /api/google/gtm/accounts` rejects unauthenticated access.
- `POST /api/setups` generates a GTM-compatible navigation-click setup.
- Chrome extension is a browser-action popup, not a side panel.
- Production extension build points at the exact production API origin.
- Security and publishing guardrails are documented.

## Human acceptance test

This is the only remaining pre-merge step that requires access outside the local harness:

1. Build the production extension artifact:

   ```bash
   npm run build:extension:prod
   ```

2. Load `apps/extension/dist` as an unpacked Chrome extension.
3. Open the live ConsentFlow site.
4. Use the extension popup to discover and confirm navigation scope.
5. Generate and download the GTM container JSON.
6. In the ConsentFlow GTM container, import the file using **Merge into a new workspace**.
7. Start GTM Preview for ConsentFlow.
8. Use the extension guided verification flow.
9. Download the browser-verification evidence report.
10. Confirm no browser-only result is presented as GA4 platform confirmation.

## Merge boundary

Do not merge until the human acceptance test passes or any discovered GTM-import issue is filed under `.scratch/navigation-tracking/issues/`.
