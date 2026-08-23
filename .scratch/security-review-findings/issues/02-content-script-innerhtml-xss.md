# DOM XSS: page-controlled link text reaches innerHTML in the content script

Status: resolved

## Objective

`apps/extension/src/content-script.ts` scans every page's navigation links and
extracts link text with no escaping:

```ts
text: (anchor.innerText || anchor.getAttribute("aria-label") || "Untitled link").replace(/\s+/g, " ").trim(),
```

That value (`item.text`) later reaches an `innerHTML` sink in
`updateTargetHighlights()`:

```ts
marker.innerHTML = `<span>${highlightTone === "confirmed" ? "✓" : index + 1} ${item.text}</span>`;
```

`anchor.innerText` and `aria-label` are fully attacker-controlled on any page
the content script runs on — and per `manifest.json` this content script is
injected on every `http://*/*` and `https://*/*` page, not just pages the user
trusts. A page can set an anchor's visible text to a literal string like
`<img src=x onerror="...">` (e.g. by writing `&lt;img src=x onerror=...&gt;` in
its own HTML source, which the DOM decodes into that literal text). When that
text is later assigned via `innerHTML`, the browser parses it as markup and
executes the payload.

This runs in the content script's isolated JS world, which already has access
to `chrome.storage`, `chrome.runtime.sendMessage`, and `chrome.runtime.connect`
via this same file — so the payload isn't just page-context XSS, it runs with
this extension's message-passing and storage APIs available to it. Any site
the user visits with this extension installed can trigger it the moment the
assistant is opened and "Confirm selection" / "Track all" highlighting runs
(`renderNavigationPicker` → `highlightTargets` → `updateTargetHighlights`).

`addMessage()` in the same file does this correctly (`message.textContent =
copy`) — this is a single inconsistent sink, not a systemic escaping gap.

## Regression contract

Required test level: deterministic unit test under the ordinary `npm test`
gate, per `docs/engineering/delivery-harness.md`'s "Privacy and security
regressions" tier ("Add adversarial selectors, URLs, extension messages...").

Required invariants:

- Positive: a navigation link whose visible text or `aria-label` is an
  adversarial string (e.g. containing `<img src=x onerror=...>` literally, or
  `<script>`) is rendered as inert text in the highlight marker, not parsed as
  markup.
- Negative/regression: the existing legitimate case (plain link text renders
  and highlights normally) keeps passing.

## Work

- Fix `updateTargetHighlights()` to build the marker label with `textContent`
  (or an explicit text node) instead of interpolating `item.text` into
  `innerHTML`, mirroring the existing pattern in `addMessage()`.
- Audit the other `innerHTML` call sites in this file
  (`renderEvidencePath`, `mountOverlay`'s static shadow-DOM template) to confirm
  they only ever interpolate static strings or `CSS.escape`d values — no other
  changes needed if so, but note the audit result in the change record.
- Add the regression test above.
- Add a concise change record.

## Done when

- The regression contract runs in `npm test`.
- `npm run verify` passes.

## Comments

- 2026-08-22: Fixed while generalizing target highlights for conversational forms. Labels now use `textContent`; the evidence rows were also converted to explicit DOM construction before adding runtime-derived text. Chromium regression coverage proves a literal HTML payload remains text and executes nothing.

## Answer

Page-controlled target labels no longer reach an HTML parser. The static overlay stylesheet remains the only `innerHTML` use in the target host, and dynamic labels and evidence values are constructed with text nodes.
