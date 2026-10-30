# What GTM Observability has today

Status date: 2026-08-30

GTM Observability currently turns a supported tracking intent into a confirmed tracking specification, generates a reviewable GTM setup, observes the website's GTM runtime, matches the observed container to Google access, and safely prepares one reusable managed workspace. When container-write access is enabled, the website assistant can now start the guarded backend setup operation for confirmed navigation-click and lead-form setups, render the durable operation timeline, create an immutable GTM version, publish only after exact fingerprint approval, record post-publication browser evidence, and restore the recorded prior-live version after exact rollback approval. The website assistant still does not expose autonomous rollback or platform confirmation.

## Current product workflow

```text
Open the assistant and inspect page GTM / authorized access
    -> describe the tracking intent
    -> inspect the current page
    -> highlight and confirm the target
    -> confirm the tracking specification
    -> generate a reviewable GTM setup
    -> optionally download the GTM JSON
    -> observe the website's GTM container ID
    -> match that ID to one accessible Google container
    -> create or reuse one managed workspace
    -> optionally prepare a durable GTM version
    -> optionally publish the exact approved version fingerprint
    -> optionally verify the browser-to-Google collection request
    -> if verification fails, optionally approve rollback to the exact prior live fingerprint
    -> stop before platform confirmation
```

Each evidence stage is intentionally separate. A generated setup does not mean it was applied. A detected container does not mean the connected Google account can edit it. A prepared workspace does not mean the setup passed browser verification or was published.

## What a practitioner can use

### Website assistant

The Chrome extension injects a floating assistant into the current website. It can be opened from the extension action or keyboard command, moved, resized, collapsed, and restored with its saved local preferences.

The assistant currently supports:

- A pre-chat GTM connection card with the observed page container, exact authorized
  account/container match, and effective read-only, edit, or publication capability.
- Navigation-click tracking requests.
- Lead-form tracking requests.
- Page discovery and visible candidate highlights.
- Explicit target and tracking-specification confirmation.
- Clear unsupported handoffs for interaction types that are understood but not implemented.
- An evidence path that separates intent, page inspection, target confirmation, setup generation, GTM runtime, GTM access, browser verification, and platform confirmation.
- A write-gated **Prepare GTM version** action for confirmed navigation-click and
  lead-form setup requests when one recognized container is available.
- A durable setup-operation timeline that separates planning, owned entity
  application, workspace validation, immutable version creation, and publication
  approval.
- A publication action that appears only from a versioned operation card and submits
  the exact immutable version fingerprint to the backend approval/publish route.
- A post-publication **Start browser verification** action that records whether the
  confirmed interaction produced exactly one expected Google collection request.
- A rollback action that appears only from a `rollback_required` operation and submits
  the exact prior-live fingerprint for approval-gated restoration.

The conversation classifier and state transitions are deterministic today. Model-backed conversation intake is the next product slice, but no production model currently interprets tracking intents or decides whether evidence passed.

### Navigation setup generation

After navigation targets are confirmed, the assistant generates a `navigation_click` GTM container file containing:

- One GA4 event tag.
- One link-click trigger limited to the confirmed URLs.
- Required click variables.
- The configured GA4 measurement ID.

The assistant marks Setup generation as passed only when this artifact exists and offers `Download GTM setup`. The downloaded file is named `gtm-observability-navigation-click.json`.

If the container or measurement context is missing, generation remains pending and no download is offered.

### Lead-form setup and verification

The lead-generation flow can:

- Discover and distinguish multiple forms.
- Highlight candidate forms and retain only the confirmed target.
- Propose one stable status/live region in the form's nearest semantic section as
  visible success evidence while rejecting ambiguous or ID-less candidates.
- Distinguish a submit attempt from a successful conversion outcome.
- Confirm success through a visible element, thank-you URL, data-layer event, or same-page success signal.
- Generate a `generate_lead` setup with `form_id`, `form_name`, and `page_location`.
- Download `gtm-observability-generate-lead.json`.
- Guide a browser submission and classify the observed result.

The deterministic verdict engine covers successful browser verification, expected validation failures, missing events, tags that did not fire, missing requests, missing parameters, duplicate requests, consent limitations, server errors, and insufficient observable evidence.

