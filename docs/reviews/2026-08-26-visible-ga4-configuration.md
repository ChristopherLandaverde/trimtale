# Visible GA4 configuration review

Date: 2026-08-26

## Environment

- Built production extension in headed Chromium.
- Local deterministic fixture and controlled Google API responses.
- Exact recognized stream `G-TEST123456` with Analytics writes enabled.
- No real Google or GTM mutation.

## Scenarios

### Approved configuration

Confirmed a lead-form setup, opened the separate GA4 review, inspected the property,
stream, custom dimension, key event, and GTM non-effect, then explicitly approved
application. Google-confirmed action receipts remained readable and the task retained
the next GTM workflow actions.

### Fresh-state rejection

Changed the controlled provider response between review and apply. The task reported
stale approval/provider state, displayed no success receipt, and offered a fresh GA4
review or return to the approved setup.

### Adversarial page input

Added markup-shaped private page text before setup review. Neither the GA4 plan nor
the apply request contained that value. The GA4 path made no GTM workflow request.

## Visual observations

- Property, stream, action effects, and the GA4/GTM boundary fit within the compact
  review card.
- The initial `Measurement` label crowded its value. The label was shortened to
  `GA4`, then the headed review was repeated.
- Created custom-dimension and key-event receipts are readable without exposing raw
  provider payloads.
- The stale state is distinguishable from a successful result and leaves both recovery
  actions visible.

## Findings

No unresolved blocker or high-severity finding remains.
