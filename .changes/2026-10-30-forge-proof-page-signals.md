# Forge-proof page signals

Change record version: 2

Issue: `.scratch/security-review-findings/issues/04-forgeable-page-signals.md`

## Summary

The MAIN-world page observer now talks to the extension over a private `MessagePort` handed
over once at `document_start`, instead of `document` CustomEvents any page script could
dispatch or read. Synthetic `submit`/`invalid` events no longer start or fail a run.

## Why

Page scripts could forge `generate_lead` or consent signals and change a form's verdict (a
broken setup read as a different failure, or any failure masked as `consent_limited`), start the
observer, read the signal stream to detect a verification in progress, and pre-set the
observer's guard flag. Trimtale's verdicts must reflect what the page and browser actually did.

## Behavior

- New isolated-world content script `page-bridge.js` at `document_start`, declared right after
  `page-observer.js` (Chrome injects static content scripts in manifest order, and
  `document_start` scripts before any page script). It creates a `MessageChannel`, dispatches one
  synchronous `MessageEvent` carrying a port, re-validates each signal with
  `pageSignalFromValue`, and publishes itself to the content script under an isolated-world
  `Symbol.for` key.
- `page-observer.js` accepts exactly one port and removes its handshake listener; it captures
  the built-ins on the channel path, sends structured-cloned objects, and has no global flag.
  It no longer keeps a replay history; the bridge does.
- `FormSignalCapture` subscribes to the bridge and starts the observer through it. A consent
  state that arrives during a run applies to the run even if the observer read it just before
  the submit (the old synchronous replay used to cover that).
- `submit` and `invalid` events count only when `isTrusted`.
- Unchanged: the signal shape and sanitizer, the verdict engine, the observer staying idle until
  a verification starts, and the 50 ms polling of `window.dataLayer` without replacing `push`.
- Not addressed (page-controlled by definition): the page's own `dataLayer` contents, DOM and
  URL; a page detecting the polling through a `window.dataLayer` getter. Documented in
  `docs/security-and-publishing.md`.

## Regression coverage

- `tests/e2e/page-signal-forgery.spec.ts` (4 tests, new): forged dataLayer and consent signals
  from a hostile fixture page (`?adversary=datalayer|consent`) leave the verdict at
  `outcome_observed_event_missing`, never reach the extension, and the page captures nothing;
  a synthetic submit starts no run; a pre-set `__trimtalePageObserver` flag does not disable
  the observer. All four failed on `main` before the fix.
- `tests/e2e/form-real-signals.spec.ts`: the sentinel and idle-until-verification checks read
  what the extension received in its isolated world (via CDP) instead of a page-side listener,
  which can no longer see anything. Same assertions, stronger vantage point.
- `packages/core/src/form-signals.test.ts`: `pageSignalFromValue` keeps only allowlisted fields
  and rejects malformed values.

## Verification

`npm run check` passed; `npx vitest run` 41 files / 323 tests passed; `npm run build` passed;
`npx playwright test` — see the PR for the full run.

## Exploratory review

`docs/reviews/2026-10-30-forge-proof-page-signals.md`: the hostile fixture page in Chromium
with the built extension (forged dataLayer and consent signals, wrapped built-ins, a rival
handshake), plus a happy path and a consent-denied path through the new channel. No blocker or
high findings.

## Documentation

`docs/security-and-publishing.md` (page-observer channel, residual limits, how verdicts weigh
dataLayer versus network evidence); `.scratch/security-review-findings` spec and issue 04.
