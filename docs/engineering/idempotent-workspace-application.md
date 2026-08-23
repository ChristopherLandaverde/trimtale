# Idempotent managed-workspace application

Application turns a ready tracking change plan into workspace entities without making
publication claims. It accepts only a schema-valid `planned` or `applying` tracking
setup operation for the exact recognized container and managed workspace recorded by
the operation.

## Safety sequence

Before any entity write, application:

1. confirms backend GTM writes are explicitly enabled;
2. re-recognizes the observed public container ID;
3. requires the exact managed-workspace path and fingerprint from the operation;
4. synchronizes that workspace and stops on merge or synchronization conflict;
5. verifies the persisted plan fingerprint from its actions; and
6. re-reads all supported workspace entities and re-plans before each action boundary.

An unrecognized container, ambiguous access, unavailable or differently owned
workspace, stale workspace, malformed plan, missing action, or semantic conflict stops
before the affected entity mutation.

## Convergence rules

- `create` posts a storage-metadata-free entity to the managed workspace.
- `reuse` and `no_op` record completion without a write.
- An interrupted `create` that is semantically present on the next read is reconciled
  as complete rather than created again.
- `update` is planned only for a same-name semantic difference carrying the exact
  `Managed by GTM Observability` note. The update re-reads that entity, requires the
  ownership note and a current fingerprint, and sends the fingerprint with the PUT.
- An unmarked same-name difference remains an ownership conflict.
- Trigger IDs returned by Google are translated into later tag bodies, so generated
  export IDs never leak into live workspace references.

The Google Tag Manager v2 API defines workspace-scoped POST endpoints for
[tags](https://developers.google.com/tag-platform/tag-manager/api/reference/rest/v2/accounts.containers.workspaces.tags/create),
[triggers](https://developers.google.com/tag-platform/tag-manager/api/reference/rest/v2/accounts.containers.workspaces.triggers/create),
and [variables](https://developers.google.com/tag-platform/tag-manager/api/reference/rest/v2/accounts.containers.workspaces.variables/create).
[Tag updates](https://developers.google.com/tag-platform/tag-manager/api/reference/rest/v2/accounts.containers.workspaces.tags/update)
use the entity path and accept its storage fingerprint as a query guard. Built-in
variables use an
[empty workspace POST with repeated type parameters](https://developers.google.com/tag-platform/tag-manager/api/reference/rest/v2/accounts.containers.workspaces.built_in_variables/create).

## Interruption and failure

The result returns completed action signatures after each successful or already
converged boundary. A caller persists those signatures in the tracking setup operation.
If the process stops after Google accepts a write but before persistence, the next run's
fresh semantic plan observes the entity and marks that action complete without another
write. A Google entity failure returns the completed prefix plus the failed signature;
the operation stays resumable.

Application does not validate the workspace, create a version, capture publication
approval, publish, or roll back. Those stages remain blocked until their dedicated
contracts are satisfied.
