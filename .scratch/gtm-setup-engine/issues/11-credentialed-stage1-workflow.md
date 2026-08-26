# Credentialed Stage 1 setup workflow

Delivery mode: implementation
Status: in progress

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
  URL, container ID, extension origin, and publication-locked environment.
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
- Remaining: complete the current website-agent and human Tag Assistant handoff,
  publish the reviewed immutable version, and record live verification or rollback.
