# Stage 1 GTM setup-engine current handoff

Status: current
Status date: 2026-08-26
Supersedes: `docs/product-plan/2026-08-24-pause-handoff.md`

## Start here

Stage 1 is a GTM and GA4 web-container setup engine for agencies and client operators.
Its product objective is to reduce **time to verified setup**, not merely generate a
tag or expose Google APIs through chat.

The practitioner describes the desired measurement behavior from the website being
configured. The website agent inspects the page and connected Google context, creates
a reviewable setup, applies an approved change plan to one managed workspace, guides
browser verification of that exact draft, creates one immutable version, and—after a
separate human approval—can publish that exact version from chat.

The signed-in control portal is intentionally not a tag editor. It will own product
identity, organizations, durable Google authorization, accessible-container inventory,
access, change awareness, and operation history. It is not intended to become a
mandatory detour during setup or publication.

## Confirmed product boundaries

- MVP provider scope: GTM web containers and GA4 web properties/streams.
- Ultimate customer: agencies; a client operator or customer-success manager should
  be able to complete professional setup without becoming a GTM specialist.
- Setup surface: the website agent, using natural language plus observed page and
  connected-container context.
- Portal surface: sign-in, connections, inventory, access, change awareness, and
  durable history—not tag authoring.
- Publication: available from chat only after separate human review of the displayed
  verified-version fingerprint.
- Custom HTML/JavaScript: an MVP capability, subject to explicit code, destination,
  input, consent, scope, approval, and verification policy.
- Later stages—standalone debugging and scheduled observability—do not enter Stage 1.

## Implemented in the current workspace

### Generic setup engine

- A generic tracking-setup contract represents open event names, parameter mappings,
  trigger sources, include/exclude conditions, frequency, consent, templates, Custom
  HTML, and positive/negative verification expectations.
- The deterministic compiler produces GTM tags, triggers, variables, and reviewable
  container exports from that contract.
- Existing navigation and confirmed lead-form generation use the generic compiler.
- A privacy-filtered model-authoring boundary can propose schema-valid drafts and
  classified suggestions but cannot supply selectors, evidence, approval, provider
  authority, or publication authority.
- For a confirmed known interaction, chat can explicitly request a model-authored
  alternative, show its event, configured provider, rationale, and parameter
  classifications, require separate setup approval, and send the confirmed setup
  through the ordinary durable planner. Private interaction values and arbitrary page
  text remain excluded.
- A known interaction registry and reusable scope/review states produce privacy-safe
  `phone_click`, `email_click`, `outbound_click`, and `file_download` setups without creating a
  product branch for each event. Exact-stream Enhanced Measurement suppresses
  duplicate outbound and download setup when those features are already enabled.
- Automatically resolved forms receive a confirmed page marker before review. Known
  phone, email, outbound, and download links receive local-only candidate markers that
  become confirmed after the practitioner selects scope; their values never cross the
  extension message boundary.
- Page-view, scroll, site-search, and video-engagement requests reuse exact-stream
  Enhanced Measurement state as coverage-only decisions. They report covered, exact
  gap, or unavailable states and never generate fallback GTM setup.
- The website agent keeps connected context, page markers, action receipts, and concise
  browser/platform results visible without duplicating them in an internal multi-stage
  Evidence path.

### Exact preview and version gate

New managed operations follow this authority order:

```text
planned
  -> applying
  -> applied
  -> validated
  -> exact draft preview required
  -> draft_verified
  -> versioned
  -> publication approval required
  -> approved
  -> published
  -> live verification required
```

- Application and GTM compiler validation stop at `validated`; no immutable version
  exists yet.
- Chat displays the setup, managed-workspace, and GTM quick-preview fingerprints and
  guides a supported human-assisted Tag Assistant handoff.
- Passing browser evidence is accepted only when it belongs to the same operation and
  binds to all three fingerprints.
- Version creation revalidates provider state. If a new quick-preview fingerprint no
  longer matches the browser-verified preview, version creation stops.
- Controlled Chromium journeys prove this order for a successful lead form and a
  privacy-safe phone click.
- Failed exact evidence can enter a durable two-attempt repair ledger. The runner
  re-plans only the unchanged approved setup, exposes a concrete managed-entity create
  or update for separate review, and stops on ambiguity or exhaustion. A successful
  repair is provider-validated and returns new workspace and preview fingerprints;
  another exact browser run remains mandatory before version creation.

### Exact publication from chat

- Publication controls appear only when the separately requested Google publication
  scope and backend enablement are active.
- Chat presents a dedicated publication review containing the exact immutable version
  fingerprint, live effect, and post-publication obligation.
- The final confirmation sends only the operation identity and reviewed fingerprint
  through the extension boundary.
- The backend records a short-lived approval for that fingerprint. The Google client
  rereads the immutable version and prior live version before publishing.
- Setup approval, workspace application, compiler validation, browser verification,
  and version creation make zero publication calls.
- Stale fingerprints, live drift, expired approval, disabled publication, malformed
  responses, and provider failure do not produce a publication-success claim.
- After publication, the same confirmed browser interaction produces live evidence
  bound to the published fingerprint. Passing evidence completes the operation;
  failed evidence unlocks a separately reviewed exact prior-version rollback.
  Inconclusive evidence keeps rollback locked and remains retryable.

### GA4 and deferred portal foundations

- Enhanced Measurement audit and enablement preserve GA4 stream ownership separately
  from GTM state.
- Event-scoped custom definitions, metrics, and key events have separate exact plans,
  approvals, fresh-state checks, actions, and receipts at the core/provider boundary.
