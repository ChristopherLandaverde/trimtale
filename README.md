# GTM Observability

An intelligent creation, testing, and observability layer for Google Tag Manager.

This project does not replace GTM. GTM remains the configuration, execution, versioning, environment, and publishing layer. This product connects GTM configuration evidence with browser-runtime evidence so teams can detect broken tracking, understand why it broke, test corrections, and deploy verified GTM changes.

## Product promise

Describe what should be tracked. The system tests the real user journey, explains failures, generates a GTM draft, and continuously verifies that tracking still works.

## Core workflow

```text
Connect GTM
    -> Audit configuration
    -> Observe dataLayer and network behavior
    -> Record or generate Playwright journeys
    -> Monitor continuously
    -> Diagnose incidents
    -> Generate and test corrections
    -> Create a reviewable GTM workspace
    -> Deploy with human approval
```

## GTM API responsibilities

- Read accounts, containers, workspaces, versions, tags, triggers, and variables.
- Audit the live container and compare versions.
- Create isolated workspaces and apply changes.
- Check synchronization and compiler errors.
- Create container versions and target environments.
- Publish only with an explicit approval workflow.

## Product-owned responsibilities

- Capture data-layer events and property schemas.
- Observe analytics network requests.
- Run synthetic user journeys with Playwright.
- Decode and validate destination payloads.
- Monitor schema drift, missing events, and duplicate delivery.
- Correlate runtime failures with GTM configuration changes.
- Explain incidents and verify proposed corrections.

## Initial MVP

1. Browser-based Tracking Check without requiring GTM access.
2. Read-only GTM connection and container audit.
3. Scheduled Playwright journey monitoring.
4. Evidence-backed incident diagnosis.
5. Verified GTM workspace creation without automatic production publishing.

## Mockups

The `mockups/` directory contains the observability overview, container audit, live debugger, automated test, scheduled journeys, incident diagnosis, and GTM change-review screens.

## Navigation tracking MVP

The first implemented vertical slice is a Chrome extension plus a small local backend:

```text
Discover navigation
    -> confirm scope
    -> generate a partial GTM container file
    -> import with Merge into a new workspace
    -> connect GTM Preview
    -> perform guided browser verification
```

The implementation deliberately distinguishes browser verification from GA4 platform confirmation. See [the feature specification](.scratch/navigation-tracking/spec.md) for the supported path and exclusions.

### Development

Requirements: Node.js 22+ and npm 10+.

```bash
npm install
npm run verify
```

`npm run verify` is the agent-owned completion gate. It:

- Runs strict TypeScript checks.
- Runs the deterministic scenario corpus.
- Builds the backend, fixture site, shared package, and extension.
- Starts the local services.
- Launches Playwright's managed Chromium with the extension preloaded.
- Exercises discovery, generation, download validation, and guided browser verification.
- Saves Playwright traces and failure evidence under `test-results/`.

Humans do not need to launch the development services or load the extension to verify changes. Manual Chrome loading is reserved for exploratory product review.
