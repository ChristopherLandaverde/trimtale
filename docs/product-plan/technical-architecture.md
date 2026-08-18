# Technical Architecture

## Principle

The AI component should orchestrate evidence-backed tools. It should not invent tracking state.

```text
User or scheduled scan
  -> workflow runner
  -> browser/GTM/GA4 tools
  -> evidence store
  -> rule-based verdict
  -> agent explanation and proposed action
```

Coverage should degrade into guidance rather than failure. When the extension cannot observe enough evidence on the website, it should create a diagnostic handoff in the application with the tracking intent, evidence already captured, missing evidence, and the shortest next action for the user.

## Core components

### Chrome extension

Responsibilities:

- Inspect the active page.
- Discover candidate elements.
- Capture click targets.
- Observe dataLayer activity.
- Observe analytics network requests where browser permissions allow.
- Present a bottom-corner assistant/debug panel.

### API backend

Responsibilities:

- Own workflow state.
- Generate GTM import files.
- Store tracking specs and evidence.
- Run verdict classifiers.
- Serve agent endpoints.
- Integrate with GTM, GA4, and later Google Ads.

### Playwright runner

Responsibilities:

- Replay saved journeys.
- Run scheduled scans.
- Capture traces, screenshots, console logs, requests, and verdict artifacts.
- Compare current behavior against baseline specs.

### Evidence store

Start simple with local JSON or SQLite. Move to Postgres when multi-client accounts matter.

Evidence should be structured:

```ts
type TrackingRunEvidence = {
  runId: string;
  siteId: string;
  eventName: string;
  pageUrl: string;
  startedAt: string;
  browserAction?: {
    type: "click";
    selector: string;
    text?: string;
    href?: string;
  };
  dataLayer?: {
    observed: boolean;
    matchingEvents: unknown[];
  };
  network?: {
    ga4Requests: unknown[];
    googleAdsRequests: unknown[];
    blockedRequests: unknown[];
  };
  gtm?: {
    containerId?: string;
    matchingTags: unknown[];
    matchingTriggers: unknown[];
    recentVersionChanges: unknown[];
  };
  ga4?: {
    observed: boolean;
    source?: "debug" | "realtime" | "reporting";
    matchedEvents: unknown[];
  };
  verdict: string;
  confidence: number;
};
```

### Diagnostic workspace

The website assistant and application debugger are two surfaces over the same investigation state. A handoff must not make the user repeat the original request or recollect evidence the extension already captured.

The workspace should:

- Explain which evidence is missing and why the diagnosis is inconclusive.
- Offer focused collection steps, such as connecting GTM, replaying a journey, uploading an export, or identifying the expected conversion outcome.
- Show the event timeline, dataLayer activity, destination requests, consent state, and relevant GTM configuration together.
- Let the user confirm the diagnosis and corrective action.
- Return the verified correction to the website conversation for final testing and approval.

### Improvement loop

The agent does not silently retrain or modify production rules from individual conversations. Each completed investigation can produce a verified resolution containing normalized symptoms, relevant environment attributes, the confirmed cause, corrective action, and before-and-after evidence.

Verified resolutions support three progressively stronger forms of improvement:

1. Retrieve similar cases to provide context for later investigations.
2. Suggest a reusable diagnostic rule when the same evidence pattern recurs.
3. Promote that rule into the deterministic engine only after review and scenario-corpus tests.

This creates learning from real customer cases without allowing an incorrect one-off fix to become product behavior.

## Agent logic

Use deterministic workflows first. Add an agent after tools are reliable.

A LangGraph-style workflow is the right mental model:

```text
classify_intent
  -> resolve_target
  -> observe_browser
  -> inspect_datalayer
  -> inspect_network
  -> inspect_gtm
  -> inspect_ga4
  -> classify_verdict
  -> handoff_if_inconclusive
  -> propose_fix
  -> human_approval
  -> create_draft
  -> verify_again
```

LLM-heavy nodes:

- Understanding a vague request like "check the demo button."
- Selecting likely target elements from candidates.
- Explaining evidence in plain English.
- Drafting a proposed remediation.

Deterministic nodes:

- DOM scanning.
- Network capture.
- dataLayer capture.
- GTM reads and writes.
- GA4 queries.
- Verdict classification.
- GTM JSON generation.

## Prediction engine

For Google Ads, do not claim immediate platform confirmation unless there is platform-side evidence.

Use a confidence and readiness engine:

```text
not_observed
browser_observed
gtm_observed
ads_request_sent
ads_platform_pending
likely_accepted
platform_confirmed
attribution_confirmed
```

Inputs:

- Tag fired.
- Google Ads request sent.
- Conversion ID and label match active configuration.
- Consent state allows ad storage/user data.
- Conversion linker is present.
- `gclid`, `gbraid`, or `wbraid` exists when expected.
- Enhanced conversions fields are present when expected.
- Same journey confirmed historically.

The engine should communicate probability, not certainty:

> The Google Ads request was sent and the conversion action configuration appears valid. Platform confirmation is pending. Confidence is high because this journey confirmed in the last passing scan and the current payload matches that baseline.

## Human approval

Safe production flow:

```text
diagnose
  -> propose change
  -> create import file or draft workspace
  -> verify in preview
  -> ask for approval
  -> publish remains explicit
```

The product should be trusted because it refuses to over-automate destructive changes.
