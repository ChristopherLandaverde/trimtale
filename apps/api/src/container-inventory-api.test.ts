import {
  organizationAuthority,
  type ContainerInventorySnapshotV1,
} from "@gtm-observability/core";
import { readFileSync, statSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  ContainerInventoryService,
  InventorySnapshotRepository,
} from "./container-inventory-api.js";

function snapshot(
  capturedAt = "2026-08-27T12:00:00.000Z",
  liveFingerprint = "live-7",
  workspaceFingerprint = "workspace-2",
): ContainerInventorySnapshotV1 {
  return {
    schemaVersion: 1,
    organizationId: "org_beta",
    googleConnectionId: "google_primary",
    capturedAt,
    containers: [{
      account: { id: "1", name: "Agency" },
      container: {
        id: "10",
        publicId: "GTM-WEB123",
        name: "Lead site",
        usageContext: "WEB",
      },
      access: { status: "unavailable", reason: "permission_scope_not_granted" },
      liveVersion: {
        status: "observed",
        path: "accounts/1/containers/10/versions/7",
        fingerprint: liveFingerprint,
      },
      workspaces: [{
        path: "accounts/1/containers/10/workspaces/2",
        id: "2",
        name: "Default",
        fingerprint: workspaceFingerprint,
      }],
      ga4: { measurementIds: ["G-TEST123456"], context: "unavailable" },
    }],
  };
}

describe("organization container inventory API", () => {
  it("establishes one baseline then reports exact unassessed changes", async () => {
    const directory = await mkdtemp(join(tmpdir(), "gtm-observability-inventory-"));
    const filePath = join(directory, "container-inventory.json");
    const captures = [
      snapshot(),
      snapshot("2026-08-27T12:05:00.000Z", "live-8", "workspace-3"),
    ];
    const capture = vi.fn(async () => structuredClone(captures.shift()!));
    const authority = organizationAuthority({
      organizationId: "org_beta",
      membershipId: "mem_member",
      role: "member",
    });
    try {
      const repository = new InventorySnapshotRepository(filePath);
      const service = new ContainerInventoryService(
        "org_beta",
        "google_primary",
        repository,
        capture,
      );

      const baseline = await service.capture(authority);
      expect(baseline).toMatchObject({ status: "baseline_established", changes: [] });
      baseline.snapshot.containers[0]!.container.name = "mutated response";
      expect(repository.latest("org_beta", "google_primary")?.containers[0]?.container.name)
        .toBe("Lead site");

      const compared = await service.capture(authority);
      expect(compared.status).toBe("changes_compared");
      expect(compared.changes.map(({ type, impactAssessment }) => ({ type, impactAssessment })))
        .toEqual([
          { type: "live_version_changed", impactAssessment: "not_assessed" },
          { type: "workspace_changed", impactAssessment: "not_assessed" },
        ]);
      expect(capture).toHaveBeenNthCalledWith(1, "org_beta", "google_primary");
      expect(capture).toHaveBeenNthCalledWith(2, "org_beta", "google_primary");
      expect(statSync(filePath).mode & 0o777).toBe(0o600);

      const reopened = new InventorySnapshotRepository(filePath);
      expect(reopened.latest("org_beta", "google_primary")?.capturedAt)
        .toBe("2026-08-27T12:05:00.000Z");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects cross-organization authority and invalid or stale captures", async () => {
    const directory = await mkdtemp(join(tmpdir(), "gtm-observability-inventory-"));
    const filePath = join(directory, "container-inventory.json");
    const repository = new InventorySnapshotRepository(filePath);
    const capture = vi.fn(async () => snapshot());
    const service = new ContainerInventoryService(
      "org_beta",
      "google_primary",
      repository,
      capture,
    );
    try {
      const attacker = organizationAuthority({
        organizationId: "org_other",
        membershipId: "mem_other",
        role: "member",
      });
      await expect(service.capture(attacker)).rejects.toThrow("Organization read permission is required");
      expect(capture).not.toHaveBeenCalled();

      const authority = organizationAuthority({
        organizationId: "org_beta",
        membershipId: "mem_member",
        role: "member",
      });
      await service.capture(authority);
      await expect(service.capture(authority)).rejects.toThrow("newer than the current baseline");

      const invalid = snapshot("2026-08-27T12:06:00.000Z");
      invalid.containers[0]!.container.usageContext = "SERVER" as "WEB";
      const invalidService = new ContainerInventoryService(
        "org_beta",
        "google_primary",
        repository,
        async () => invalid,
      );
      await expect(invalidService.capture(authority)).rejects.toThrow("Provider inventory is invalid");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("fails closed for corrupted persistence and mismatched connection identity", async () => {
    const directory = await mkdtemp(join(tmpdir(), "gtm-observability-inventory-"));
    const filePath = join(directory, "container-inventory.json");
    try {
      await writeFile(filePath, "{", "utf8");
      expect(() => new InventorySnapshotRepository(filePath)).toThrow(
        "Corrupted container-inventory collection",
      );

      await writeFile(filePath, JSON.stringify({
        schemaVersion: 1,
        snapshots: [{ ...snapshot(), googleConnectionId: "google_other" }],
      }), "utf8");
      const repository = new InventorySnapshotRepository(filePath);
      expect(repository.latest("org_beta", "google_primary")).toBeUndefined();
      expect(readFileSync(filePath, "utf8")).toContain("google_other");

      const authority = organizationAuthority({
        organizationId: "org_beta",
        membershipId: "mem_member",
        role: "member",
      });
      const mismatchedService = new ContainerInventoryService(
        "org_beta",
        "google_primary",
        repository,
        async () => ({ ...snapshot("2026-08-27T12:06:00.000Z"), googleConnectionId: "google_other" }),
      );
      await expect(mismatchedService.capture(authority)).rejects.toThrow(
        "identity does not match the authenticated connection",
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
