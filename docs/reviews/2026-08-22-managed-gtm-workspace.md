# Recognized container and managed workspace exploratory review

Date: 2026-08-22

Build: `feature/managed-gtm-workspace` working tree before final commit.

Environment: Playwright Chromium 1234 on Linux, unpacked extension from `apps/extension/dist`, local fixture and API services, and deterministic intercepted Google responses. No Google credentials or real GTM workspace were used.

## Scenarios exercised

### Runtime observation remains separate

Confirmed navigation scope on a page loading `GTM-TEST123`. The evidence path reported the public runtime ID while setup generation, Google access, browser verification, and platform confirmation remained separate states.

### Recognized container inspection

Selected `Check GTM access`. The deterministic Google boundary returned one exact accessible match named Lead site with one of three workspace slots occupied. The assistant reported the recognized container and that a managed workspace could be prepared. No preparation request occurred during inspection.

### Explicit managed workspace preparation

Selected `Prepare managed workspace`. The assistant displayed a fresh capacity/ownership check and then reported `GTM Observability prepared (2/3 slots occupied)`. Exactly one preparation request occurred. The result contained no publication claim.

### Lead-form container recognition

Confirmed a `generate_lead` tracking specification on a form page loading `GTM-TEST123`. The same evidence path reported the runtime ID and matched Lead site through `Check GTM access`. With writes disabled, it kept planning and downloads available and did not render the preparation control.

### Existing navigation state

Replayed the ordinary no-container navigation flow. Its single intentional baseline change is the new pending `GTM access` evidence row. Existing collapsed, open, navigation-scope, target-highlight, generation, runtime, browser-verification, and platform-confirmation states remained intact.

## Visual review

- `assistant-evidence-path-linux.png` separates runtime observation from Google access without changing prior evidence meanings.
- `assistant-managed-workspace-linux.png` shows the recognized container and prepared workspace, including occupied capacity and no stale action control.

## Findings

### GTM-WS-01 — Completed preparation left a stale action button

Severity: medium

Resolution: action controls now remove themselves when activated. The regenerated managed-workspace baseline contains only the completed evidence state.

No blocker or high-severity findings remain.

## Review result

Result: passed for recognized-container inspection and managed-workspace preparation. Creating tags, previewing changes, creating a version, resolving conflicts, and publishing remain explicitly out of scope for this slice.
