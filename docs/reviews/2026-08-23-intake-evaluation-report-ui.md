# Intake evaluation report UI exploratory review

> Historical review: the frontend surface reviewed here was removed by issue 20 after
> product direction clarified that model evaluations are backend-only observability.

Date: 2026-08-23

## Environment

- Managed Chromium with the unpacked production extension from `apps/extension/dist`.
- Loopback API and deterministic fixture site on `127.0.0.1`.
- Strict list/detail fixtures supplied at the fixed read-only API URLs; no provider
  command, credential, external request, or paid model call.
- Review surface: the `Model evaluations` panel inside the existing tracking assistant
  shadow root.

## Scenarios

### Empty and conversation preservation

Opened the assistant and used the keyboard to activate `Open model evaluation reports`.
The panel focused its named heading and showed `No model evaluations yet`, explained
the owner-only backend workflow, and exposed no run action. Closing, drafting composer
text, reopening, and closing the panel preserved the draft and existing conversation.

Visual evidence:
[`evaluation-empty-linux.png`](../../tests/e2e/intake-evaluation-ui.spec.ts-snapshots/evaluation-empty-linux.png)

### Passing and degraded evidence

Opened the newest two-provider report. One provider showed a gating safety failure with
11 pass, one fail, one hard failure, one inconclusive case, 83.93 average score, p95
latency, estimated cost, and 12/14 usage coverage. Safe case IDs and failure codes were
available below the aggregate. The other provider showed passing. The boundary stated
that models cannot confirm specifications, change GTM, or prove platform receipt.

Used the labeled report selector to load the older report. Both providers changed to
passing and each stated that all 14 cases passed. The selector did not alter the
underlying transcript or page.

Visual evidence:
[`evaluation-degraded-linux.png`](../../tests/e2e/intake-evaluation-ui.spec.ts-snapshots/evaluation-degraded-linux.png)

### Unavailable and adversarial payload

Returned a backend 503 containing private error detail. The panel discarded the body,
showed one retryable `Reports unavailable` state, and said no model call was started.
On retry, returned a malformed report containing a markup-shaped ID, unexpected prompt
field, and empty provider list. Strict decoding rejected it. No `img`, `script`,
`iframe`, or link appeared; attacker text and private backend detail were not rendered.

Visual evidence:
[`evaluation-unavailable-linux.png`](../../tests/e2e/intake-evaluation-ui.spec.ts-snapshots/evaluation-unavailable-linux.png)

### Host page and accessibility

The panel remained contained in the extension shadow root and did not add page targets,
links, forms, or mutations. Open, close, refresh, retry, and report selection controls
had accessible names and native keyboard behavior. Opening moved focus to the panel
heading; closing returned focus to the report toggle. The transcript and composer were
inert while the panel was open.

## Findings and remediation

1. Medium, resolved: the initial nearly opaque panel allowed the underlying composer
   to remain faintly visible. The panel background is now fully opaque and the visual
   baselines protect the corrected state.
2. Medium, resolved: scrolling to deep non-pass evidence could move the report header
   out of the captured viewport. The panel now uses a bounded grid, minimum-zero scroll
   region, sticky header, and top-normalized visual regression.

## Result

No unresolved blocker or high-severity findings. Empty, successful, degraded,
inconclusive, unavailable, adversarial, keyboard, focus, transcript-preservation, and
read-only authority boundaries are ready for the completion gate.
