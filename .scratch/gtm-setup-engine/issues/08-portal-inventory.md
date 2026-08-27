# Signed-in container inventory and change awareness

Delivery mode: implementation
Status: in progress

## Production outcome

A signed-in organization member can connect Google, list accessible GTM web
containers and effective access, see connected GA4 context, and identify newly
observed container version or workspace changes across the organization.

## Non-goals

- Tag creation or editing in the portal.
- Scheduled website scans, incidents, or monitoring alerts.
- Inferring a runtime regression from a container change.

## Authorization

The user selected the portal as the identity, container inventory, access, and change-
awareness surface and authorized continuous Stage 1 implementation on 2026-08-24.

## Regression contract

- Organization isolation, role-based access, session continuity, and Google-token
  ownership have named tests.
- Inventory distinguishes accounts, containers, unavailable versus verified access,
  workspaces, live versions, and GA4 context.
- `packages/core/src/container-inventory.test.ts` identifies exact version or workspace
  differences without claiming website impact or crossing organization connections.
- `apps/api/src/container-inventory-api.test.ts` protects the organization-scoped
  baseline, durable comparison, stale-capture rejection, and connection isolation
  used by the future portal.
- Portal routes expose no tag-authoring mutation.

## Dependencies

None for specification; implementation reuses the existing Google integration.

## Open integration boundary

Google's exact account and container ACL endpoint requires the separate
`tagmanager.manage.users` OAuth scope and returns every user permission on the account.
The current grant intentionally does not request that broader authority. Inventory
therefore labels effective access as unavailable rather than inferring it from local
write feature flags. Identity provider, tenancy storage, and whether agencies accept
that Google scope remain product decisions before the portal can claim verified ACLs.

## Implemented checkpoint

- `GET /api/google/inventory` requires signed-in organization read permission and
  captures only accessible GTM web containers through the existing Google grant.
- The first request establishes one private file-backed baseline per organization and
  Google connection. Later requests return exact changes with
  `impactAssessment: not_assessed` and atomically replace the baseline.
- Effective ACL access remains `unavailable` under the current least-privilege scope.
  No tag-authoring or provider mutation route was introduced.
- Issue 38 owns this completed read-model slice. The visual portal inventory and its
  deployment/authentication technology remain the next Issue 08 boundary.