Browser verification remains different from platform confirmation. Seeing a GA4 request leave the browser does not prove that GA4 or Google Ads processed it.

## GTM container recognition

The extension safely inspects script URLs and reports public IDs such as `GTM-ABC123`. This establishes that the container was observed on the current page; it does not establish ownership or API access.

When the practitioner opens the assistant or explicitly refreshes its GTM connection
card, the extension reads the fixed local authorization-status endpoint. It does not
perform account discovery merely because a website loaded. If the backend is connected
and the page exposes exactly one public ID, the backend:

1. Discovers containers accessible through the connected Google account.
2. Requires one exact, case-insensitive public-ID match.
3. Reports the matching GTM account name and container name.
4. Reads the matching container, live version, and current workspaces.
5. Reports whether one managed workspace can be created or reused.

The card distinguishes local-service failure, unconfigured OAuth, disconnected Google
authorization, no page container, inaccessible IDs, and ambiguous or multiple IDs.
No match returns `not_accessible`. Multiple matches return `ambiguous`; the assistant
chooses neither. The public page ID and API-proven access remain separate claims.

The card never inspects browser cookies or infers Google identity from a browser
session. The OAuth grant does not include profile or email scope, so no email is shown.
Account and container names are strictly decoded and rendered as inert text. Opening or
refreshing the card performs read-only requests only; it never prepares a workspace,
applies a change, or publishes.

## Managed GTM workspace

Standard GTM accounts have three concurrent workspaces: the default workspace and two custom workspaces. The assistant therefore reserves at most one custom workspace named `GTM Observability` with an exact ownership marker.

`Prepare managed workspace` performs a fresh inspection and then:

- Reuses and synchronizes the existing marked workspace, or
- Creates one marked workspace when fewer than three slots are occupied.

It creates nothing when:

- All three slots are occupied and none is managed.
- The reserved name or ownership marker is conflicting.
- More than one marked workspace exists.
- The observed container is no longer uniquely accessible.
- Container writes are disabled.

Synchronization conflicts are preserved for review and are never resolved automatically. The default workspace and other people's custom workspaces are never edited or deleted.

Google integration is read-only by default. Workspace preparation requires explicit backend enablement and OAuth consent for `tagmanager.edit.containers`. Optional owner-only refresh-token persistence allows the backend to reconnect after restart without repeating browser consent; access tokens are not persisted.

## Resumable automation API

With container writes explicitly enabled, the backend can accept a navigation setup
or confirmed lead-form setup and durably advance it through managed-workspace preparation, semantic
planning, idempotent entity application, GTM Quick Preview/compiler validation, and
immutable version creation. Each transition is recorded in a file-backed operation;
an interrupted application resumes from freshly read Google state and completed action
signatures.

The website assistant exposes this orchestration only after the practitioner has
confirmed the specification, generated setup, observed exactly one GTM runtime ID,
and matched that ID to one accessible container with write access. The assistant stores
the operation ID locally for the confirmed setup and re-reads the latest operation
detail from the local workflow API when the same setup is opened again.

Interrupted operation cards can be resumed from the assistant. A partial application
shows a bounded resume state, re-reads GTM through the backend, and replaces the stale
operation card with the latest durable state. Validation failures and other blocked
states remain separate from publication and include review guidance instead of raw
Google response details.

The visible blocked-state matrix now covers managed workspace capacity, ownership
conflict, synchronization conflict, stale workspace, stale plan, inaccessible
container, validation failure, and publication-disabled responses. These states do
not create versions, publish, roll back, or claim platform confirmation.

The setup runner stops at the `versioned` state and returns `await_approval`. The
assistant displays the immutable version fingerprint and prior live fingerprint before
rendering a fingerprint-specific publish action. The publish route approves and
publishes only that exact fingerprint and remains behind its separate backend flag,
OAuth scope, approval lifetime, live-version drift check, and Google publish
confirmation.

After publication, the assistant can run browser verification for the confirmed
navigation or lead-form interaction. Passing evidence marks the operation completed
with `Google request verified`; failed evidence marks it `rollback_required` and
shows the prior live version fingerprint for explicit rollback approval. If rollback
is approved, the backend re-reads the target version and live container state, then
publishes the prior-live version with Google's fingerprint guard and records
`rolled_back`.
Platform confirmation remains unavailable because browser evidence cannot prove GA4
processing, reporting, attribution, or destination receipt.

