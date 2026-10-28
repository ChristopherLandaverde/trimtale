export const CONTAINER_INVENTORY_SCHEMA_VERSION = 1 as const;

export type EffectiveContainerAccessV1 =
  | { status: "unavailable"; reason: "permission_scope_not_granted" | "provider_unavailable" }
  | { status: "verified"; level: "read" | "edit" | "publish"; permissionResourceFingerprint: string };

export interface ContainerInventoryItemV1 {
  account: { id: string; name: string };
  container: {
    id: string;
    publicId: string;
    name: string;
    usageContext: "WEB";
  };
  access: EffectiveContainerAccessV1;
  liveVersion: { status: "observed"; path: string; fingerprint: string }
    | { status: "unavailable" };
  workspaces: Array<{
    path: string;
    id: string;
    name: string;
    fingerprint: string | null;
  }>;
  ga4: {
    measurementIds: string[];
    context: "not_connected" | "connected" | "ambiguous" | "unavailable";
  };
}

export interface ContainerInventorySnapshotV1 {
  schemaVersion: typeof CONTAINER_INVENTORY_SCHEMA_VERSION;
  organizationId: string;
  googleConnectionId: string;
  capturedAt: string;
  containers: ContainerInventoryItemV1[];
}

export interface ContainerInventoryChangeV1 {
  containerPublicId: string;
  type:
    | "container_added"
    | "container_removed"
    | "access_changed"
    | "live_version_changed"
    | "workspace_added"
    | "workspace_removed"
    | "workspace_changed"
    | "ga4_context_changed";
  before: unknown;
  after: unknown;
  impactAssessment: "not_assessed";
}

const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const NUMERIC_ID = /^\d+$/;
const PUBLIC_ID = /^GTM-[A-Z0-9]+$/;
const MEASUREMENT_ID = /^G-[A-Z0-9]{4,20}$/;
const FINGERPRINT = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown, maximum = 256): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maximum;
}

function validateContainer(value: unknown, index: number, errors: string[]): void {
  const path = `containers[${index}]`;
  if (!isRecord(value)) {
    errors.push(`${path} is invalid`);
    return;
  }
  const account = isRecord(value.account) ? value.account : undefined;
  if (!account || typeof account.id !== "string" || !NUMERIC_ID.test(account.id) || !text(account.name)) {
    errors.push(`${path}.account is invalid`);
  }
  const container = isRecord(value.container) ? value.container : undefined;
  if (!container
    || typeof container.id !== "string" || !NUMERIC_ID.test(container.id)
    || typeof container.publicId !== "string" || !PUBLIC_ID.test(container.publicId)
    || !text(container.name)
    || container.usageContext !== "WEB") {
    errors.push(`${path}.container is invalid or is not a web container`);
  }
  const access = isRecord(value.access) ? value.access : undefined;
  if (!access || !["unavailable", "verified"].includes(String(access.status))) {
    errors.push(`${path}.access is invalid`);
  } else if (access.status === "unavailable"
    && access.reason !== "permission_scope_not_granted" && access.reason !== "provider_unavailable") {
    errors.push(`${path}.access.reason is invalid`);
  } else if (access.status === "verified"
    && (!(["read", "edit", "publish"].includes(String(access.level)))
      || typeof access.permissionResourceFingerprint !== "string"
      || !FINGERPRINT.test(access.permissionResourceFingerprint))) {
    errors.push(`${path}.access verified evidence is invalid`);
  }
  const live = isRecord(value.liveVersion) ? value.liveVersion : undefined;
  if (!live || !["observed", "unavailable"].includes(String(live.status))) {
    errors.push(`${path}.liveVersion is invalid`);
  } else if (live.status === "observed"
    && (!text(live.path, 512) || typeof live.fingerprint !== "string" || !FINGERPRINT.test(live.fingerprint))) {
    errors.push(`${path}.liveVersion evidence is invalid`);
  }
  if (!Array.isArray(value.workspaces) || value.workspaces.length > 100) {
    errors.push(`${path}.workspaces is invalid`);
  } else {
    const workspaceIds = new Set<string>();
    value.workspaces.forEach((workspace, workspaceIndex) => {
      if (!isRecord(workspace)
        || !text(workspace.path, 512)
        || typeof workspace.id !== "string" || !NUMERIC_ID.test(workspace.id)
        || workspaceIds.has(workspace.id)
        || !text(workspace.name)
        || (workspace.fingerprint !== null
          && (typeof workspace.fingerprint !== "string" || !FINGERPRINT.test(workspace.fingerprint)))) {
        errors.push(`${path}.workspaces[${workspaceIndex}] is invalid`);
      }
      if (isRecord(workspace) && typeof workspace.id === "string") workspaceIds.add(workspace.id);
    });
  }
  const ga4 = isRecord(value.ga4) ? value.ga4 : undefined;
  if (!ga4
    || !Array.isArray(ga4.measurementIds)
    || ga4.measurementIds.some((measurementId) => typeof measurementId !== "string" || !MEASUREMENT_ID.test(measurementId))
    || new Set(ga4.measurementIds).size !== ga4.measurementIds.length
    || !["not_connected", "connected", "ambiguous", "unavailable"].includes(String(ga4.context))) {
    errors.push(`${path}.ga4 is invalid`);
  }
}

