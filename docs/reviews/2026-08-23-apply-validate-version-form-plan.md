# Form application and version review

Date: 2026-08-23

## Environment

- Production extension build loaded unpacked in managed Chromium.
- Static lead-form fixture with strict mocked Google workflow boundaries.
- 380px website workbench; no real Google mutation or publication.

## Scenarios reviewed

### Exact application confirmation

Approved the Contact sales `generate_lead` setup and reviewed two planned creations.
`Apply, validate & create version` opened a separate checkpoint naming container
writes, validation, immutable version creation, and the no-publication boundary. The
resume request count remained zero until `Confirm apply & create version` was chosen.

### Versioned result

The confirmed action made one bodyless resume request for the reviewed operation. The
task showed application completed, validation passed, immutable version `version-8`
created, and publication not started. The separate publication-approval boundary was
visible and no approval, publish, or rollback request occurred.

### Authority-escalating response

Repeated the flow with a response claiming `published` and containing a private raw
sentinel. The extension rejected it, showed a generic blocker and `Return to plan`,
rendered no immutable-version success, and exposed no sentinel.

## Visual review

The pre-write question and both actions remain readable above the bounded change plan.
The version result and publication boundary fit the existing scrollable task surface.
The blocked state keeps its summary, receipts, and recovery action visible without
horizontal overflow.

## Findings

No blocker, high-severity, or unresolved finding remains.
