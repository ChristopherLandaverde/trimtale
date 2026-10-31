# Approve/execute race: a re-approval during an in-flight publish or rollback loses the recorded result

Status: open

GitHub: #77

## Objective

A live change that Google accepted is always recorded, even if someone approves again
while the publish or rollback request waits for Google. Today the final save fails its
optimistic `updatedAt` check after Google succeeded. An optional follow-up: flag an
operation whose stored `updatedAt` is in the future.

## Regression contract

To be written first: renew the approval while a mocked Google publish or rollback is
pending, then assert the published or rolled-back state is persisted. Existing refusal
tests stay unchanged.
