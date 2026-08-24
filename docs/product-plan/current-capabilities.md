# What GTM Observability has today

Status date: 2026-08-23

GTM Observability currently maintains one site-aware agent task from supported tracking
intent through reviewable setup and verification. It observes the website's GTM
runtime, matches the observed container to Google access, guides a browser run, and can
correlate that run with an aggregate read-only GA4 Realtime count increase. A guarded
backend API can safely prepare one reusable managed workspace, durably plan and apply
navigation and confirmed lead-form setups, validate the workspace, and create an
immutable version. Separate backend clients can publish an exactly approved version
and restore its recorded prior-live version. For a confirmed lead form, the website
agent exposes plan review and an exact application confirmation through immutable
version creation. It does not expose publication approval, publication, or rollback.

## Current product workflow

```text
Open the agent and inspect page GTM / authorized access
    -> describe the tracking intent
    -> inspect the current page
    -> highlight and confirm the target
    -> confirm the tracking specification
    -> generate a reviewable GTM setup
    -> optionally prepare the managed workspace and review its change plan
    -> explicitly approve application, validation, and immutable version creation
    -> optionally download the GTM JSON
    -> use the exact pre-chat GTM container and GA4 destination context
    -> record a read-only GA4 Realtime baseline
    -> submit the guided browser run once
    -> classify the browser request independently
    -> optionally confirm an aggregate GA4 Realtime count increase
    -> stop before publication approval
```

Each evidence stage is intentionally separate. A generated setup does not mean it was
applied. A reviewed plan does not authorize writes. A created immutable version does
not mean it was published. A detected container does not mean the connected Google
account can edit it.

## What a practitioner can use

### Website agent

The Chrome extension injects a floating agent workbench into the current website. It
can be opened from the extension action or keyboard command, moved, resized, collapsed,
and restored with its saved local preferences.

The agent currently supports:

- A pre-chat GTM connection card with the observed page container, exact authorized
  account/container match, and effective read-only, edit, or publication capability.
- Navigation-click tracking requests.
- Lead-form tracking requests.
- Explicit managed-workspace preparation and safe change-plan review for a confirmed
  lead-form setup when connected GTM edit access is available.
- Exact confirmation before applying the reviewed plan, validating the workspace, and
  creating one immutable version. Publication remains separate and unavailable.
- Page discovery and visible candidate highlights.
- Explicit target and tracking-specification confirmation.
- Clear unsupported handoffs for interaction types that are understood but not implemented.
- An evidence path that separates intent, page inspection, target confirmation, setup generation, GTM runtime, GTM access, browser verification, and platform confirmation.
- Exact connected context carried into setup generation, browser verification, and
  optional aggregate GA4 Realtime confirmation without proprietary page meta tags.
- One versioned, runtime-validated agent turn containing a bounded task goal, status,
  plan, one optional question, safe actions, and action receipts.
- In-place task progress from target selection through setup approval, download,
  browser verification, and a structured final result rather than simulated streaming
  response bubbles.

The conversation classifier and state transitions are deterministic. The agent-turn
contract remains provider-neutral, but no production model interprets visible
navigation or form tasks.

### Navigation setup generation

After navigation targets are confirmed, the agent generates a `navigation_click` GTM
container file containing:

- One GA4 event tag.
- One link-click trigger limited to confirmed URLs.
- Required click variables.
- The configured GA4 measurement ID.

The agent marks Setup generation as passed only when this artifact exists and offers `Download GTM setup`. The downloaded file is named `gtm-observability-navigation-click.json`.

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
- Review, confirm, apply, validate, and create an immutable GTM version when connected
  edit access is explicitly enabled.
- Guide a browser submission and classify the observed result.

The deterministic verdict engine covers successful browser verification, expected validation failures, missing events, tags that did not fire, missing requests, missing parameters, duplicate requests, consent limitations, server errors, and insufficient observable evidence.

Browser verification remains different from platform confirmation. Seeing one complete
GA4 request leave the browser passes only the browser row. When separately enabled, the
agent records the expected event's Realtime count before the run and passes the
platform row only after the same property's aggregate count increases. The UI states
that this is before/after correlation, not user-level or event-level identity.

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
5. Returns sorted, unique GA4 measurement IDs extracted from the live version.
6. Reports whether one managed workspace can be created or reused.

