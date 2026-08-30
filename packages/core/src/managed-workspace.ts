export const GTM_MAX_CONCURRENT_WORKSPACES = 3;
export const GTM_MANAGED_WORKSPACE_NAME = "GTM Observability";
export const GTM_MANAGED_WORKSPACE_DESCRIPTION =
  "Managed by GTM Observability. Ownership marker: gtm-observability:v1";

const publicContainerIdPattern = /^GTM-[A-Z0-9]+$/i;

export interface AccessibleContainer {
  accountId: string;
  containerId: string;
  publicId: string;
  name: string;
}

export interface WorkspaceSummary {
  path: string;
  workspaceId: string;
  name: string;
  description?: string;
  fingerprint?: string;
}

export type ContainerRecognition<Container extends AccessibleContainer = AccessibleContainer> =
  | { status: "recognized"; publicId: string; container: Container }
  | { status: "not_accessible"; publicId: string }
  | { status: "ambiguous"; publicId: string; matchCount: number };

export type ManagedWorkspaceInspection<Workspace extends WorkspaceSummary = WorkspaceSummary> =
  | {
    status: "available";
    action: "reuse";
    workspaceCount: number;
    workspace: Workspace;
  }
  | {
    status: "available";
    action: "create";
    workspaceCount: number;
    remainingSlots: number;
  }
  | { status: "capacity_blocked"; workspaceCount: number }
  | {
    status: "ownership_conflict";
    workspaceCount: number;
    managedWorkspaceCount: number;
    reservedNameCount: number;
  };

export function normalizePublicContainerId(publicId: string): string {
  const normalized = publicId.trim().toUpperCase();
  if (!publicContainerIdPattern.test(normalized)) {
    throw new Error("A GTM public container ID such as GTM-ABC123 is required.");
  }
  return normalized;
}

export function recognizeContainer<Container extends AccessibleContainer>(
  observedPublicId: string,
  containers: Container[],
): ContainerRecognition<Container> {
  const publicId = normalizePublicContainerId(observedPublicId);
  const matches = containers.filter(
    (container) => container.publicId.trim().toUpperCase() === publicId,
  );
  if (matches.length === 0) return { status: "not_accessible", publicId };
  if (matches.length > 1) return { status: "ambiguous", publicId, matchCount: matches.length };
  return { status: "recognized", publicId, container: matches[0]! };
}

export function isManagedWorkspace(workspace: WorkspaceSummary): boolean {
  return workspace.name === GTM_MANAGED_WORKSPACE_NAME
    && workspace.description === GTM_MANAGED_WORKSPACE_DESCRIPTION;
}

export function inspectManagedWorkspace<Workspace extends WorkspaceSummary>(
  workspaces: Workspace[],
): ManagedWorkspaceInspection<Workspace> {
  const reservedNames = workspaces.filter(
    (workspace) => workspace.name === GTM_MANAGED_WORKSPACE_NAME,
  );
  const managed = workspaces.filter(isManagedWorkspace);
  if (managed.length > 1 || reservedNames.length !== managed.length) {
    return {
      status: "ownership_conflict",
      workspaceCount: workspaces.length,
      managedWorkspaceCount: managed.length,
      reservedNameCount: reservedNames.length,
    };
  }
  if (managed.length === 1) {
    return {
      status: "available",
      action: "reuse",
      workspaceCount: workspaces.length,
      workspace: managed[0]!,
    };
  }
  if (workspaces.length >= GTM_MAX_CONCURRENT_WORKSPACES) {
    return { status: "capacity_blocked", workspaceCount: workspaces.length };
  }
  return {
    status: "available",
    action: "create",
    workspaceCount: workspaces.length,
    remainingSlots: GTM_MAX_CONCURRENT_WORKSPACES - workspaces.length,
  };
}
