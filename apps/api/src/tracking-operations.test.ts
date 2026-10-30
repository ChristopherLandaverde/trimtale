import {
  createSetupProposal,
  createTrackingChangePlan,
  type TrackingSetupOperationV1,
} from "@trimtale/core";
import { readFileSync, statSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TrackingOperationRepository } from "./tracking-operations.js";

function operation(id = "operation_navigation"): TrackingSetupOperationV1 {
  const proposal = createSetupProposal({
    intent: "Track navigation clicks",
    pageUrl: "https://example.test/",
    measurementId: "G-TEST123456",
    container: { accountId: "1", containerId: "10", publicId: "GTM-ABC123", name: "Lead site" },
    navigation: [{
      id: "pricing", text: "Pricing", href: "https://example.test/pricing", area: "nav",
      selector: "nav a[href='/pricing']",
    }],
  });
  return {
    schemaVersion: 1,
    id,
    status: "planned",
    createdAt: "2026-08-22T12:00:00.000Z",
    updatedAt: "2026-08-22T12:00:00.000Z",
    specification: proposal.specification,
    generatedSetup: proposal.containerFile,
    container: { publicId: "GTM-ABC123", path: "accounts/1/containers/10" },
    workspace: { path: "accounts/1/containers/10/workspaces/2", fingerprint: "workspace-before" },
    plan: createTrackingChangePlan(proposal.containerFile, {}),
    completedActionSignatures: [],
  };
}

describe("tracking operation repository", () => {
  it("persists atomically, returns clones, and reopens the durable record", async () => {
    const directory = await mkdtemp(join(tmpdir(), "gtm-observability-operations-"));
    const filePath = join(directory, "tracking-operations.json");
    try {
      const repository = new TrackingOperationRepository(filePath);
      const original = operation();
      const created = repository.create(original);
      expect(created.accepted).toBe(true);
      if (!created.accepted) throw new Error(created.error);
      created.operation.status = "completed";
      expect(repository.get("operation_navigation")?.status).toBe("planned");
      expect(statSync(filePath).mode & 0o777).toBe(0o600);
      expect(readFileSync(filePath, "utf8")).not.toContain(`${process.pid}.tmp`);

      const reopened = new TrackingOperationRepository(filePath);
      expect(reopened.list()).toEqual([original]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects duplicate creation and stale or identity-changing updates", async () => {
    const directory = await mkdtemp(join(tmpdir(), "gtm-observability-operations-"));
    const filePath = join(directory, "tracking-operations.json");
    try {
      const repository = new TrackingOperationRepository(filePath);
      expect(repository.create(operation()).accepted).toBe(true);
      const concurrentRepository = new TrackingOperationRepository(filePath);
      expect(repository.create(operation())).toEqual({ accepted: false, error: "already_exists" });

      const applying = operation();
      applying.status = "applying";
      applying.updatedAt = "2026-08-22T12:01:00.000Z";
      expect(repository.update(applying.id, "wrong-revision", applying)).toEqual({
        accepted: false, error: "stale_revision",
      });
      const changedIdentity = structuredClone(applying);
      changedIdentity.createdAt = "2026-08-22T11:00:00.000Z";
      expect(repository.update(applying.id, operation().updatedAt, changedIdentity)).toEqual({
        accepted: false, error: "identity_mismatch",
      });
      const updated = repository.update(applying.id, operation().updatedAt, applying);
      expect(updated).toEqual({ accepted: true, operation: applying });
      expect(concurrentRepository.update(applying.id, operation().updatedAt, applying)).toEqual({
        accepted: false, error: "stale_revision",
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("migrates legacy records and rejects corrupted, unsupported, and invalid records", async () => {
    const directory = await mkdtemp(join(tmpdir(), "gtm-observability-operations-"));
    const filePath = join(directory, "tracking-operations.json");
    const current = operation();
    const legacy = {
      schemaVersion: 0,
      id: current.id,
      createdAt: current.createdAt,
      specification: current.specification,
      generatedSetup: current.generatedSetup,
      publicId: current.container.publicId,
      workspacePath: current.workspace.path,
      workspaceFingerprint: current.workspace.fingerprint,
      plan: current.plan,
    };
    try {
      await writeFile(filePath, JSON.stringify({ schemaVersion: 1, operations: [legacy] }), "utf8");
      expect(new TrackingOperationRepository(filePath).get(current.id)).toEqual(current);

      await writeFile(filePath, "{", "utf8");
      expect(() => new TrackingOperationRepository(filePath)).toThrow("Corrupted tracking-operation collection.");
      await writeFile(filePath, JSON.stringify({ schemaVersion: 99, operations: [] }), "utf8");
      expect(() => new TrackingOperationRepository(filePath)).toThrow("Unsupported tracking-operation collection schema.");
      await writeFile(filePath, JSON.stringify({ schemaVersion: 1, operations: [{ schemaVersion: 99 }] }), "utf8");
      expect(() => new TrackingOperationRepository(filePath)).toThrow("Unsupported tracking operation schema.");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
