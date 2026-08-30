# Tracking change plan

The tracking change plan is the read-only boundary between a generated tracking setup
and GTM mutation. It compares supported generated entities with a freshly read managed
workspace and classifies each entity as `create`, `reuse`, `no_op`, or `conflict`.

## Semantic comparison

The planner removes GTM storage metadata such as account, container, workspace, path,
fingerprint, folder, and manager-URL fields before comparison. It sorts object keys and
unordered collections, and translates tag firing-trigger references through each
trigger's canonical semantics so equivalent entities can be recognized even when GTM
assigned different IDs.

Generated container imports and GTM REST responses use different notation for the
same values. The comparison canonicalizes aliases such as `PAGE_URL`/`pageUrl`,
`JUST_LINKS`/`linkClick`, parameter type casing,
`measurementId`/`measurementIdOverride`, and
`eventParameters`/`eventSettingsTable`. Canonical property ordering occurs after alias
resolution so equivalent import and REST objects produce the same signature. Entity
writes use the REST representation; ownership and genuine semantic differences remain
conflicts.

Display names do not establish semantic equivalence. They remain a safety boundary:
an existing entity with the requested name but different semantics is a
`name_collision`. More than one semantic match is `ambiguous_equivalent`. Both make
the whole plan `conflict`; neither is automatically resolved.

An exact supported entity is `no_op`. A semantic match with different GTM identifiers
or presentation metadata is `reuse`. No match is `create` only when there is no
same-name collision.

## Workspace reads

Planning requires an existing marked managed workspace. It does not create or
synchronize a workspace and works with read-only Google access. The Google client
freshly lists workspace tags, triggers, custom variables, and enabled built-in
variables before computing the plan. If preparation, ownership, capacity, or unique
container recognition is unresolved, planning returns that boundary instead of
reading or mutating entities.

The generated setup's public container ID must match the observed recognized container
before any Google calls begin.

## Fingerprint

The version-1 plan fingerprint is deterministic over ordered semantic actions and
conflicts. It excludes assigned existing entity IDs so equivalent normalized inputs
produce the same fingerprint. It is planning evidence, not publication approval; a
later operation record must also bind the freshly read workspace fingerprint.

## Current boundary

This slice provides the deterministic domain planner and the read-only Google client
operation. It performs no entity writes, workspace validation, version creation, or
publication. Those remain separate workflow-automation issues.

## Google API references

- [Workspace resource and lifecycle methods](https://developers.google.com/tag-platform/tag-manager/api/reference/rest/v2/accounts.containers.workspaces)
- [Workspace tags](https://developers.google.com/tag-platform/tag-manager/api/reference/rest/v2/accounts.containers.workspaces.tags)
- [Workspace triggers list](https://developers.google.com/tag-platform/tag-manager/api/reference/rest/v2/accounts.containers.workspaces.triggers/list)
- [Workspace built-in variables](https://developers.google.com/tag-platform/tag-manager/api/reference/rest/v2/accounts.containers.workspaces.built_in_variables)
