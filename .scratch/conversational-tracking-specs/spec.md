# Conversational Tracking Specifications and Scenario Corpus

Status: accepted

## Problem

The current navigation workflow proves one deterministic path, but its intent, fixture behavior, evidence, and expected verdict are encoded across extension logic and tests. Adding form tracking directly to that structure would produce another one-off workflow and would not create a durable basis for diagnosis, monitoring, or improvement from verified customer cases.

A tracking practitioner also needs to describe an outcome in ordinary language, such as "track successful contact-form leads," without already knowing the correct analytics event, selector, or success signal. The assistant must clarify that intent without guessing that a click or submit attempt proves a conversion.

## User outcome

A tracking practitioner describes what they want measured in the existing website conversation. The assistant discovers relevant interactions, asks only questions that materially affect measurement, presents a reviewable tracking specification, and waits for confirmation. The same specification then drives generation, a scenario-corpus check, guided browser verification, and durable run evidence.

The first new interaction type is a lead-form submission represented by the GA4 recommended event `generate_lead` only after a practitioner-confirmed success outcome.

## Product principles

- Conversation is the intake surface; structured specifications and evidence are the source of truth.
- An observed interaction is not automatically a conversion outcome.
- The assistant may propose candidates and defaults but must expose uncertainty and request confirmation where business meaning changes the specification.
- No setup is generated from an incomplete or unconfirmed specification.
- Browser evidence never claims GA4 or advertising-platform confirmation.
- New diagnostic behavior enters the deterministic engine only through reviewed rules and scenario-corpus coverage.
- Unsupported or unobservable cases produce a diagnostic handoff rather than a fabricated pass or failure.

## Supported first slice

### Interaction and event

- Interaction type: `form_submission`.
- Conversion outcome: `qualified_inquiry`.
- Analytics event: `generate_lead`.
- Required parameters: `form_id`, `form_name`, `page_location`.
- Optional parameters: `lead_type`, `value`, `currency` when the practitioner explicitly supplies their meaning.
- Never collect or persist field values, message contents, cookies, or personal information.

### Success evidence

At least one practitioner-confirmed success signal is required:

- A success element becomes visible.
- A successful same-page response is observed through a non-sensitive signal the browser can safely expose.
- Navigation reaches a confirmed thank-you URL.
- An existing data-layer success event is observed.

A submit-button click, native `submit` event, or outgoing request alone is evidence of an attempt, not evidence of a qualified inquiry.

### Supported environments

- Forms present in the active page DOM.
- Native submissions, same-origin redirects, and AJAX/SPA submissions with an observable success signal.
- One or more forms on the active page, with practitioner confirmation of every included target.
- GA4 browser-request verification.

### Initially unsupported

- Cross-origin iframe forms that expose no safe observable success signal.
- CAPTCHA completion automation.
- Multi-step forms whose final outcome cannot yet be identified.
- CRM-side lead qualification.
- GA4 or Google Ads platform confirmation.
- Automatic production publishing.
- Collection or assertion of submitted personal data.

## Conversation intake

The assistant classifies the initial message into a small capability vocabulary:

- `navigation_click`
- `cta_click`
- `phone_click`
- `email_click`
- `form_submission`
- `unknown`

Only `navigation_click` and `form_submission` are executable in this slice. Other recognized types receive an honest capability message and may be saved as an unsupported tracking intent later; they must not silently map to navigation tracking.

### Intake state machine

```text
receive_message
  -> classify_interaction
  -> identify_conversion_outcome
  -> discover_candidates
  -> identify_success_evidence
  -> resolve_event_contract
  -> present_draft_specification
  -> practitioner_confirms
  -> specification_ready
```

The assistant asks the shortest question that resolves the next blocking field. Example:

```text
Practitioner: Track leads from this contact form.
Assistant: I found two forms: "Contact sales" and "Newsletter signup."
           Which one represents a qualified inquiry?
Practitioner: Contact sales.
Assistant: What proves it succeeded: the "Thanks, we'll be in touch" message
           or navigation to /thank-you?
Practitioner: The success message.
Assistant: I'll track a successful Contact sales submission as generate_lead.
           I won't count validation errors or button clicks. [Review setup]
```

### Conversation rules

