# Rename the product to Trimtale

Change record version: 2

Issue: none (Christopher's decision, 2026-10-30: product name is Trimtale)

## Summary

Renamed the product from GTM Observability to Trimtale in the extension manifest, the
assistant and workbench copy, generated GTM export names, the API landing page and log line,
the README and the product docs. Workspace package names moved from `@gtm-observability/*` to
`@trimtale/*`, and the root package from `gtm-observability` to `trimtale`.

## Why

Christopher chose the name Trimtale (sailors trim by the telltales). The README was also
rewritten value-prop first, with honest known limits, per the readme-standards skill.

## Behavior

Changed: extension name, description, action title and command description; workbench title;
generated container/version names (`Trimtale import`, `Trimtale - <setup>`); download file
names (`trimtale-navigation-click.json`, `trimtale-generate-lead.json`); the assistant's host
element IDs (`#trimtale-root`, `#trimtale-targets`).

Deliberately unchanged, because renaming them would break existing state or configuration:
- managed GTM workspace name `GTM Observability`, its description and ownership marker
  `gtm-observability:v1`, and the `Managed by GTM Observability` entity note: they identify
  workspaces and entities already created in real containers;
- `GTM_OBSERVABILITY_*` environment variables and the matching build-time defines (local and
  Vercel configuration);
- the hosted API URL `gtm-observability.vercel.app`, the API health `service` id
  `gtm-observability-api`, and the evidence report type `gtm-observability-browser-verification`
  (data contracts);
- fixture-only meta names, the smoke event `gtm_observability_smoke_success` (may be configured
  in the disposable live container), internal window globals, temp-dir prefixes and the E2E
  extension origin;
- historical records under `.changes/`, `docs/reviews/` and `.scratch/`.

## Regression coverage

Existing unit and E2E assertions were updated to the new names (download file names, host
element IDs, generated export names). No visual baseline changed: no screenshot contains the
product name.

## Verification

`npm run check` passed; `npx vitest run` passed 40 files / 301 tests; `npm run build` passed;
`npx playwright test` passed 46 tests on macOS. `npm ci` from the regenerated lockfile passed.
README quick-start servers (`npm run dev:api`, `npm run dev:fixture`) were started and answered.

## Exploratory review

Not run as a separate review: this is a copy and identifier rename with no workflow change, and
the full Chromium E2E suite exercised every assistant flow under the new names.

## Documentation

README rewritten (value prop first, known limits, privacy and permissions). Developer and
operator material moved to `docs/engineering/local-development.md`. `CONTEXT.md` and
`docs/product-plan/*` updated; `current-capabilities.md` explains why the managed workspace
keeps its old name.
