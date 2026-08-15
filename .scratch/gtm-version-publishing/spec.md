# Guarded GTM Version Publishing

## Outcome

A tracking practitioner can publish a reviewed verification-target workspace with a concise version name and factual description that make the live change understandable in GTM history.

## Version metadata

- Name: `{site} | GA4 {event} | {YYYY-MM-DD}`
- Description identifies the measurement ID, Google tag, event tag, confirmed navigation labels, trigger validation settings, and GTM Observability as the source.
- Names and descriptions are whitespace-normalized and bounded before calling Google.

## Safety boundaries

- Version creation and publishing require separate backend flags and an exact workspace allowlist.
- The request requires `approval=publish-reviewed-tracking-setup`.
- Preflight rejects an empty workspace or any merge conflict.
- A compiler error stops before publishing.
- Version creation evidence is returned if publication fails.
- Only the reviewed version fingerprint is passed to Google for publishing.

## ConsentFlow record

- Site: ConsentFlow
- Event: `navigation_click`
- Measurement ID: `G-YV879ECLRV`
- Navigation labels: Features, Contact
- Wait for Tags: off
- Check Validation: off
