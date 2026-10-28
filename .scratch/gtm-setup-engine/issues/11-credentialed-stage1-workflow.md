# Credentialed Stage 1 setup workflow

Delivery mode: implementation
Status: resolved

## Production outcome

One explicit command launches the built website agent, authenticated backend, and a
persistent headed Chromium profile for the disposable ConsentFlow target. GTM writes
and publication are locked to `GTM-PCJ3Q5RK`, allowing the practitioner to exercise
the current exact-preview, version-review, approval, publication, live-verification,
and rollback-ready workflow without assembling environment flags manually.

## Non-goals

- Portal identity, inventory, tenancy, or history.
- Server-side GTM or general MCP integration.
- New tracking event types or Custom HTML.
- Automating undocumented Tag Assistant interfaces.
- Running real Google mutation in ordinary CI or `npm run verify`.

## Authorization

The user explicitly asked to return to the complete tag-setup workflow, defer the
portal, build the workflow, and start implementation on 2026-08-25.

## Regression contract

- `scripts/google-session.test.ts` proves ordinary saved sessions keep publication
  disabled while the explicit Stage 1 mode enables publication and binds one valid
  GTM public ID.
- `apps/api/src/google.test.ts` proves an off-target managed-workspace mutation stops
  before any Google request.
- `apps/api/src/google-publication.test.ts` proves off-target publication and rollback
  stop before any Google request.
- `scripts/stage1-google-smoke.test.ts` proves the launcher validates the exact target
  URL, container ID, GA4 destination, extension origin, and publication-locked
  environment.
- `tests/e2e/conversational-form.spec.ts` proves a browser restart resumes one reused
  validated operation into its exact preview binding without repeating application.
- The real integration lane remains credential-gated and records its exploratory
  evidence under `docs/reviews/`; it never runs in `npm run verify`.

## Dependencies

- Issue 06 exact-preview evidence and version gate.
- Issue 09 exact-version approval and publication boundary.

## Progress

- 2026-08-25: Added the explicit launcher and public-ID mutation lock. The focused 38
  tests and repository typecheck pass.
- 2026-08-25: Credentialed read-only recognition matched the exact disposable
  container, live version, GA4 destination, and available workspace capacity.
- 2026-08-25: The headed launcher matched the configured extension, website origin,
  and sole observed GTM ID without making a Google mutation.
- 2026-08-26: Tightened the credentialed launcher from an origin-only page check to
  the exact ConsentFlow path and query. Same-origin alternate and attacker-query URLs
  now stop before the session reaches its ready state.
- 2026-08-26: The launcher now overrides inherited Analytics-write enablement to
  `false`, keeping the credentialed exercise within its GTM workspace and publication
  authority even when the parent shell was used for a separate GA4 session.
- 2026-08-26: Added a fresh read-only recognition gate before the launcher announces
  readiness. Inaccessible or ambiguous container state, write-capability mismatch, or
  any GA4 destination other than `G-YV879ECLRV` now stops the session.
- 2026-08-26: The saved authenticated session passed the new GET-only gate against
  current Google state for `GTM-PCJ3Q5RK` and `G-YV879ECLRV`; the backend was then
  stopped without a workspace, version, publication, rollback, or GA4 mutation.
- 2026-08-26: Bound launcher readiness to a fresh per-run API session identity. A
  stale service on the local port can no longer satisfy the launcher health gate.
- 2026-08-26: Completed the exact website target comparison by rejecting unexpected
  URL fragments as well as origin, path, and query mismatches.
- 2026-08-26: Restricted observed container evidence to the official HTTPS Google Tag
  Manager loader origin and exact `/gtm.js` path. Attacker-owned lookalike script URLs
  no longer satisfy the launcher gate.
- 2026-08-26: An authorized fresh session reached the exact target and confirmed the
  persisted plan is blocked before mutation: trigger `9` is reusable, managed tag `7`
  needs explicit replacement approval, and `Page URL` needs no change. The session
  closed without a Google write. Issue 17 proposes the required separately authorized
  replacement-review slice.
- 2026-08-26: Issue 17 added the exact managed-replacement review. Its live review
  showed that tag `7` already matched the proposed behavior; Google's current entity
  omitted only the generated empty `blockingTriggerId` list. No replacement was
  approved. Issue 18 now normalizes that provider default.
- 2026-08-26: A fresh credentialed plan `plan_2467c6743d5e` reported zero changes:
  reuse trigger `9`, reuse tag `7`, and no change to Page URL. Application completed
  with no entity writes, provider validation passed, and the durable operation reached
  `validated` with setup `setup_7573af95969d`, workspace `1787767985454`, and exact
  GTM preview `1787786615309`.
- 2026-08-26: Normal Chrome Stable signed into workspace `7`, and the supported Google
  UI connected Tag Assistant to the disposable ConsentFlow site for
  `GTM-PCJ3Q5RK`. The browser switch exposed and fixed rejected continuation of a
  durable validated operation; its exact preview binding now rehydrates without
  another apply action.
- 2026-08-26: The first real form run exposed a hidden-to-visible success-element
  compiler defect and stopped without creating a version. Issue 19's initial
  one-field repair passed provider validation but failed a fresh Tag Assistant run.
  The rendered GTM editor then exposed the full canonical parameter contract, now
  covered by a failing-first regression. No version was created.
- 2026-08-26: Canonical preview `1787793264804` passed the real exact browser run:
  Tag Assistant emitted Element Visibility, fired the managed `generate_lead` tag,
  and the operation bound one-request evidence. Version creation then failed closed
  because its fresh validation rotated the quick-preview fingerprint. Issue 20 owns
  that gate; nothing was versioned or published.
- 2026-08-26: Issue 20 preserved the exact preview while rechecking workspace and
  managed-entity state. The full gate passed, and the credentialed workflow created
  immutable version `5` without changing live version `3`.
- 2026-08-26: Version `5` was explicitly published for live review, then safely rolled
  back to version `3` after one automatic `form_start` request plus one
  `generate_lead` request was misclassified as duplicate delivery. Issue 21 owns that
  failing-first classifier correction; no failed version remains live.
- 2026-08-26: Fresh exact preview `1787798374219` passed with
  `gtm.elementVisibility`, one complete `generate_lead` request, and no private form
  value. Google created immutable version `6` (`1787798811643`) from the verified
  draft. Reloading the page restored the version review without another apply action.
- 2026-08-26: The user approved exact fingerprint `1787798811643`. Google confirmed
  publication at `2026-08-27T02:52:00.426Z`. After stopping Preview and clearing the
  debug cookie, the clean canonical site rehydrated the published operation and
  produced one complete live `generate_lead` request. Run `run_form_1787799218426`
  completed the operation; rollback remained locked and unused.
