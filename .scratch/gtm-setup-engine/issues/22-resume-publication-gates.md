# Resume publication gates after interruption

Delivery mode: implementation
Status: claimed

## Production outcome

When a durable tracking setup operation is already versioned or published, reopening
the website agent restores the exact next approval or live-verification action without
reapplying the workspace or weakening any fingerprint binding.

## Non-goals

- Automatic publication or rollback.
- Reusing an approval for a different version fingerprint.
- Automating Google sign-in or Tag Assistant's undocumented session interface.
- Adding a new persistence path or workflow state.

## Authorization

The user authorized these changes on 2026-08-26 and asked the workflow to continue
through Git checkpoints rather than stopping at a commit.

## Regression contract

- `apps/api/src/workflow-runner.test.ts` proves resuming a published operation returns
  its exact publication and `verify_publication` as the next step.
- `tests/e2e/conversational-form.spec.ts` proves a browser restart restores an exact
  version for publication review without another apply action.
- The same E2E suite proves a published operation restores live verification without
  exposing publication review again.
- Existing malformed-response and fingerprint checks remain fail-closed.

## Comments

- 2026-08-26: The credentialed workflow revealed that durable state survived a
  browser restart while the website agent only rehydrated validated operations.