## Evidence and diagnosis foundations

The shared domain package includes:

- Versioned tracking specifications.
- Normalized, privacy-filtered run evidence.
- Deterministic evidence-to-verdict rules.
- Explicit browser-verification and platform-confirmation boundaries.
- A scenario corpus for known successful, failing, ambiguous, consent-limited, dynamic, and cross-origin cases.
- A verified-resolution format requiring failing-before evidence, passing-after evidence, a controlled cause and corrective action, and human confirmation.
- A read-only tracking change planner that classifies supported generated entities as
  create, reuse, no-op, or conflict against freshly read managed-workspace entities.

Verified resolutions can be saved and retrieved through the API's file-backed repository. They do not currently retrain a model or modify deterministic verdict rules. Similarity retrieval, shadow-mode language evaluation, and later active learning remain separate work.

## Intake interpretation contract

The shared domain package now defines a versioned, runtime-validated contract for
non-authoritative intake interpretation. Its model-facing input allowlists bounded,
privacy-filtered messages and coarse candidate metadata; selectors, HTML, form values,
cookies, storage, credentials, and unrelated page text are rejected.

A 14-case acceptance corpus covers ordinary language, contextual references, business
wording, abbreviations, misspellings, corrections, ambiguity, missing and cross-origin
targets, unsupported interactions, instruction-shaped labels, confirmation bypasses,
and private-value redaction. Expected output may reference only supplied targets and
success evidence. It can request one short clarification, but it can never confirm a
specification, write GTM, report an evidence verdict, or claim platform receipt.

A provider-neutral domain harness can now run the corpus through injected adapters. It
validates input and deterministic baseline before execution, bounds execution with an
abort signal, validates structured provider output, and pairs accepted interpretations
with the deterministic baseline. Its privacy-safe records exclude messages, labels,
raw responses, prompts, credentials, and exception text.

No model output influences the visible assistant or deterministic workflow.

Each shadow record can now be evaluated against its corpus expectation as `pass`,
`fail`, `hard_failure`, or `inconclusive`. A pass requires all five weighted dimensions
for 100 points; schema-valid but semantically incorrect output is a fail. Invalid
provider output, private disclosure, and omitted required confirmation are hard
failures regardless of score.

Provider summaries require every corpus case exactly once and report pass, fail,
hard-failure, and inconclusive counts separately from average score, latency
percentiles, token totals, estimated cost, and usage coverage. No real provider has
been scored yet.

The backend can now run exactly two or three injected providers through the complete
corpus and atomically persist a versioned comparison report with owner-only file
permissions. It preflights provider and report configuration before execution, retains
degraded provider cases without aborting the comparison, and persists no messages,
labels, interpretations, raw responses, prompts, credentials, or exception text.

The runner is not connected to an HTTP route. A dormant OpenAI Responses API adapter
and owner-operated command can now run two or three explicitly configured models with
strict structured output, `store: false`, generic failure handling, returned-token cost
estimates, and backend-only credentials. The command is excluded from ordinary
verification and does nothing until an owner supplies compatible model IDs, current
rates, a key, and explicitly invokes its 28- or 42-request comparison.

The loopback API now exposes validated comparison evidence through protected read-only
list and detail routes. Lists contain newest-first aggregates without case rows; detail
responses contain the existing compact case outcomes and dimensions. Each request
reopens the report file, corrupted data produces one generic unavailable response, and
browser access requires the exact configured extension origin. No route can start a
model call or write a report.

Evaluation reports remain backend-only operator observability artifacts. The extension
does not request or display them, and the customer-facing assistant has no evaluation
control or report state.

## Regression and delivery harness

The repository protects the current behavior with:

- Strict TypeScript checks across every workspace.
- Deterministic domain, generator, privacy, OAuth, workspace-capacity, persistence, and scenario tests.
- Chromium workflows using an unpacked production extension and local fixture services.
- Visual baselines for stable assistant, target-highlight, evidence-path, and managed-workspace states.
- Failure screenshots and Playwright traces under `test-results/`.
- Change records, local specifications and issues, exploratory review reports, base-aware documentation checks, pull requests, GitHub CI, and merge-only completion.
- A deterministic local preflight inside ordinary verification plus a separate
  credential-safe Google configuration preflight that never prints secret values.

