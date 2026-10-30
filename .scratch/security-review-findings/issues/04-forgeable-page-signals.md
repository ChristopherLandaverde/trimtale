# Page scripts can forge, start, read and disable the page-observer signal channel

Status: resolved

## Objective

Slice 1 (#59) added `apps/extension/src/page-observer.ts`, a MAIN-world content script that
reads `window.dataLayer` during a form verification. It talked to the isolated content script
through `document` CustomEvents (`trimtale:page-signal`, `trimtale:page-signal-replay`), which
every script on the page shares. A page script (the site's own code or any third-party tag)
could:

1. dispatch forged `trimtale:page-signal` events — a `generate_lead` event that never entered
   `dataLayer`, or a denied consent state — and change the verdict (for example a form with no
   lead event read as `datalayer_event_observed_tag_not_firing`, or any failure masked as
   `consent_limited`);
2. dispatch `trimtale:page-signal-replay` to start the observer polling and replay its history;
3. listen for `trimtale:page-signal` to read the signal stream, and so detect the extension and
   a verification in progress;
4. rewrite `JSON.stringify`, `CustomEvent` or `EventTarget.prototype.dispatchEvent`, which the
   observer looked up at call time, to rewrite or read what it sent;
5. pre-set `window.__trimtalePageObserver` (a script that runs first, e.g. an automation
   init script) to keep the observer from starting.

The isolated content script also accepted synthetic `submit` and `invalid` events
(`isTrusted === false`), so a page script could start a verification run nobody submitted.

## Regression contract

- `tests/e2e/page-signal-forgery.spec.ts` (Chromium, unpacked extension):
  - a fixture page (`?adversary=datalayer`) that forges `generate_lead` signals, replays, a
    connect handshake with its own port, and wraps `JSON.stringify`, `dispatchEvent` and
    `MessagePort.prototype.postMessage` still gets the true verdict
    `outcome_observed_event_missing`; the extension's isolated world received no forged
    signal, and the page's capture log is empty;
  - the same with forged denied consent (`?adversary=consent`);
  - a synthetic `submit`/`invalid` event does not start a run (no verdict after 5s);
  - a non-writable `__trimtalePageObserver` flag set before the observer loads does not stop
    it (`consent_denied` still reaches `consent_limited`, which needs the observer).
- `tests/e2e/form-real-signals.spec.ts`: the sentinel and idle-until-verification checks now
  read what the extension actually received, in its isolated world, instead of a page-side log
  (which is now always empty).
- `packages/core/src/form-signals.test.ts`: `pageSignalFromValue` rebuilds structured-cloned
  signals from allowlisted fields and rejects malformed ones.

## Answer

The observer and a new isolated-world bridge (`page-bridge.js`) both run at
`document_start`, in manifest order, before any page script. The bridge hands the observer one
end of a `MessageChannel` in a single synchronous `MessageEvent`; the observer takes it and
removes its listener. All signals and the start command travel over that port, which no page
script can reach. The observer captures every built-in on that path before page scripts run,
has no global flag, and the bridge re-validates every signal in the isolated world. Submit and
invalid events count only when `isTrusted`. See `.changes/2026-10-30-forge-proof-page-signals.md`.
