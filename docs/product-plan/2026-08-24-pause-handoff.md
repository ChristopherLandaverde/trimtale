# MVP pause handoff

Status date: 2026-08-24

## Current outcome

The workbench now understands `track downloads` as a request to inspect existing GA4
Enhanced Measurement before proposing setup.

- Master and file-download settings on: `Already covered`; no GTM setup.
- Either setting off: name the exact coverage gap; no GTM setup.
- No exact recognized GA4 stream: no coverage claim; no GTM setup.
- Recommended next action for covered streams: verify a real supported file link later.

At this checkpoint, ConsentFlow's exact GA4 stream has the master switch and all seven
automatic features enabled.

Checkpoint `94e8892` is pushed to draft PR 49. The full gate passed 290 deterministic
tests and 51 Chromium journeys. Manual product testing is postponed by product choice;
the engineering regression and exploratory review are complete.

The ConsentFlow production playground is live at
`https://consentflow-psi.vercel.app/#measurement-playground`. Commit `dbf615d` provides
real targets for all seven Enhanced Measurement classes, including a real PDF. A
production Chromium run observed successful GA4 collection for page views, scroll,
outbound click, site search, video start, file download, form start, and form submit.

## State ownership decision

GA4 is authoritative for Enhanced Measurement. GTM and GA4 expose different controls.

```text
GA4 web-stream settings              GTM container state
  master Enhanced Measurement          Google tag present, paused, or absent
  individual automatic features        triggers and custom event tags
              |                                    |
              +-- read as GA4 coverage             +-- read as GTM runtime/setup
              |                                    |
              +---------- never auto-mirror -------+
```

Rules:

1. Read one exact GA4 stream before claiming automatic coverage.
2. Never infer a GA4 setting change from a GTM tag change.
3. Never infer a GTM edit from a GA4 setting change.
4. Change GA4 only after an explicit request, exact setting review, and approval.
5. Pausing the GTM Google tag may stop all GA4 collection; it is not equivalent to
   disabling GA4 file downloads.

This decision is recorded in the glossary and capability inventory. It does not need
an ADR because it preserves provider ownership rather than introducing a hard-to-reverse
architecture choice.

## Scope held

- Navigation remains a supported example, not the organizing product feature.
- No custom GTM download generator was added.
- No GA4 feature-toggle write was added.
- Key events, custom definitions, weekly reports, scheduled monitoring, additional LLM
  work, and MCP integration remain deferred.
- Commits remain progress checkpoints, not user-assistance checkpoints.

## Next unresolved choice

When an exact GA4 automatic feature is off, choose the supported remediation:

1. Review and change that exact GA4 feature setting.
2. Generate custom GTM as a fallback.

Current recommendation: support the exact GA4 setting review first and defer custom
GTM. This is a recommendation, not yet implementation authorization. It adds Analytics
write behavior and therefore requires a separate explicit decision.

## Resume order

1. Read this handoff.
2. Read `current-capabilities.md`.
3. Read `CONTEXT.md`.
4. Read issue 35 and commit `94e8892` for the completed download decision.