- Organization-scoped GTM web-container snapshots and configuration-change comparison
  exist as foundations; they do not infer website impact or unverified ACLs. Portal
  product work is deferred until the real setup journey is easy and complete.

## Evidence and authority ladder

| State | What it proves | What it does not authorize |
|---|---|---|
| Generated setup | A schema-valid, reviewable configuration exists | GTM writes, browser success, versioning, publication |
| Ready change plan | Exact intended creates/reuse/no-ops/conflicts are known | Workspace mutation |
| Validated workspace | Managed entities match and GTM quick preview compiles | Browser behavior or version creation under the exact-preview policy |
| Verified draft | Passing browser evidence matches setup, workspace, and preview fingerprints | Publication |
| Verified version | One immutable version was created from the verified draft | Making it live |
| Publication approval | One human authorized the displayed version fingerprint for a short window | Any other version or changed live state |
| Published | Google confirmed that exact fingerprint was published | Successful live behavior, reporting, or attribution |

## Browser-verification distinction discovered during review

Two browser checks have different meanings and must remain visibly separate:

1. **Exact draft preview** belongs to a durable managed operation. A passing run can
   advance that operation to immutable version creation.
2. **Already-installed setup check** tests configuration installed outside the current
   operation. It can report browser evidence but cannot create an operation or version.

The UI previously offered generic **Start verification** beside **Prepare workspace &
plan**. Choosing it produced valid browser evidence but stopped because no managed
operation existed to version. The managed-write path now removes that action. When
managed planning is unavailable, the manual path is labeled **Verify already-installed
setup**. After downloading an import file, the same explicit label is used.

Permanent Chromium coverage asserts that the managed setup screen does not expose the
already-installed verification action and that the exact managed path continues
through preview, version, approval, and publication.

## Safe interactive demo

Run:

```bash
npm run demo:stage1
```

This builds the current branch, opens an isolated headed Chromium profile with the
production extension, and serves a clearly labeled controlled demo. No Google
workspace or live container is changed.

Suggested flow:

1. Ask `Track successful submissions of this form`.
2. Review and approve the setup.
3. Choose **Prepare workspace & plan**.
4. Apply and validate the draft.
5. Confirm the UI says no immutable version exists.
6. Start the exact browser run and submit the demo form.
7. Review the created version.
8. Approve and publish the controlled demo fingerprint.

The demo uses deterministic form outcome and collection evidence so exploratory review
is about product state and authority checkpoints rather than external availability.

## What has not been proven

- The supported handoff has not been exercised end to end against a real authenticated
  GTM workspace and Tag Assistant browser session.
- No real Google container version was published during controlled Chromium review.
- Chat publication currently records the actor class `website_chat_human`, not a
  signed-in product user or verified organization membership.
- Portal identity, tenancy, inventory UI, and durable cross-surface history do not yet
  exist.
- No authoritative third-party Custom HTML integration has completed the full path.
- GA4 custom-definition and key-event actions are not exposed through authenticated
  chat.

Controlled provider responses prove product sequencing and fail-closed behavior. They
are not evidence of real Google interoperability, personal identity, GA4 reporting, or
attribution.

## Verification baseline

Current working-tree baseline:

- `npm run verify` passes.
- 411 deterministic tests pass across 51 test files.
- 64 Playwright Chromium journeys pass.
- All workspace typechecks and preflight checks pass; 74 change records validate.

## Recommended next implementation order

1. Run a real authenticated GTM/Tag Assistant smoke test against a disposable web
   container without undocumented session automation.
2. Prove one authoritative third-party Custom HTML setup through the complete path.
3. After the setup path is easy and complete, select portal identity and tenancy
   technology and bind publication approval to signed-in organization membership.
4. Expose durable setup, version, approval, publication, and rollback history in the
   portal.

## Resume checklist for a future session

1. Read this handoff, `CONTEXT.md`, and ADRs 0001–0003.
2. Read `.scratch/gtm-setup-engine/spec.md` and Issues 06, 08, and 09.
3. Inspect `git status --short`. The current work is intentionally uncommitted; do not
   discard or overwrite unrelated changes.
4. Run `npm run verify` before extending authority-sensitive code.
5. Use `npm run demo:stage1` for visible product review.
6. Preserve the distinctions in the evidence ladder; never collapse setup approval,
   exact draft evidence, version review, publication approval, and live verification.

## Primary implementation entry points

- `packages/core/src/setup-contract.ts` — generic setup language and validation.
- `packages/core/src/setup-compiler.ts` — deterministic GTM entity compilation.
- `packages/core/src/draft-verification.ts` — exact fingerprint-bound browser evidence.
- `packages/core/src/tracking-operation.ts` — durable state and authority requirements.
- `packages/core/src/publication.ts` — short-lived exact-version approval and evidence
  decisions.
- `apps/api/src/workflow-runner.ts` — resumable managed operation orchestration.
- `apps/api/src/google.ts` — GTM fresh-state, version, publication, and rollback client.
- `apps/api/src/server.ts` — protected workflow, evidence, approval, and publish routes.
- `apps/extension/src/service-worker.ts` — sanitized website-agent/API bridge.
- `apps/extension/src/content-script.ts` — website-agent review, preview, evidence,
  version, and publication experience.
- `scripts/stage1-interactive-demo.mjs` — safe visible Chromium handoff.
- `tests/e2e/conversational-form.spec.ts` and
  `tests/e2e/conversation-intake.spec.ts` — end-to-end authority and privacy journeys.
