# Recognized container and managed workspace

Status: accepted

## Outcome

The site-aware analytics assistant connects the GTM public ID observed on the current website to an accessible Google Tag Manager container and prepares changes in at most one managed workspace for that container.

## Constraints

- A standard GTM container has at most three concurrent workspaces: one default workspace and two custom workspaces.
- Runtime observation proves only that a public container ID was loaded by the page. It does not prove Google access, ownership, edit permission, or that analytics received an event.
- The assistant never treats a non-matching container as recognized.
- The assistant never creates a workspace during read-only inspection.
- The assistant never creates more than one managed workspace in a container.
- The assistant never edits or deletes a default workspace or another person's custom workspace.
- Ordinary deterministic and Chromium tests never consume a real GTM workspace.

## Workflow

1. Observe and normalize public `GTM-...` IDs from safe page runtime metadata.
2. Discover the containers accessible through the connected Google account.
3. Require exactly one public-ID match before recognizing the container.
4. List the recognized container's current workspaces and live version.
5. If one managed workspace already exists, reuse it after synchronizing it with the latest container version.
6. If no managed workspace exists and fewer than three workspaces are present, an explicit prepare action may create one.
7. If all three workspace slots are occupied, remain in planning and generated-container-file mode without mutating GTM.
8. If synchronization reports conflicts, stop mutation and preserve the workspace for review.
9. Repeated prepare actions return the same managed workspace and do not create duplicates.
10. Creating versions and publishing remain separate, explicitly approved workflow stages.

## Managed ownership marker

The managed workspace uses a stable name and description marker controlled by this product. A name match alone is insufficient for ownership and blocks creation as a reserved-name collision. If more than one marked workspace exists, the workflow reports an ownership conflict and creates nothing.

## Result states

- `recognized`: one accessible container matches the observed public ID.
- `not_accessible`: no accessible container matches it.
- `ambiguous`: more than one accessible container matches it.
- `reused`: the existing managed workspace is synchronized and returned.
- `created`: a managed workspace was created after a fresh capacity check.
- `available/create`: capacity exists but explicit preparation has not created a workspace.
- `available/reuse`: one managed workspace exists and can be prepared through synchronization.
- `capacity_blocked`: all workspace slots are occupied and none is managed.
- `sync_conflict`: the managed workspace cannot safely advance automatically.
- `ownership_conflict`: multiple marked workspaces exist.

## Acceptance criteria

- [x] Public container IDs are matched case-insensitively and only an exact single match is recognized.
- [x] Inspection reports the current workspace count and a non-mutating workspace decision.
- [x] Preparation reuses an existing managed workspace.
- [x] Preparation creates at most one managed workspace after rechecking capacity.
- [x] Preparation creates nothing at three workspaces, on ambiguous recognition, or when multiple managed workspaces exist.
- [x] Synchronization conflicts are returned without automatic conflict resolution.
- [x] Google write scope and write endpoints are disabled unless explicitly configured.
- [x] The assistant can explain the recognized-container and workspace result without claiming publication.
- [x] Deterministic tests cover recognition, capacity, idempotency, ownership, synchronization, and disabled writes.
- [x] Browser coverage shows that a page-observed public ID can be connected to the matching accessible container without visual regressions elsewhere.
- [x] `npm run verify` passes without real Google credentials.

## Out of scope

- Automatically resolving GTM merge conflicts.
- Deleting abandoned or human-owned workspaces.
- Creating a container version.
- Publishing a container version.
- Platform-side GA4 or Google Ads confirmation.

## Generated setup evidence

A confirmed supported tracking specification generates a reviewable GTM container file before workspace preparation. Generation is passed only when the actual artifact exists; downloading it is optional and does not imply it was applied. Guidance targets the one managed workspace or an existing review workspace and never instructs creation of a workspace per request.
