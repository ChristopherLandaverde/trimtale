# Managed GTM workspace workflow

The assistant can observe a public GTM container ID on a website, match it to the connected practitioner's accessible containers, and prepare at most one product-owned custom workspace. Observation, recognition, and mutation are separate steps.

## Safety invariants

- A runtime `GTM-...` observation is a candidate, not proof of Google access or ownership.
- Recognition requires exactly one case-insensitive, exact public-ID match from Google discovery.
- Inspection performs only GTM reads.
- Preparation requires a separate user action and backend write enablement.
- One exact name-and-description ownership marker identifies the managed workspace.
- A reserved-name collision, multiple ownership markers, synchronization conflict, or three occupied slots blocks creation.
- The default workspace and unmarked custom workspaces are never edited or deleted.
- Preparation does not create a version or publish the container.

Standard GTM accounts have three concurrent workspaces: the default and two custom workspaces. A completed GTM version removes its source workspace, but this implementation does not yet create versions. An unfinished managed workspace is therefore reused on later preparation requests.

## Connection modes

The backend remains read-only by default:

```text
GOOGLE_GTM_CONTAINER_WRITES_ENABLED is absent
OAuth scope: tagmanager.readonly
```

Explicitly enabling the managed GTM write workflow at backend startup requests
read-only, container-edit, and container-version-edit scopes:

```text
GOOGLE_GTM_CONTAINER_WRITES_ENABLED=true
OAuth scopes: tagmanager.readonly tagmanager.edit.containers tagmanager.edit.containerversions
```

The production `tagmanager.publish` scope is excluded unless the separate
`GOOGLE_GTM_PUBLICATION_ENABLED=true` boundary is also enabled for an approved session.

Changing this setting requires a new Google OAuth consent flow. A previously issued read-only token does not gain write permission.

## API workflow

### Inspect

```http
GET /api/google/containers/recognize?publicId=GTM-ABC123
```

The API discovers accessible containers, requires one exact match, reads the matching container's workspaces and live version, and returns a non-mutating decision:

- `available/create` — a slot is available.
- `available/reuse` — one marked workspace already exists.
- `capacity_blocked` — all three slots are occupied without a managed workspace.
- `ownership_conflict` — the reserved name or ownership marker is not unique and exact.

### Prepare

```http
POST /api/google/containers/prepare-workspace
Content-Type: application/json

{"publicId":"GTM-ABC123"}
```

Preparation repeats discovery and capacity inspection. It creates the marked workspace only when no managed workspace exists and capacity remains. Otherwise it synchronizes and reuses the marked workspace. Concurrent requests for the same public ID share one in-process preparation, preventing duplicate calls from one backend instance.

Synchronization errors and merge conflicts return `sync_conflict`; the API does not resolve them automatically. Full capacity returns `capacity_blocked`. Both results leave GTM unchanged beyond Google's synchronization of unmodified entities.

## Assistant behavior

Opening the assistant performs one bounded connection check. A successful exact match
appears in the GTM connection card with the account, container, destination, and
effective access. When edit access is enabled, managed-workspace preparation remains
inside the explicitly reviewed setup workflow rather than a separate evidence card.

If matching, permissions, capacity, ownership, or synchronization prevent preparation, the existing generated-container-file and planning paths remain available. No state claims publication or platform confirmation.

## Testing

Core policy and API-client tests use deterministic fake Google responses. Chromium
intercepts the fixed local integration endpoints and exercises connection inspection
and reviewed workflow preparation without credentials. Ordinary `npm run verify`
never calls Google or consumes a real workspace.

Any real Google integration lane must require explicit credentials and a disposable container. It must not run in ordinary CI.
