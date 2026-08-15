# ConsentFlow Analytics Setup

Create the Google Analytics resources needed by the ConsentFlow verification target without requiring the tracking practitioner to leave the tracking-setup flow.

## Outcome

- The tracking practitioner selects an existing accessible Analytics account.
- The practitioner explicitly approves creation of one ordinary Analytics property and one web data stream.
- The property uses a reviewed display name, reporting time zone, and currency.
- The web data stream uses a reviewed display name and HTTPS verification-target URL.
- Google returns the web data stream and its generated measurement ID.
- The overlay selects and remembers that stream for the subsequent GTM tracking setup.

## Boundaries

- Requires the separately gated Analytics edit capability.
- Does not create or provision an Analytics account.
- Does not delete a partially created property if stream creation fails; the error identifies the retained property.
- Does not acknowledge user-data collection terms or change unrelated Analytics settings.
- Does not create a GTM version or publish a container.

## Acceptance

- Invalid account paths, names, time zones, currencies, and website URLs are rejected before calling Google.
- The API calls `properties.create` followed by `properties.dataStreams.create`.
- The response contains the created Analytics property, web data stream, and measurement ID.
- The ConsentFlow overlay can create the resources and immediately use the returned measurement ID.
- Deterministic API, UI, and end-to-end tests cover the workflow.
