# Pre-chat GTM context exploratory review

Date: 2026-08-23

Build: `feat/pre-chat-gtm-context` production extension before final commit.

## Environment

- Playwright Chromium 1234 with the unpacked production extension.
- Deterministic loopback fixtures for every connection and recognition state.
- A separate isolated Chromium review on `https://consentflow-psi.vercel.app/` using
  the saved mode-0600 OAuth token store and read-only GTM scope.
- No browser cookie inspection, form submission, GTM write, workspace preparation, or
  publication.

## Scenarios

### Exact live identity before chat

Opened the assistant on the live ConsentFlow page without entering a prompt. The card
settled to:

- page `GTM-XXXXXXX`;
- account `Example Test Account`;
- container `ConsentFlow Verification`;
- effective capability `READ-ONLY`;
- `GTM API authorization connected` rather than a browser-login claim;
- explicit statement that editing and publishing are off.

The first chat prompt and enabled composer remained visible. The account/container
identity came from one exact authorized GTM API match, not from the page ID or browser
login. Refresh repeated the bounded read-only status and recognition calls.

Deterministic visual evidence:
[`gtm-context-matched-linux.png`](../../tests/e2e/gtm-connection-context.spec.ts-snapshots/gtm-context-matched-linux.png)

### Delayed discovery

Loaded the fixture page with a GTM script and left the assistant collapsed. Both status
and recognition request counts remained zero. Opening the assistant issued one status
read and one exact-container recognition read. This protects ordinary website visits
from background account discovery.

### Offline, authorization, and page states

Exercised local-service failure, OAuth unconfigured, Google disconnected, connected
with no page container, inaccessible public ID, duplicate authorized matches, and two
page container IDs. Each state used distinct copy and refused to invent an account or
choose a container. The offline state left chat enabled and did not render private
transport detail.

Unavailable visual evidence:
[`gtm-context-offline-linux.png`](../../tests/e2e/gtm-connection-context.spec.ts-snapshots/gtm-context-offline-linux.png)

### Existing conversation surfaces

Reviewed the intentionally replaced expanded-assistant, candidate-highlight,
navigation-scope, evidence-path, and managed-workspace baselines. The card stays at the
top before conversation; later messages scroll normally, targets remain visible, and
the composer remains anchored. The collapsed orb is unchanged.

## Findings

1. Medium, resolved: the first unconfigured-state copy said a page ID was observable
   even on a fixture with no GTM script. The copy now distinguishes no page container
   and lists only bounded observed IDs when present.
2. Medium, resolved: forwarding the validated status object could retain unexpected
   extra backend fields. The service worker now constructs a fixed safe status object
   before responding to the content script.
3. Low, expected: managed Chromium could not decrypt the desktop Chrome profile's web
   sign-in token. The product neither depends on nor reports that state; the isolated
   review correctly used the app's separately saved GTM OAuth grant.

## Result

No unresolved blocker or high-severity finding. Exact identity, delayed loading,
refresh, offline, disconnected, unconfigured, no-container, inaccessible, ambiguous,
multiple-container, keyboard/focus, inert rendering, and read-only authority boundaries
are ready for the completion gate.
