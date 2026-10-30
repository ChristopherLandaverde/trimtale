# Contributing

Thanks for helping. Trimtale is small and early, so issues that describe a real tracking
setup it got wrong are as useful as code.

## Set up

Requires Node.js 22+ and npm 10+.

```bash
npm ci
npx playwright install chromium
npm run build
```

`npm run dev:api` starts the local API and `npm run dev:fixture` starts the sample site. See
the [README quick start](README.md#quick-start) for loading the extension.

## Check your change

| Command | What it runs |
| --- | --- |
| `npm run check` | Builds `@trimtale/core` and typechecks every workspace |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | Builds, then runs the Playwright browser tests |
| `npm run verify` | Everything above, plus preflight and the change-record check |

Run `npm run verify` before opening a pull request. Update visual baselines with
`npm run test:e2e:update-snapshots` only when the UI change is intended, and say so in the PR.

## Change records

Every pull request that touches `apps/`, `packages/`, `tests/`, `scripts/` or the root
package and config files needs a change record in `.changes/`. Copy `.changes/template.md`
to `.changes/YYYY-MM-DD-short-slug.md` and fill in every section. `npm run check:change-docs`
checks it.

## Tests never touch a real Google account

Unit and browser tests run against the bundled fixture site, recorded API responses and
fake tokens. Don't add a test that needs a real Google account, GTM container or GA4
property, and don't commit real container, account or measurement IDs. Use placeholders
such as `GTM-TEST123` and `G-TEST123456`. `npm run test:google` is a manual, read-only discovery check that needs a
short-lived `GOOGLE_GTM_ACCESS_TOKEN`; it isn't part of `verify`.

## Pull requests

Fill in the pull request template. Keep each PR to one slice of behavior, and name the
terms you use the way [`CONTEXT.md`](CONTEXT.md) does.

Security problems go through the [security policy](SECURITY.md), not a public issue.