export function validateContainerInventorySnapshot(value: unknown): string[] {
  if (!isRecord(value)) return ["container inventory snapshot must be an object"];
  const errors: string[] = [];
  if (value.schemaVersion !== CONTAINER_INVENTORY_SCHEMA_VERSION) errors.push("schemaVersion must be 1");
  if (typeof value.organizationId !== "string" || !ID.test(value.organizationId)) errors.push("organizationId is invalid");
  if (typeof value.googleConnectionId !== "string" || !ID.test(value.googleConnectionId)) errors.push("googleConnectionId is invalid");
  if (typeof value.capturedAt !== "string" || Number.isNaN(Date.parse(value.capturedAt))) errors.push("capturedAt is invalid");
  if (!Array.isArray(value.containers) || value.containers.length > 5_000) {
    errors.push("containers is invalid");
  } else {
    value.containers.forEach((container, index) => validateContainer(container, index, errors));
    const publicIds = value.containers.flatMap((item) =>
      isRecord(item) && isRecord(item.container) && typeof item.container.publicId === "string"
        ? [item.container.publicId]
        : []);
    if (new Set(publicIds).size !== publicIds.length) errors.push("container public IDs must be unique");
  }
  return [...new Set(errors)];
}

export function compareContainerInventory(
  before: ContainerInventorySnapshotV1,
  after: ContainerInventorySnapshotV1,
): ContainerInventoryChangeV1[] {
  const beforeErrors = validateContainerInventorySnapshot(before);
  const afterErrors = validateContainerInventorySnapshot(after);
  if (beforeErrors.length > 0 || afterErrors.length > 0) throw new Error("Container inventory snapshot is invalid.");
  if (before.organizationId !== after.organizationId || before.googleConnectionId !== after.googleConnectionId) {
    throw new Error("Container inventory snapshots belong to different organization connections.");
  }
  const changes: ContainerInventoryChangeV1[] = [];
  const beforeItems = new Map(before.containers.map((item) => [item.container.publicId, item]));
  const afterItems = new Map(after.containers.map((item) => [item.container.publicId, item]));
  const publicIds = [...new Set([...beforeItems.keys(), ...afterItems.keys()])].sort();
  const add = (containerPublicId: string, type: ContainerInventoryChangeV1["type"], previous: unknown, next: unknown) => {
    changes.push({ containerPublicId, type, before: previous, after: next, impactAssessment: "not_assessed" });
  };
  for (const publicId of publicIds) {
    const previous = beforeItems.get(publicId);
    const next = afterItems.get(publicId);
    if (!previous) {
      add(publicId, "container_added", null, next);
      continue;
    }
    if (!next) {
      add(publicId, "container_removed", previous, null);
      continue;
    }
    if (JSON.stringify(previous.access) !== JSON.stringify(next.access)) add(publicId, "access_changed", previous.access, next.access);
    if (JSON.stringify(previous.liveVersion) !== JSON.stringify(next.liveVersion)) add(publicId, "live_version_changed", previous.liveVersion, next.liveVersion);
    if (JSON.stringify(previous.ga4) !== JSON.stringify(next.ga4)) add(publicId, "ga4_context_changed", previous.ga4, next.ga4);
    const previousWorkspaces = new Map(previous.workspaces.map((workspace) => [workspace.id, workspace]));
    const nextWorkspaces = new Map(next.workspaces.map((workspace) => [workspace.id, workspace]));
    for (const workspaceId of [...new Set([...previousWorkspaces.keys(), ...nextWorkspaces.keys()])].sort()) {
      const previousWorkspace = previousWorkspaces.get(workspaceId);
      const nextWorkspace = nextWorkspaces.get(workspaceId);
      if (!previousWorkspace) add(publicId, "workspace_added", null, nextWorkspace);
      else if (!nextWorkspace) add(publicId, "workspace_removed", previousWorkspace, null);
      else if (JSON.stringify(previousWorkspace) !== JSON.stringify(nextWorkspace)) {
        add(publicId, "workspace_changed", previousWorkspace, nextWorkspace);
      }
    }
  }
  return changes;
}