The card distinguishes local-service failure, unconfigured OAuth, disconnected Google
authorization, no page container, inaccessible IDs, and ambiguous or multiple IDs.
No match returns `not_accessible`. Multiple matches return `ambiguous`; the assistant
chooses neither. The public page ID and API-proven access remain separate claims.

The card never inspects browser cookies or infers Google identity from a browser
session. The OAuth grant does not include profile or email scope, so no email is shown.
Account and container names are strictly decoded and rendered as inert text. Opening or
refreshing the card performs read-only requests only; it never prepares a workspace,
applies a change, or publishes.

## Read-only GA4 platform correlation

Analytics access is separately gated by `GOOGLE_ANALYTICS_READS_ENABLED=true` and the
least-privilege `analytics.readonly` OAuth scope. The backend uses Analytics Admin
reads to require exactly one property/data-stream match for the recognized measurement
ID. Zero and multiple matches fail closed.

For one exact web stream, the connection card also reports the master enhanced-
measurement switch and its seven automatic feature settings. It names disabled
features as coverage gaps without changing GA4 or creating duplicate GTM tags.
`npm run google -- api` enables these read-only checks from the saved local grant.

The main agent task uses that result before generation. Automatic outbound clicks make
navigation `Partially covered` and require intentional link selection. Confirmed leads
still `Need custom setup` because form starts and submits do not prove the business
outcome. No audit leaves the existing workflow unchanged.

Starting a guided run records the expected event's Realtime `eventCount` and retains an
opaque verification handle for ten minutes in bounded process memory. Confirmation is
eligible only after browser verification passes and succeeds only when a later read of
the same property/event is greater than the baseline. Equal counts remain pending and
can be retried. The state is non-durable and contains no browser cookies, form values,
submitted personal data, or event/user identity. Analytics disabled, provider access
denied, inaccessible or ambiguous destinations, expiry, and local-service failure are
distinct visible states. No Analytics or GTM write is used.

## Managed GTM workspace

Standard GTM accounts have three concurrent workspaces: the default workspace and two custom workspaces. The agent therefore reserves at most one custom workspace named `GTM Observability` with an exact ownership marker.

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

The runner stops at the `versioned` state and returns `await_approval`. The extension
exposes preparation, bounded plan review, an exact pre-write confirmation, and the
resume result through version review. Publication remains behind its separate backend
flag, OAuth scope, and exact fingerprint approval.

## Evidence and diagnosis foundations

The shared domain package includes:

- Versioned tracking specifications.
- Normalized, privacy-filtered run evidence.
- Deterministic evidence-to-verdict rules.
- Explicit browser-verification and platform-confirmation boundaries.
- A scenario corpus for known successful, failing, ambiguous, consent-limited, dynamic,
  real React SPA, and cross-origin cases.
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

The evaluation harness remains backend-only and is not a product feature. No model
output influences the visible workbench or deterministic workflow.

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

The most recent full completion run passed 278 deterministic tests across 40 files and
all 45 Chromium workflows.

## Credentialed disposable-container evidence

The first complete credentialed exercise used only disposable container
`GTM-PCJ3Q5RK`. It reused owned trigger `6` and tag `7`, validated two expected changes,
created immutable version `3`, and published fingerprint `1787458659661` after exact
approval. Prior-live version `2` remains available at fingerprint `1786828091962`.

A live Chromium signal produced exactly one correctly parameterized `generate_lead`
request. GA4 transmitted the standard `page_location` field as wire parameter `dl`;
the evidence normalizer and verdict engine now accept and privacy-filter that standard
representation. The live ConsentFlow page now contains the real
`#workflow-smoke-form` interaction. Evidence run
`run_spec_disposable_form_smoke_v3_1787493019725` observed one successful outcome,
one metadata-only event, and exactly one expected GA4 request. Its normalized verdict
was `browser_verified`, so operation `operation_spec_disposable_form_smoke_v3` is now
`completed` with no rollback required. A later connected-verification review exercised
the separately gated read-only destination check; browser evidence and aggregate
platform correlation remain independent claims.

## What is not built yet

The following product actions remain deliberately unimplemented or unexposed:

- Connecting the prepared workspace to a live browser Preview session.
- Exposing application, validation, and version evidence in the extension UI.
- Presenting an exact version fingerprint for approval in the practitioner UI.
- Exposing approval, publication, rollback, and post-publication evidence as visible
  assistant actions or public workflow routes.
- Event-level or user-level receipt identity inside GA4, and Google Ads confirmation.
- Durable platform-confirmation history beyond the bounded page-session correlation.
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
