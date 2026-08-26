# Stage 1 setup-engine implementation progress

This document records implementation state as of 2026-08-24. It is not a claim that
the Stage 1 customer workflow is complete.

For the authoritative future-session resume point, use
`docs/product-plan/2026-08-24-stage-1-current-handoff.md`.

## Completed foundations

- One generic GTM setup contract and compiler represent open event names, parameters,
  trigger sources, conditions, exclusions, consent, templates, Custom HTML, and
  verification expectations.
- Existing navigation and confirmed lead-form generation use the generic compiler.
- A privacy-filtered model-authoring boundary produces classified suggestions and a
  schema-valid draft without selectors, evidence, write authority, approval, or
  publication authority.
- The model provider is available through a protected backend route only when an
  explicit deployment flag, model, credential, token budget, and cost rates exist.
- Custom-code proposals expose exact code, sources, inputs, destinations, consent,
  firing scope, and positive and negative verification before compilation.
- Browser evidence can be bound to the exact setup, workspace, and GTM quick-preview
  fingerprints; changes invalidate the binding. Repair attempts preserve intent and
  are bounded.
- New durable operations stop after managed-workspace application and provider
  validation. The website agent displays the exact setup, workspace, and GTM preview
  fingerprints, guides a supported Tag Assistant handoff, and can return normalized
  browser evidence. An immutable version is created only after the backend accepts a
  passing run bound to all three fingerprints.
- GA4 Enhanced Measurement, event-scoped custom definitions and metrics, and key
  events have separate exact plans, approvals, fresh-state checks, actions, and
  receipts.
- Organization-scoped GTM web-container snapshots and change comparison exist without
  claiming website impact or inferring unverified ACLs.
- The website agent can author a known interaction through reusable scope and review
  states, explain automatic and prohibited parameters, compile the approved setup,
  and send it to the durable managed-workspace planner. The first browser-proven case
  is privacy-safe `phone_click` tracking.
- Durable tracking operations accept confirmed generic setups while the older
  navigation and form specification boundary remains available during migration.
- Chromium journeys prove the exact-preview gate for a confirmed lead form and a
  privacy-safe `phone_click`: neither path can show a version before browser evidence
  is accepted.
- A practitioner can explicitly request a model-authored alternative for one
  confirmed known interaction, review its event and parameter classifications,
  approve it separately, and send the confirmed setup through the ordinary durable
  planner without exposing private page values.
- Failed exact-preview evidence can enter a durable two-attempt repair ledger. Only a
  concrete managed-entity repair of the unchanged setup is reviewable; successful
  application and provider validation return to a new exact-preview fingerprint.
- When the separately requested GTM publication capability is enabled, chat now shows
  a dedicated immutable-version review and binds an explicit approval to its exact
  fingerprint before invoking the existing fresh-state-checked publication client.
  Controlled Chromium proves that setup approval and preview create zero publication
  calls and that only the confirmation action can reach Google-confirmed publication.

## Confirmed product boundaries

- Stage 1 supports GTM web containers and GA4 web properties/streams.
- Tagging setup happens in the website agent. The portal owns identity, durable Google
  authorization, inventory, access, change awareness, and history; it is not a tag
  editor or a required publication stop.
- Publication occurs from chat only after a human approves the displayed verified
  version fingerprint.
- Exact workspace browser testing uses a supported human-assisted Tag Assistant
  handoff. Undocumented preview-session automation is excluded.
- Custom HTML/JavaScript remains an MVP capability, but the first authoritative vendor
  example is not yet selected.

## Current gaps

- The handoff contract and evidence return are connected, but interoperability with a
  real authenticated Google workspace and Tag Assistant session still needs an
  external smoke test. Current Chromium coverage uses controlled provider responses.
- A real third-party Custom HTML example has not passed browser verification,
  versioning, approval, and publication.
- GA4 action review and approval are not yet exposed through authenticated chat.
- The signed-in multi-organization portal, identity provider, tenancy store, and
  durable history UI do not exist yet.
- Chat publication currently records an actor class rather than a signed-in portal
  user. Extension-origin protection, Google authorization, and an explicit click do
  not replace product identity or organization membership.
- Live post-publication verification and automatic entry into the existing rollback
  decision path are not yet connected to chat.
- Exact GTM ACL enumeration remains optional because Google requires the separate
  `tagmanager.manage.users` scope, which can enumerate all account users.

## Next implementation order

1. Run an authenticated real-workspace Tag Assistant smoke test and close any
   provider-integration gaps without introducing undocumented session automation.
2. Select identity and tenancy technology, bind chat approval to the signed-in user,
   and expose durable operation history in the portal.
3. Add live post-publication verification and the existing exact rollback decision.
4. Prove one authoritative third-party Custom HTML setup through the complete path.
5. Build the portal inventory surface after identity and tenancy technology are
   selected.
