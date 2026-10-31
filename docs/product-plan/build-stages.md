# Build Stages

## Stage 0: Current wedge

The current wedge is deterministic navigation tracking:

```text
Discover navigation links
  -> confirm scope
  -> generate GTM container import file
  -> import with Merge into a new workspace
  -> connect GTM Preview
  -> perform guided browser verification
```

This should stay deterministic. Pure DOM inspection, stable selectors, scenario fixtures, and rule-based verdicts are a better foundation than an unconstrained agent.

### Success criteria

- A practitioner can create navigation click tracking in under ten minutes.
- Generated GTM JSON is ordinary and reviewable.
- The product distinguishes browser verification from GA4 or Google Ads platform confirmation.
- Every result has evidence: clicked element, expected event, observed request, missing request, or failure reason.

## Stage 1: Setup and browser verification MVP

Goal: prove the first valuable promise.

> "This interaction produced the expected analytics request."

Build:

- Navigation link discovery.
- User confirmation of included links.
- One event schema: `navigation_click`.
- Parameters: `link_text`, `link_url`, `page_location`.
- GTM import generation.
- Guided browser verification.
- Evidence artifact per run.

Do not build yet:

- A broad autonomous AI agent. Model-backed conversation intake may begin earlier when
  it returns grounded specification candidates and cannot mutate tracking state.
- Direct GTM publishing.
- Google Ads attribution confirmation.
- Broad website crawling.
- Form submissions.
- Multi-platform destination support.

## Stage 2: Saved tracking specs

Goal: turn one-time setup into a persistent system.

Build a tracking spec model:

```json
{
  "event_name": "navigation_click",
  "page_url": "https://example.com/",
  "expected_parameters": ["link_text", "link_url", "page_location"],
  "targets": [
    {
      "label": "Pricing",
      "selector": "nav a[href='/pricing']",
      "expected_url": "/pricing"
    }
  ]
}
```

This becomes the baseline used by debugging, weekly scans, and future agent tools.

## Stage 3: Debugging layer

Goal: explain the failure, not just show pass/fail.

Add rule-based verdicts:

- `selector_missing`
- `click_observed_no_datalayer_event`
- `datalayer_event_observed_tag_not_firing`
- `tag_fired_request_missing`
- `ga4_request_sent_platform_pending`
- `missing_parameter`
- `duplicate_fire`
- `consent_limited`
- `conversion_linker_missing`
- `click_id_missing`

The debugging layer should produce explanations like:

> The click happened and the `navigation_click` event was pushed, but the GA4 request was not sent. The matching GTM tag did not fire because the trigger is scoped to `/old-pricing` and the current SPA route is `/pricing`.

## Stage 4: Weekly observability scans

Goal: create retention for agencies.

Build:

- Scheduled Playwright journeys.
- Per-client tracking health report.
- Baseline comparison.
- Evidence history.
- Failure diffs.
- Email or dashboard summary.

Agency value:

> "Know when client tracking breaks before reporting day."

Weekly reports should show:

- Critical events passing.
- Newly broken events.
- Changed selectors or URLs.
- Missing parameters.
- Duplicate delivery.
- Consent or click-ID risks.
- GTM container changes since the last passing run.

## Stage 5: GTM and GA4 connectors

Goal: correlate runtime evidence with platform configuration and destination evidence.

GTM connector:

- Read accounts, containers, tags, triggers, variables, versions, and workspaces.
- Match an observed public container ID to exactly one accessible container before proposing mutation.
- Compare live container against the last passing scan.
- Reuse at most one marked managed workspace; create it only after a fresh capacity check and explicit preparation.
- Fall back to import files and planning when all three standard workspace slots are occupied.
- Never publish without explicit human approval.

GA4 connector:

- Check property access and stream configuration.
- Query recent/realtime/debug evidence where available.
- Validate event names and parameter presence.
- Reconcile delayed platform confirmation.

Keep verdicts precise:

```text
browser_verified
gtm_verified
ga4_request_sent
ga4_platform_observed
ads_request_sent
ads_platform_pending
ads_attribution_unconfirmed
```

## Stage 6: Agent UX expansion

Goal: make the deterministic system easier and more enjoyable to operate.

The agent should call existing tools. It should not be the source of truth.
Natural-language conversation intake begins during setup and verification rather than
waiting for this stage. Stage 6 expands that constrained intake into multi-tool
diagnosis, remediation, scanning, and reporting after those tools are reliable.

Supported first intents:

- "Check this event."
- "Why did this fail?"
- "Create a GTM draft fix."
- "Run the weekly scan now."
- "Summarize what changed since last week."

The agent should answer from evidence, with links to artifacts and a proposed next action.

## Stage 7: Multi-client agency platform

Goal: become the operating layer for agencies managing many client tracking stacks.

Build:

- Client/site dashboard.
- Health scores.
- Incident inbox.
- Assignment and notes.
- Weekly client-ready reports.
- Audit trail of fixes.
- Reusable journey templates.
