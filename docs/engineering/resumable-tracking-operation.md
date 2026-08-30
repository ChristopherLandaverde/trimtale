# Resumable tracking-setup operations

A tracking setup operation is the durable source of truth for one setup as it moves
from a confirmed specification to post-publication evidence or rollback. The record
does not execute Google Tag Manager changes. It makes each later executor step
recoverable, reviewable, and bounded by the state that was actually observed.

## Record boundary

Schema version 1 retains:

- the confirmed tracking specification and generated GTM setup;
- the recognized container and managed-workspace path and fingerprint;
- the semantic tracking change plan and completed action signatures;
- workspace validation, immutable version, and prior-live-version evidence;
- practitioner approval bound to the exact version fingerprint;
- publication, post-publication evidence, and rollback state.

Validation is stage-dependent. A record cannot claim `validated` without passing
validation evidence, `approved` without an immutable version and matching approval,
or `published` without publication evidence for that same fingerprint. A conflicting
plan cannot advance beyond planning, and an applied operation must account for every
non-conflicting plan action.

## Resume decisions

The state machine produces one deterministic next step:

| Persisted status | Next step |
| --- | --- |
| `planned` | apply, or revise a conflicting plan |
| `applying` | reconcile partially applied entities |
| `applied` | validate the workspace |
| `validation_failed` | revise the plan |
| `validated` | create an immutable version |
| `versioned` | await practitioner approval |
| `approved` | publish the approved version |
| `published` | verify publication |
| `verification_failed`, `rollback_required` | roll back |
| `rolled_back`, `completed` | complete |

Choosing a resumable action always requires freshly read workspace and live-version
fingerprints. Without them the result is `refresh_state`; a mismatch produces
`reconcile_state`. Before publication, the live fingerprint must still be the recorded
prior live version. After publication it must be the approved version, and after
rollback it must again be the prior live version. This prevents an old approval or an
interrupted run from authorizing a change against newer external state.

## Persistence and compatibility

The API repository stores a schema-versioned collection using a mode-`0600` temporary
file followed by an atomic rename. Reads return clones, so callers cannot mutate
stored state accidentally. Creation refuses duplicate operation IDs. Updates compare
the caller's expected `updatedAt` value with freshly reloaded disk state and also
preserve the operation ID and creation timestamp. Stale writers fail instead of
overwriting newer progress.

The repository migrates the defined schema-version-0 planned record to version 1 on
read. Malformed JSON, unknown collection or record versions, invalid stage evidence,
and duplicate persisted IDs fail closed. The migration is deliberately narrow; no
unknown historic shape is guessed into a current operation.

## Deliberate limits

This slice supplies the operation contract and persistence boundary only. Entity
writes, workspace validation, version creation, approval capture, publication, and
rollback execution remain separate stages. Production publication continues to
require explicit practitioner approval for one immutable version fingerprint and is
never part of ordinary CI.
