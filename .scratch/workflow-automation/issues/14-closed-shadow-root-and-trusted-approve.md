# Close the assistant panel's shadow root and ignore untrusted events on approve controls

Status: open

GitHub: #78

## Objective

A hostile page cannot fill the typed confirmation or click **Approve**, **Publish** or
**Roll back** for the practitioner. Mount the panel in a closed shadow root and ignore
untrusted events on every control that changes the live container.

## Regression contract

To be written first: an adversarial e2e page script fills the review input and clicks
**Approve**, and no approval request is sent.