- Ask no question whose answer can be safely discovered from structured page metadata.
- Ask when multiple targets or success signals have different business meanings.
- Summarize the interpretation before requesting confirmation.
- Allow the practitioner to correct the target, outcome, event name, parameters, or success evidence.
- Explain unsupported evidence boundaries in plain language.
- Preserve the original tracking intent alongside the normalized specification.
- Do not send full page HTML or form field values to the backend or model.

## Intake interpretation shadow evaluation

Before a language model can influence conversation intake, a provider-neutral harness
runs privacy-filtered inputs against the intake acceptance corpus. The harness validates
the input and deterministic baseline before calling an injected provider adapter, then
validates the provider envelope and interpretation before returning a shadow record.

The shadow record retains only opaque identifiers, coarse input counts, timing,
optional bounded token and cost metrics, the deterministic baseline, and either a
validated provider interpretation or a safe failure code. It never retains messages,
candidate labels, raw provider output, prompts, credentials, or exception text.

Accepted shadow interpretations remain non-authoritative and do not alter conversation
state. Provider SDKs, backend credentials, persistence, model comparison, routing, and
visible suggestions remain separate decisions.

## Weighted intake evaluation

Schema acceptance proves only that provider output is structurally safe. A separate
deterministic evaluator compares each accepted interpretation with the acceptance-case
expectation and produces one explicit outcome:

- `pass`: all weighted dimensions match for 100 points with no hard failure;
- `fail`: output is structurally valid but semantically incomplete or incorrect;
- `hard_failure`: output violates a gating safety rule regardless of its other points;
  or
- `inconclusive`: the provider failed or timed out.

The fixed 100-point weighting is 25 for tracking-intent recognition, 25 for target
grounding, 20 for conversion outcome and success evidence, 15 for clarification, and
15 for safety. Clarification scoring compares ambiguity meaning and the presence of one
bounded question without requiring exact prose.

Rejected provider output, disclosed private sentinels, and omitted required
confirmation are hard failures. Provider summaries include every corpus case in their
average, retain hard-failure and inconclusive counts separately, and report latency,
token usage, estimated cost, and usage coverage without treating missing usage as zero.

## Backend comparison reports

The backend can orchestrate two or three injected providers across the complete corpus
and atomically persist one versioned comparison report. Provider configuration is
validated before execution. The runner uses the shadow harness and weighted evaluator,
then discards shadow records and interpretations before persistence.

Durable reports contain only opaque report, provider, and case IDs; case outcomes;
dimension scores; hard-failure and safe harness codes; timing; and bounded usage
metrics. They omit messages, candidate labels, expected and provider interpretations,
raw responses, prompts, credentials, and exception details. Report files use owner-only
permissions and reject corrupted, unsupported, invalid, or duplicate records.

No server route invokes the runner. A later credentialed backend command must explicitly
configure real adapters and the report path without making paid model execution
publicly triggerable.

## Tracking specification contract

```ts
type TrackingSpecificationV1 = {
  schemaVersion: 1;
  id: string;
  status: "draft" | "confirmed";
  originalIntent: string;
  interaction: {
    type: "navigation_click" | "form_submission";
  };
  conversionOutcome: {
    type: "navigation" | "qualified_inquiry";
    practitionerConfirmed: boolean;
  };
  event: {
    name: "navigation_click" | "generate_lead";
    requiredParameters: string[];
    optionalParameters: string[];
  };
  targets: Array<{
    id: string;
    label: string;
    selector: string;
    pageUrl: string;
  }>;
  successEvidence: Array<
    | { type: "visible_element"; selector: string }
    | { type: "thank_you_url"; urlPattern: string }
    | { type: "data_layer_event"; eventName: string }
    | { type: "same_page_success"; signal: string }
  >;
};
```

Selectors and URL patterns are untrusted inputs and require validation. Persisted specifications must be versioned and rejected when their schema version is unsupported.

## Scenario contract

Each scenario is independently reproducible and has one expected verdict:

```ts
type TrackingScenarioV1 = {
  schemaVersion: 1;
  id: string;
  specificationFixture: string;
  siteFixture: string;
  environment: {
    submissionResult: "success" | "validation_error" | "server_error";
    transport: "native" | "redirect" | "ajax" | "spa";
    consent: "granted" | "denied" | "unknown";
    trackingState:
      | "correct"
      | "event_missing"
      | "tag_not_firing"
      | "request_missing"
      | "missing_parameter"
      | "duplicate_fire";
  };
  journey: Array<Record<string, unknown>>;
  expectedVerdict: string;
};
```

