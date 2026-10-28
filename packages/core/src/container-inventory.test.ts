import { describe, expect, it } from "vitest";
import {
  compareContainerInventory,
  validateContainerInventorySnapshot,
  type ContainerInventorySnapshotV1,
} from "./container-inventory.js";

function snapshot(): ContainerInventorySnapshotV1 {
  return {
    schemaVersion: 1,
    organizationId: "org_agency",
    googleConnectionId: "google_primary",
    capturedAt: "2026-08-24T16:00:00.000Z",
    containers: [{
      account: { id: "1", name: "Agency" },
      container: { id: "10", publicId: "GTM-ABC123", name: "Lead site", usageContext: "WEB" },
      access: { status: "unavailable", reason: "permission_scope_not_granted" },
      liveVersion: { status: "observed", path: "accounts/1/containers/10/versions/7", fingerprint: "live-7" },
      workspaces: [{
        path: "accounts/1/containers/10/workspaces/2",
        id: "2",
        name: "GTM Observability",
        fingerprint: "workspace-2",
      }],
      ga4: { measurementIds: ["G-YV879ECLRV"], context: "connected" },
    }],
  };
}

describe("organization container inventory", () => {
  it("keeps unavailable access distinct from inferred write capability", () => {
    const subject = snapshot();
    expect(validateContainerInventorySnapshot(subject)).toEqual([]);
    expect(subject.containers[0]?.access).toEqual({
      status: "unavailable",
      reason: "permission_scope_not_granted",
    });
  });

  it("identifies exact provider configuration changes without claiming website impact", () => {
    const before = snapshot();
    const after = structuredClone(before);
    after.capturedAt = "2026-08-24T16:05:00.000Z";
    after.containers[0]!.liveVersion = {
      status: "observed",
      path: "accounts/1/containers/10/versions/8",
      fingerprint: "live-8",
    };
    after.containers[0]!.workspaces[0]!.fingerprint = "workspace-3";

    expect(compareContainerInventory(before, after)).toMatchObject([
      { containerPublicId: "GTM-ABC123", type: "live_version_changed", impactAssessment: "not_assessed" },
      { containerPublicId: "GTM-ABC123", type: "workspace_changed", impactAssessment: "not_assessed" },
    ]);
  });

  it("refuses cross-organization or cross-connection comparisons", () => {
    const before = snapshot();
    const after = structuredClone(before);
    after.organizationId = "org_other";
    expect(() => compareContainerInventory(before, after)).toThrow("different organization connections");
  });

  it("rejects duplicate containers and non-web inventory entries", () => {
    const subject = snapshot();
    subject.containers.push(structuredClone(subject.containers[0]!));
    (subject.containers[0]!.container as { usageContext: string }).usageContext = "SERVER";
    expect(validateContainerInventorySnapshot(subject)).toEqual(expect.arrayContaining([
      "containers[0].container is invalid or is not a web container",
      "container public IDs must be unique",
    ]));
  });
});