Ordinary verification uses fake Google responses and never consumes a real GTM workspace.

Current completion gate:

```bash
npm run verify
```

The most recent full completion run passed 292 deterministic tests across 40 files and
all 45 Chromium workflows.

## Credentialed disposable-container evidence

Credentialed Phase 1 evidence uses only disposable container `GTM-PCJ3Q5RK`
(`ConsentFlow Verification`) and disposable page `https://consentflow-psi.vercel.app/`.
No ordinary verification or CI path consumes real Google credentials.

The current real-Google lane evidence is recorded in
`docs/reviews/2026-08-31-real-google-dry-run.md`:

- Disposable dry run
  `operation_spec_disposable_form_smoke_2026_08_31_dry_run` reached `versioned`,
  validation passed, and immutable version `7` was created at fingerprint
  `1788183353134` while publication remained disabled.
- Approved publication smoke published only exact fingerprint `1788183353134`, then
  browser evidence run
  `run_spec_disposable_form_smoke_2026_08_31_dry_run_1788184399167` observed exactly
  one sanitized GA4 `generate_lead` request for `G-YV879ECLRV` with `form_id`,
  `form_name`, and page location transported through GA4's `dl` wire parameter.
- Rollback drill published distinct disposable version `8`, fingerprint
  `1788185422573`, then controlled failed browser evidence
  `run_spec_disposable_form_smoke_2026_08_31_rollback_drill_blocked_collect_1788185485815`
  moved the operation to `rollback_required`.
- Rollback was approved only for prior-live fingerprint `1788183353134`; live
  container readback confirmed version `7`, fingerprint `1788183353134`, after
  rollback completed.

Browser evidence continues to leave platform confirmation `unverified`; Phase 1 does
not claim GA4, Ads, reporting, attribution, or destination-side receipt.

## What is not built yet

The following product actions remain deliberately unimplemented or unexposed:

- Connecting the prepared workspace to a live browser Preview session.
- Exposing plan, application, validation, and version evidence in the extension UI.
- Presenting an exact version fingerprint for approval in the practitioner UI.
- Exposing approval, publication, rollback, and post-publication evidence as visible
  assistant actions or public workflow routes.
- Confirming receipt inside GA4 or Google Ads.
- Scheduled monitoring and incident alerts.
- A customer-facing model-evaluation report UI; evaluation remains backend-only.
- Production LLM-based intake or any model influence on visible conversation state.
- Retrieval from similar verified resolutions or model training.

## Next implementation boundary

The adapter, owner command, and report API are built but no real model has
been selected or scored. The next external operation is an explicit owner decision:
choose two or three Structured Outputs-compatible models, confirm current rates and the
28- or 42-request budget, inject the backend credential, and invoke the offline command:

```text
Privacy-filtered intent plus allowlisted page candidates
    -> two or three configured models propose structured interpretations
    -> shadow harness rejects unsupported or fabricated output
    -> score every result as pass, fail, hard failure, or inconclusive
    -> report accuracy, hard failures, latency, and estimated cost separately
```

The comparison remains offline and cannot affect visible intake. Verdict classification,
GTM mutation, version approval, publication, rollback, and platform claims remain
deterministic or explicitly human authorized. Evaluation remains an internal release
gate rather than a customer feature. A later feature-flagged suggestion slice can be
considered only after the corpus has no hard failures and while preserving
tracking-specification confirmation.

## Related documents

- [Managed GTM workspace workflow](../engineering/managed-gtm-workspace.md)
- [Intake interpretation contract](../engineering/intake-interpretation-contract.md)
- [Resumable non-publishing API workflow](../engineering/resumable-api-workflow.md)
- [Build stages](./build-stages.md)
- [Technical architecture](./technical-architecture.md)
- [Delivery harness](../engineering/delivery-harness.md)
- [GTM setup workflow operator runbook](../engineering/gtm-workflow-runbook.md)
- [August 24 roadmap](./2026-08-24-roadmap.md)
- [Managed-workspace specification](../../.scratch/managed-gtm-workspace/spec.md)
- [Generated setup exploratory review](../reviews/2026-08-22-generated-setup-evidence.md)
