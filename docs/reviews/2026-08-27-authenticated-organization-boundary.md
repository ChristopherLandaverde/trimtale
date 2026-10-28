# Authenticated organization boundary review

Date: 2026-08-27

## Environment

- Built core, API, fixture site, verification target, and the unpacked Chrome
  extension with deterministic test-only organization sessions.
- Chromium used a fresh profile per scenario and the ordinary website-agent surface.
- API scenarios used active Admin, active Member, wrong-organization, and missing
  sessions against the real local authorization middleware.

## Scenarios

1. Opened the website agent with an API-rejected session and reviewed the visible
   product sign-in action.
2. Opened it with a wrong-organization response containing markup, an email address,
   and a private identity sentinel.
3. Reached protected status as Member and Admin, then attempted publication as Member.
4. Re-ran the existing authorized read-only GTM connection and inert attacker-label
   journeys with the service-worker authorization header enabled.

## Observations

- The sign-in state clearly separates GTM Observability sign-in from Google
  authorization and keeps the chat input usable.
- The wrong-organization state names the membership requirement without showing an
  email, member ID, token, provider payload, or attacker markup.
- Member and Admin status responses contain role and product permissions only. Member
  publication fails at the authorization boundary before workflow processing.
- The product access token exists only in the service-worker test bundle. The built
  content-script bundle contains no test token, access/refresh field, member sentinel,
  or Clerk secret marker.
- Sign-in and wrong-organization screenshots were inspected at their original
  382-by-382 resolution. Copy, badge contrast, button reachability, spacing, and chat
  availability were intact.

## Findings

- Resolved high: restricting the shared `chrome.storage.local` area to trusted
  contexts also blocked the content script's overlay preferences and prevented the
  website agent from mounting. The retained trace identified the storage exception.
  Auth sessions moved to service-worker extension-origin IndexedDB, and the auth plus
  automatic-coverage Chromium files then passed 7/7.
- No blocker, high-, medium-, or low-severity finding remains.

## Evidence

- Focused organization/API/extension units and ordinary unit suite: 461 tests passed.
- Focused Chromium authentication, internal-boundary, and navigation journeys: 10
  passed; authentication visual review: 4 passed.
- Production dependency audit: zero reported vulnerabilities.
- Full verification: 461 deterministic tests and 82 Chromium journeys passed.
