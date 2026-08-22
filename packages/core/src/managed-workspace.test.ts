import { describe, expect, it } from "vitest";
import {
  GTM_MANAGED_WORKSPACE_DESCRIPTION,
  GTM_MANAGED_WORKSPACE_NAME,
  inspectManagedWorkspace,
  recognizeContainer,
} from "./managed-workspace.js";

const containers = [
  { accountId: "1", containerId: "10", publicId: "GTM-ABC123", name: "Lead site" },
  { accountId: "2", containerId: "20", publicId: "GTM-OTHER", name: "Other site" },
];

describe("recognized container", () => {
  it("requires one exact case-insensitive public-ID match", () => {
    expect(recognizeContainer("gtm-abc123", containers)).toEqual({
      status: "recognized",
      publicId: "GTM-ABC123",
      container: containers[0],
    });
    expect(recognizeContainer("GTM-ABC", containers)).toEqual({
      status: "not_accessible",
      publicId: "GTM-ABC",
    });
  });

  it("does not choose between duplicate accessible matches", () => {
    expect(recognizeContainer("GTM-ABC123", [...containers, {
      accountId: "3",
      containerId: "30",
      publicId: "gtm-abc123",
      name: "Duplicate",
    }])).toEqual({ status: "ambiguous", publicId: "GTM-ABC123", matchCount: 2 });
  });

  it("rejects values that are not public web-container IDs", () => {
    expect(() => recognizeContainer("G-ABC123", containers)).toThrow("GTM public container ID");
  });
});

describe("managed workspace capacity", () => {
  const defaultWorkspace = {
    path: "accounts/1/containers/10/workspaces/1",
    workspaceId: "1",
    name: "Default Workspace",
  };
  const managedWorkspace = {
    path: "accounts/1/containers/10/workspaces/2",
    workspaceId: "2",
    name: GTM_MANAGED_WORKSPACE_NAME,
    description: GTM_MANAGED_WORKSPACE_DESCRIPTION,
    fingerprint: "managed-fingerprint",
  };

  it("reuses the one marked workspace regardless of remaining capacity", () => {
    expect(inspectManagedWorkspace([defaultWorkspace, managedWorkspace, {
      path: "accounts/1/containers/10/workspaces/3",
      workspaceId: "3",
      name: "Agency changes",
    }])).toEqual({
      status: "available",
      action: "reuse",
      workspaceCount: 3,
      workspace: managedWorkspace,
    });
  });

  it("offers one creation only while a workspace slot remains", () => {
    expect(inspectManagedWorkspace([defaultWorkspace])).toEqual({
      status: "available",
      action: "create",
      workspaceCount: 1,
      remainingSlots: 2,
    });
    expect(inspectManagedWorkspace([defaultWorkspace, {
      path: "accounts/1/containers/10/workspaces/2",
      workspaceId: "2",
      name: "Agency changes",
    }, {
      path: "accounts/1/containers/10/workspaces/3",
      workspaceId: "3",
      name: "Experiment",
    }])).toEqual({ status: "capacity_blocked", workspaceCount: 3 });
  });

  it("requires both the stable name and ownership marker", () => {
    expect(inspectManagedWorkspace([defaultWorkspace, {
      ...managedWorkspace,
      description: "A person used this name",
    }])).toEqual({
      status: "ownership_conflict",
      workspaceCount: 2,
      managedWorkspaceCount: 0,
      reservedNameCount: 1,
    });
  });

  it("blocks when multiple marked workspaces exist", () => {
    expect(inspectManagedWorkspace([
      defaultWorkspace,
      managedWorkspace,
      { ...managedWorkspace, path: "accounts/1/containers/10/workspaces/3", workspaceId: "3" },
    ])).toEqual({
      status: "ownership_conflict",
      workspaceCount: 3,
      managedWorkspaceCount: 2,
      reservedNameCount: 2,
    });
  });
});
