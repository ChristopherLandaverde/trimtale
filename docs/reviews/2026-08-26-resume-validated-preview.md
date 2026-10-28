# Validated preview resume review

Date: 2026-08-26

## Environment

- Built production extension in headed managed Chromium.
- Local deterministic API, fixture site, and verification target.
- Normal Chrome Stable authenticated to GTM workspace `7`.
- Tag Assistant connected to `GTM-PCJ3Q5RK` on the disposable ConsentFlow site.

## Scenarios

1. Restarted the website agent around a durable `validated` operation and requested
   the same confirmed lead setup.
2. Returned a malformed operation-plan response and inspected the blocked retry state.
3. Ran the exact-preview/version path on a form whose page-controlled label contained
   attacker-shaped markup.

## Observations

- The reused operation sent one resume request and restored the exact preview binding
  without offering another apply action.
- The malformed response stayed blocked with retry and download actions; it did not
  expose preview, version, or publication controls.
- Attacker-shaped text rendered inertly and did not create an image or executable DOM.
- Google Tag Assistant connected through its supported UI to workspace `7`; no
  undocumented Tag Assistant interface was automated.

## Findings

- Fixed: browser restart discarded the website agent's in-memory preview binding even
  though the validated operation persisted.
- No unresolved blocker, high-, medium-, or low-severity finding in this slice.

## Evidence

- Regression first failed because no resume request occurred, then passed after the
  extension bridge and UI continuation were added.
- `npm run verify`: 418 deterministic tests across 51 files and 71 Chromium journeys
  passed.
- Focused headed review: three Chromium scenarios passed.
- Visual trace inspection confirmed the resumed input state and malformed-response
  blocked state; the adversarial capture confirmed inert attacker text.
