# Generated setup evidence exploratory review

Date: 2026-08-22

Build: `feature/generated-setup-evidence` working tree before final commit.

Environment: Playwright Chromium 1234 on Linux, unpacked extension, local fixture and API services, and no Google credentials.

## Scenarios exercised

### Navigation setup

Confirmed five navigation targets. The evidence path changed Setup generation to passed and displayed `Reviewable navigation_click setup generated`. The new download produced `gtm-observability-navigation-click.json` with one tag and one trigger, then stated that nothing was applied or published.

### Lead-form setup

Confirmed the Contact sales `generate_lead` specification in both the successful and validation fixtures. The evidence path reported `Reviewable generate_lead setup generated`; the existing download and verification journeys still completed.

### Missing measurement context

Removed the fixture measurement ID before navigation confirmation. Setup generation remained pending, explained the missing connection, and exposed no download control.

### Recognized container and managed workspace

Repeated the recognized-container demo. Setup generation passed before GTM runtime and access, and the completed managed-workspace state remained separate from browser verification and platform confirmation.

## Visual review

- `assistant-evidence-path-linux.png` now shows passed setup generation and the real download control.
- `assistant-managed-workspace-linux.png` shows generated setup, detected runtime, recognized access, and prepared workspace as four distinct facts.

## Findings

No blocker or high-severity findings remain. The new control fits the existing assistant layout and the two intentional baselines were reviewed before replacement.

## Review result

Result: passed. Downloading a generated file remains separate from applying it to GTM, browser verification, publishing, and platform confirmation.
