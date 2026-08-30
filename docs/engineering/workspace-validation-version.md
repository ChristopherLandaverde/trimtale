# Workspace validation and immutable versions

An applied tracking setup is not reviewable publication evidence until its exact
managed-workspace state compiles and becomes an immutable GTM container version.

## Validation

Validation accepts only an `applied`, retryable `validation_failed`, or already
`validated` tracking setup operation. It re-recognizes the container and requires the
exact managed-workspace path and fingerprint recorded after application. It then:

1. reads [workspace status](https://developers.google.com/tag-platform/tag-manager/api/reference/rest/v2/accounts.containers.workspaces/getStatus)
   for exact workspace changes and merge conflicts;
2. rejects changes that are neither product-marked tags, triggers, and variables nor
   generated built-in-variable types;
3. semantically re-plans every generated entity and requires only reuse or no-op;
4. runs GTM's non-versioning
   [quick preview](https://developers.google.com/tag-platform/tag-manager/api/reference/rest/v2/accounts.containers.workspaces/quick_preview);
5. stores the workspace changes, workspace fingerprint, preview fingerprint, and any
   compiler or synchronization error as validation evidence.

A failed validation never calls version creation.

## Version creation

Version creation accepts only a schema-valid `validated` operation and reruns the full
validation against fresh state. It reads the
[currently live version](https://developers.google.com/tag-platform/tag-manager/api/reference/rest/v2/accounts.containers.versions/live)
immediately before creation and requires both its path and fingerprint as rollback
evidence. It then calls
[workspace create_version](https://developers.google.com/tag-platform/tag-manager/api/reference/rest/v2/accounts.containers.workspaces/create_version)
with an operation-specific name and note.

Success requires a response with no compiler or synchronization error and a new
container-version path and fingerprint. The result binds that immutable version to the
prior live path and fingerprint. It does not approve or publish the version.

The opt-in managed GTM write lane requests `tagmanager.edit.containerversions` in
addition to the read-only and entity-edit scopes because both quick preview and version
creation require it. Ordinary CI uses deterministic fake responses and never contacts
Google.