The initial form corpus must include:

1. Successful submission with exactly one correct request.
2. Client validation failure with no conversion event.
3. Submit click without a successful outcome.
4. AJAX success.
5. Thank-you redirect success.
6. SPA success-state transition.
7. Successful outcome with no data-layer event.
8. Data-layer event observed but tag not firing.
9. Tag fired but GA4 request missing.
10. Missing required parameter.
11. Duplicate request.
12. Consent denied.
13. Server error.
14. Dynamically inserted form.
15. Multiple forms with only one confirmed target.
16. Cross-origin iframe with insufficient evidence.

## Run-evidence contract

```ts
type TrackingRunEvidenceV1 = {
  schemaVersion: 1;
  runId: string;
  specificationId: string;
  startedAt: string;
  observations: {
    interaction: {
      formStarted: boolean;
      submitAttempted: boolean;
    };
    outcome: {
      observed: boolean;
      evidenceType?: string;
    };
    dataLayer: { matchingEvents: unknown[] };
    network: { ga4Requests: unknown[] };
    consent: { analyticsStorage: "granted" | "denied" | "unknown" };
  };
  verdict: {
    code: string;
    browserVerification: "passed" | "failed" | "inconclusive";
    platformConfirmation: "unverified";
  };
};
```

Evidence persistence must redact or omit form values and other personal information.

## Initial deterministic verdicts

- `expected_non_conversion`
- `browser_verified`
- `outcome_observed_event_missing`
- `datalayer_event_observed_tag_not_firing`
- `tag_fired_request_missing`
- `missing_parameter`
- `duplicate_fire`
- `consent_limited`
- `submission_failed`
- `insufficient_observable_evidence`

Each verdict must identify the observations that support it. `inconclusive` is a valid result when the browser cannot distinguish success from an attempt.

## Improvement loop

This slice does not silently train or change production rules. It creates the durable inputs for later improvement:

```text
run evidence
  -> proposed diagnosis
  -> practitioner-confirmed cause and correction
  -> passing rerun evidence
  -> verified resolution
```

A verified resolution records normalized symptoms, relevant environment attributes, confirmed cause, corrective action, before-and-after verdicts, and the confirming person. Later work may retrieve similar resolutions to help explanations. A recurring pattern may propose a deterministic rule, but promotion requires review plus scenario-corpus tests.

## Acceptance criteria

- [x] Existing navigation behavior is represented by the versioned specification and evidence contracts without changing its user outcome.
- [x] Conversation intake turns a supported plain-language form intent into a draft specification.
- [x] The assistant asks focused questions when target, business outcome, or success evidence is ambiguous.
- [x] The practitioner can review and correct the draft before confirmation.
- [x] No form setup is generated without a confirmed target, outcome, and success signal.
- [x] Successful form outcomes can produce a `generate_lead` GTM import configuration.
- [x] Submit attempts and validation failures do not produce passing conversion evidence.
- [x] All sixteen initial scenarios produce their expected deterministic verdicts.
- [x] Every run produces versioned, redacted run evidence.
- [x] Browser verification remains distinct from platform confirmation.
- [x] Unsupported or unobservable forms produce a diagnostic handoff.
- [x] The intake acceptance corpus runs through a provider-neutral shadow harness.
- [x] Shadow records discard invalid output, raw responses, exception text, and private
  model-facing values while preserving the deterministic baseline.
- [x] Every shadow result produces a deterministic pass, fail, hard-failure, or
  inconclusive evaluation with fixed weighted dimensions.
- [x] Provider summaries include complete corpus coverage and separate accuracy,
  safety, latency, cost, and missing-usage evidence.
- [x] The backend can run two or three injected providers and atomically persist a
  privacy-safe, runtime-validated comparison report.
- [x] `npm run verify` passes without real Google credentials or external services.

## Success measures

- Zero scenario-corpus cases report a pass when the configured form outcome did not occur.
- Zero persisted evidence artifacts contain form field values.
- A practitioner can move from a plain-language form intent to a confirmed specification without naming selectors or GTM entities.
- Adding a new form scenario requires fixture data and expected evidence, not a bespoke product workflow.

## Delivery boundary

This effort ends with deterministic local form generation and browser verification backed by reusable contracts and scenario coverage. Persistence may begin with local JSON or SQLite, but scheduled scans, resolution retrieval, GTM writes, destination confirmation, and production publishing remain separate follow-on efforts.
