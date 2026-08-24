# MVP build handoff

Status date: 2026-08-23

This is the starting point for the next session. It records the current product
boundary, retained code, removed scope, and the next decision.

## MVP outcome

A tracking practitioner can use one website workbench to turn a plain-language lead
form or navigation intent into a confirmed GA4 event setup, move it into one managed
GTM workspace, and verify the browser result.

The MVP is finished when this works quickly across supported static, dynamic, and SPA
sites. GTM publication may remain a separate manual approval.

Deferred:

- GA4 key events and custom definitions.
- Weekly reports and scheduled monitoring.
- Broader diagnosis and verified-resolution retrieval.
- Additional model evaluation or training.
- Automatic publication.

## Current system

```text
Website
  -> extension content script: inspect, converse, select, review, verify
  -> extension service worker: trusted local API bridge
  -> backend: Google access, durable operation, GA4 reads
  -> shared core: specifications, generation, plans, verdicts
  -> GTM / GA4
```

| Layer | Working responsibility | Main code |
| --- | --- | --- |
| Shared core | Tracking specifications, GTM generation, deterministic verdicts, change plans, durable operation states | `packages/core/src/` |
| Website workbench | Page discovery, target selection, setup approval, plan review, browser evidence | `apps/extension/src/content-script.ts` |
| Extension bridge | Bounded backend requests and strict response filtering | `apps/extension/src/service-worker.ts` |
| Backend | OAuth, container recognition, managed workspace, application, validation, versioning, publication guards, GA4 Realtime reads | `apps/api/src/` |
| Test sites | Static, AJAX, redirect, dynamic, SPA-like, ambiguous, failure, consent, and cross-origin scenarios | `apps/fixture-site/`, `apps/verification-target/` |
| Product regressions | Core contracts and full built-extension journeys | `packages/core/src/*.test.ts`, `tests/e2e/` |

## What the branch added

### Connected verification evidence

- Matches one observed GTM public ID to one accessible container.
- Carries the exact GA4 measurement destination through the task.
- Separates browser request evidence from optional aggregate GA4 Realtime correlation.
- Never claims event-level or user-level GA4 identity.

Primary code: `apps/api/src/analytics.ts`, extension content/service-worker bridges, and
`tests/e2e/connected-verification-evidence.spec.ts`.

### Site-aware agent workbench

- Replaced simulated chat streaming with one persistent agent task.
- Shows goal, plan, action receipts, next decision, blockers, and result in place.
- Keeps specifications, tool results, verdicts, and approvals authoritative; prose is
  not authoritative.

Primary code: `packages/core/src/agent-turn.ts` and
`apps/extension/src/content-script.ts`.

### Navigation scope reduction

The branch originally added semantic grouping, a local Ollama adapter, automatic
preview, and a 32-case navigation-only corpus. Those additions were removed after the
product owner identified that navigation was an example, not the MVP priority.

Basic direct navigation selection, GTM setup generation, download, workspace
preparation, and browser verification remain.

### Lead-form operation-plan bridge

- Adds `Prepare workspace & plan` after a connected `generate_lead` setup is approved.
- Calls the existing durable workflow planner through the extension service worker.
- Shows only bounded action names and states.
- Makes no resume, application, version, or publication request.
- Rejects invalid or authority-escalating responses.

Primary code: `planFormWorkflow` in the content script, the
`GTM_WORKFLOW_PLAN_REQUEST` bridge, and the two operation-plan browser regressions.

## Supported lead-form path

```text
Recognize exact GTM + GA4 context
  -> describe lead intent
  -> discover and confirm form
  -> confirm successful outcome evidence
  -> approve generate_lead specification
  -> generate GTM setup
  -> optionally prepare workspace and review durable plan
  -> optionally run browser verification
  -> optionally correlate an aggregate GA4 Realtime increase
```

The workbench stops before plan application.

## Backend capability not yet exposed

The backend already supports:

```text
plan
  -> apply managed entities idempotently
  -> validate with GTM Quick Preview/compiler checks
  -> create immutable GTM version
  -> stop for publication approval
```

`POST /api/google/workflows/:id/resume` performs all three steps—application,
validation, and version creation. It is not an apply-only endpoint. Publication and
rollback remain separate, guarded operations.

## Safety boundaries

- Model evaluations are backend-only and have no visible workflow authority.
- Deterministic code creates selectors, GTM entities, plans, and verdicts.
- The website never receives credentials, raw Google responses, selectors from model
  output, form values, or private error text.
- A public GTM ID is not treated as authenticated access.
- Only marked managed entities may be updated automatically.
- Planning is not application; browser evidence is not GA4 confirmation; versioning
  is not publication.

## Scope audit

The semantic-navigation commits added about 3,825 lines across code, tests, docs, and
images. That was too much investment for an example used to explore agent decisions.
The semantic runtime, Ollama adapter, corpus, preview workflow, ADR, and supporting
documents were removed. Basic navigation remains.

The connected-evidence and workbench foundations remain useful to the MVP. An LLM is
not a repair mechanism for broken deterministic code. No MCP connection is required
for the current setup workflow.

## Honest gaps

- The workbench cannot yet apply its reviewed plan.
- Existing `resume` semantics combine apply, validation, and version creation.
- Ordinary verification mocks Google; a disposable credentialed GTM journey remains
  necessary before claiming production readiness.
- The fixture corpus simulates dynamic and SPA behavior but does not prove a real React
  application integration.
- Enhanced-measurement coverage beyond current form and navigation behavior is not
  complete.
- A browser run before the new plan is applied can verify existing tracking, not prove
  that the reviewed plan works.

## Next decision

Choose one implementation slice:

1. Expose the existing resume operation as `Apply, validate & create version`, with an
   exact approval checkpoint and no publication.
2. Split the backend so the workbench can apply only, then validate and version through
   later approvals.

For the fastest MVP, choose option 1. It reuses tested backend behavior and still stops
before publication. Option 2 adds workflow states, API behavior, and regressions.

Do not begin Enhanced Measurement expansion, reporting, MCP integration, or more model
work before this decision is resolved.

## Verification checkpoint

After semantic-navigation removal, `npm run verify` passed:

- 273 deterministic tests across 39 files.
- 38 Chromium journeys.
- Strict checks and all builds.
- 41 valid change records, including the retained superseded history.

No real Google mutation is part of the ordinary gate.

## Next-session reading order

1. This handoff.
2. `docs/product-plan/current-capabilities.md` for the full behavior inventory.
3. `CONTEXT.md` for canonical product language.
4. `.scratch/conversational-tracking-specs/issues/26-trim-semantic-navigation.md` for
   the latest scope decision.

The older August 24 roadmap is historical context, not the active priority list.
