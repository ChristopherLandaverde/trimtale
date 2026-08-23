# What GTM Observability has today

Status date: 2026-08-23

GTM Observability currently turns a supported tracking intent into a confirmed tracking specification, generates a reviewable GTM setup, observes the website's GTM runtime, matches the observed container to Google access, and safely prepares one reusable managed workspace. A guarded backend API can durably plan and apply navigation and confirmed lead-form setups, validate the workspace, and create an immutable version. Separate backend clients can publish an exactly approved version and restore its recorded prior-live version. The website assistant does not yet expose those orchestration, approval, publication, or rollback actions.

## Current product workflow

```text
Describe the tracking intent
    -> inspect the current page
    -> highlight and confirm the target
    -> confirm the tracking specification
    -> generate a reviewable GTM setup
    -> optionally download the GTM JSON
    -> observe the website's GTM container ID
    -> match that ID to one accessible Google container
    -> create or reuse one managed workspace
    -> stop before applying or publishing changes
```

Each evidence stage is intentionally separate. A generated setup does not mean it was applied. A detected container does not mean the connected Google account can edit it. A prepared workspace does not mean the setup passed browser verification or was published.

## What a practitioner can use

### Website assistant

The Chrome extension injects a floating assistant into the current website. It can be opened from the extension action or keyboard command, moved, resized, collapsed, and restored with its saved local preferences.

The assistant currently supports:

- Navigation-click tracking requests.
- Lead-form tracking requests.
- Page discovery and visible candidate highlights.
- Explicit target and tracking-specification confirmation.
- Clear unsupported handoffs for interaction types that are understood but not implemented.
- An evidence path that separates intent, page inspection, target confirmation, setup generation, GTM runtime, GTM access, browser verification, and platform confirmation.

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
- Distinguish a submit attempt from a successful conversion outcome.
- Confirm success through a visible element, thank-you URL, data-layer event, or same-page success signal.
- Generate a `generate_lead` setup with `form_id`, `form_name`, and `page_location`.
- Download `gtm-observability-generate-lead.json`.
- Guide a browser submission and classify the observed result.

The deterministic verdict engine covers successful browser verification, expected validation failures, missing events, tags that did not fire, missing requests, missing parameters, duplicate requests, consent limitations, server errors, and insufficient observable evidence.

Browser verification remains different from platform confirmation. Seeing a GA4 request leave the browser does not prove that GA4 or Google Ads processed it.

## GTM container recognition

The extension safely inspects script URLs and reports public IDs such as `GTM-ABC123`. This establishes that the container was observed on the current page; it does not establish ownership or API access.

When the practitioner chooses `Check GTM access`, the backend:

1. Discovers containers accessible through the connected Google account.
2. Requires one exact, case-insensitive public-ID match.
3. Reads the matching container, live version, and current workspaces.
4. Reports whether one managed workspace can be created or reused.

No match returns `not_accessible`. Multiple matches return `ambiguous`; the assistant chooses neither.

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

The runner stops at the `versioned` state and returns `await_approval`. The extension
does not yet expose this orchestration in its visible conversation. Publication remains
behind its separate backend flag, OAuth scope, and exact fingerprint approval.

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

The most recent full completion run passed 205 deterministic tests across 30 files and
all 26 Chromium workflows.

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
`completed` with no rollback required. Browser evidence continues to leave platform
confirmation unverified.

## What is not built yet

The following product actions remain deliberately unimplemented or unexposed:

- Connecting the prepared workspace to a live browser Preview session.
- Exposing plan, application, validation, and version evidence in the extension UI.
- Presenting an exact version fingerprint for approval in the practitioner UI.
- Exposing approval, publication, rollback, and post-publication evidence as visible
  assistant actions or public workflow routes.
- Confirming receipt inside GA4 or Google Ads.
- Scheduled monitoring and incident alerts.
- LLM-based intake, retrieval from similar verified resolutions, or model training.

## Next implementation boundary

The next safe product slice makes conversation intake the natural-language front door
without giving a model execution authority:

```text
Everyday tracking intent plus current-page context
    -> model proposes a structured interpretation and candidate references
    -> deterministic contracts reject unsupported or fabricated candidates
    -> ask the shortest question that changes the specification
    -> practitioner confirms the tracking specification
    -> existing deterministic setup operation executes it
```

Models begin in shadow mode and are evaluated against the scenario corpus before they
affect the visible intake. Verdict classification, GTM mutation, version approval,
publication, rollback, and platform claims remain deterministic or explicitly human
authorized. The following UI slice will display the existing plan, validation, and
immutable fingerprint and collect exact publication approval in the assistant.

## Related documents

- [Managed GTM workspace workflow](../engineering/managed-gtm-workspace.md)
- [Resumable non-publishing API workflow](../engineering/resumable-api-workflow.md)
- [Build stages](./build-stages.md)
- [Technical architecture](./technical-architecture.md)
- [Delivery harness](../engineering/delivery-harness.md)
- [GTM setup workflow operator runbook](../engineering/gtm-workflow-runbook.md)
- [August 24 roadmap](./2026-08-24-roadmap.md)
- [Managed-workspace specification](../../.scratch/managed-gtm-workspace/spec.md)
- [Generated setup exploratory review](../reviews/2026-08-22-generated-setup-evidence.md)
