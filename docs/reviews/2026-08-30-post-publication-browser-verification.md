# Post-Publication Browser Verification Review

Date: 2026-08-30

## Scope

Review the assistant flow after an approved GTM version is published. The expected product boundary is browser-to-Google request verification only; platform confirmation must remain unavailable.

## Automated Evidence

- Workflow-runner regressions cover completed and rollback-required state transitions from post-publication evidence.
- Navigation extension E2E covers published operation UI, **Start browser verification**, observed local Google collection request evidence, lead-form evidence posting, private form-value exclusion, and no `platform-confirmed` claim.

## Exploratory Scenarios

- Passing path: publish a versioned navigation operation, start browser verification, click the confirmed Services navigation link, and verify the assistant records `Google request verified`.
- Rollback-required path: publish a versioned operation, run the confirmed interaction without a matching single collection request or with duplicate collection requests, and verify the operation renders `rollback_required` with prior live fingerprint `live-7`.
- Adversarial page state: use attacker-shaped labels or URLs during verification and confirm durable evidence stores only the schema-normalized target identity, sanitized Google request URL, timestamps, verdict, and consent state.

## Review Evidence

`npm run verify` launched Chromium with the extension and exercised the full local fixture workflow. The passing path covered a published navigation operation, **Start browser verification**, a confirmed Services click, one observed Google collection request, durable evidence posting, and no `platform-confirmed` text. Targeted extension E2E also covered a published lead-form operation, successful Contact sales submission, `generate_lead` browser evidence posting, and exclusion of `private@example.com` from persisted evidence. Existing fixture scenarios covered missing/duplicate request verdicts, consent-limited states, and page-controlled target labels as inert text.

## Findings

No blocker or high-severity findings are known in the implemented path after full `npm run verify`.

## Remaining Review Gap

Broader privacy sentinels for hostile URLs, cookies, credentials, and raw browser errors remain a follow-up expansion.
