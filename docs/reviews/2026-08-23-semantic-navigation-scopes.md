# Semantic navigation scopes exploratory review

Date: 2026-08-23

## Environment

- Built Chrome extension in headless Playwright Chromium.
- Local API configured with the exact generated extension origin.
- Host Ollama using installed `qwen3:30b` through the fixed loopback adapter.
- Deterministic fixture used only for agent-owned review, not as a practitioner demo.

## Scenarios

### Fuzzy happy path

Entered “Track the menu at the top, not the legal links.” The local model proposed the
observed Primary navigation group, deterministic UI copy named the included and
excluded groups without internal IDs, and explicit confirmation highlighted exactly
three primary-navigation links.

### Unresolved generic path

Entered “Track navigation clicks.” The product skipped the unnecessary model call and
asked whether the scope should cover Header links, Primary navigation, or Footer
navigation. No group was silently selected and the multi-group control remained
available.

### Adversarial page label

Changed the primary navigation landmark label to markup-bearing, instruction-shaped
text with an error-handler sentinel, then entered “Track the top menu.” The label was
replaced with the structural fallback “Header navigation” before model input and UI
rendering. No injected image appeared and the sentinel did not execute. The local
suggestion remained confirmation-required.

## Visual inspection

The group question, counts, page-region labels, local-model receipt, confirmation
actions, and evidence path fit within the workbench without clipping. Reviewed stable
states are covered by `assistant-navigation-scope-linux.png`,
`assistant-evidence-path-linux.png`, and `assistant-managed-workspace-linux.png`.

## Findings

- Medium, resolved: model-authored clarification exposed internal group IDs. Visible
  confirmation copy is now produced deterministically from safe group labels.
- Medium, resolved: an instruction-shaped landmark label remained inert but degraded
  target selection and confirmation copy. Unsafe landmark labels are now structurally
  renamed before grouping or model input.
- Provider-neutral model input redacts obvious private values before either the local
  adapter or a future hosted adapter receives practitioner wording.
- No unresolved blocker, high, medium, or low findings.
