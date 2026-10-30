import { createSetupProposal, createTrackingChangePlan, type TrackingSetupOperationV1 } from "@trimtale/core";
import type { IncomingMessage, ServerResponse } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GoogleIntegrationError } from "./google.js";
import { TrackingOperationRepository } from "./tracking-operations.js";
import { TrackingWorkflowRunner, type WorkflowGoogleClient } from "./workflow-runner.js";
import { handleGoogleWorkflowRoute } from "./workflow-routes.js";

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

const sessionAccount = "practitioner@example.test";

function versioned(): TrackingSetupOperationV1 {
  const proposal = createSetupProposal({
    intent: "Track navigation clicks", pageUrl: "https://example.test/", measurementId: "G-TEST123456",
    container: { accountId: "1", containerId: "10", publicId: "GTM-ABC123", name: "Lead site" },
    navigation: [{ id: "pricing", text: "Pricing", href: "https://example.test/pricing", area: "nav", selector: "nav a[href='/pricing']" }],
  });
  const plan = createTrackingChangePlan(proposal.containerFile, {});
  return {
    schemaVersion: 1, id: "operation_navigation", status: "versioned",
    createdAt: "2026-08-22T12:00:00.000Z", updatedAt: "2026-08-22T12:10:00.000Z",
    specification: proposal.specification, generatedSetup: proposal.containerFile,
    container: { publicId: "GTM-ABC123", path: "accounts/1/containers/10" },
    workspace: { path: "accounts/1/containers/10/workspaces/2", fingerprint: "workspace-final" },
    plan, completedActionSignatures: plan.actions.map(({ entitySignature }) => entitySignature),
    validation: { status: "passed", checkedAt: "2026-08-22T12:09:00.000Z", workspaceFingerprint: "workspace-final", errors: [] },
    version: {
      path: "accounts/1/containers/10/versions/8", fingerprint: "version-8",
      priorLiveVersionPath: "accounts/1/containers/10/versions/7", priorLiveVersionFingerprint: "live-7",
    },
  };
}

async function harness(options: {
  publicationEnabled?: boolean;
  identity?: () => Promise<string>;
  clock?: { now: Date };
} = {}) {
  const directory = await mkdtemp(join(tmpdir(), "workflow-routes-"));
  directories.push(directory);
  const repository = new TrackingOperationRepository(join(directory, "operations.json"));
  repository.create(versioned());
  const publishApprovedVersion = vi.fn().mockResolvedValue({
    publishedAt: "2026-08-22T12:20:00.000Z",
    versionFingerprint: "version-8",
  });
  const clock = options.clock ?? { now: new Date("2026-08-22T12:15:00.000Z") };
  const runner = new TrackingWorkflowRunner(
    repository,
    { publishApprovedVersion } as unknown as WorkflowGoogleClient,
    () => clock.now,
  );
  const identity = vi.fn(options.identity ?? (async () => sessionAccount));

  async function post(path: string, body: unknown): Promise<{ status: number; body: Record<string, unknown> }> {
    let sent: { status: number; body: Record<string, unknown> } | undefined;
    const handled = await handleGoogleWorkflowRoute({
      request: { method: "POST" } as IncomingMessage,
      response: {} as ServerResponse,
      requestUrl: new URL(`http://127.0.0.1:18787/api/google/workflows/operation_navigation/${path}`),
      workflowRunner: runner,
      publicationEnabled: options.publicationEnabled ?? true,
      approverIdentity: identity,
      readJson: async () => body,
      sendJson: (_response, status, value) => {
        sent = { status, body: value as Record<string, unknown> };
      },
    });
    if (!handled || !sent) throw new Error("route was not handled");
    return sent;
  }

  return { post, runner, publishApprovedVersion, identity, clock };
}

describe("publication approval and publish routes", () => {
  it("records the session account as approver and ignores a client-supplied approver", async () => {
    const { post, runner, publishApprovedVersion } = await harness();
    const approved = await post("approve", {
      versionFingerprint: "version-8",
      confirmation: "GTM-ABC123",
      approvedBy: "attacker@example.test",
    });
    expect(approved.status).toBe(200);
    expect(approved.body.result).toMatchObject({
      status: "approved",
      nextStep: "publish",
      approvalExpiresAt: expect.any(String),
      operation: { approval: { approvedBy: sessionAccount, versionFingerprint: "version-8" } },
    });
    expect(JSON.stringify(runner.get("operation_navigation"))).not.toContain("attacker@example.test");
    expect(publishApprovedVersion).not.toHaveBeenCalled();

    const published = await post("publish", { versionFingerprint: "version-8", approvedBy: "attacker@example.test" });
    expect(published.status).toBe(200);
    expect(published.body.result).toMatchObject({
      status: "published",
      operation: { approval: { approvedBy: sessionAccount } },
    });
    expect(publishApprovedVersion).toHaveBeenCalledTimes(1);
  });

  it("answers a mismatched fingerprint with 409 at approval and at publish", async () => {
    const { post, publishApprovedVersion } = await harness();
    const approval = await post("approve", { versionFingerprint: "version-9", confirmation: "GTM-ABC123" });
    expect(approval.status).toBe(409);
    expect(approval.body.result).toMatchObject({ status: "blocked", reason: "fingerprint_mismatch" });

    await post("approve", { versionFingerprint: "version-8", confirmation: "GTM-ABC123" });
    const publish = await post("publish", { versionFingerprint: "version-9" });
    expect(publish.status).toBe(409);
    expect(publish.body.result).toMatchObject({ status: "blocked", reason: "fingerprint_mismatch" });
    expect(publishApprovedVersion).not.toHaveBeenCalled();
  });

  it("refuses to publish a stale approval with 409 and no Google call", async () => {
    const clock = { now: new Date("2026-08-22T12:15:00.000Z") };
    const { post, publishApprovedVersion } = await harness({ clock });
    expect((await post("approve", { versionFingerprint: "version-8", confirmation: "GTM-ABC123" })).status).toBe(200);
    clock.now = new Date("2026-08-22T12:45:01.000Z");
    const publish = await post("publish", { versionFingerprint: "version-8" });
    expect(publish.status).toBe(409);
    expect(publish.body.result).toMatchObject({ status: "blocked", stage: "approval", reason: "approval_expired" });
    expect(publishApprovedVersion).not.toHaveBeenCalled();
  });

  it("refuses publication without a prior approval request", async () => {
    const { post, publishApprovedVersion } = await harness();
    const publish = await post("publish", { versionFingerprint: "version-8", approvedBy: sessionAccount });
    expect(publish.status).toBe(409);
    expect(publish.body.result).toMatchObject({ reason: "approval_required" });
    expect(publishApprovedVersion).not.toHaveBeenCalled();
  });

  it("refuses an approval without the typed container confirmation", async () => {
    const { post } = await harness();
    expect((await post("approve", { versionFingerprint: "version-8" })).status).toBe(400);
    const wrong = await post("approve", { versionFingerprint: "version-8", confirmation: "GTM-WRONG" });
    expect(wrong.status).toBe(409);
    expect(wrong.body.result).toMatchObject({ reason: "confirmation_mismatch" });
  });

  it("refuses publishing from a different signed-in account than the approver", async () => {
    let account = sessionAccount;
    const { post, publishApprovedVersion } = await harness({ identity: async () => account });
    await post("approve", { versionFingerprint: "version-8", confirmation: "GTM-ABC123" });
    account = "someone-else@example.test";
    const publish = await post("publish", { versionFingerprint: "version-8" });
    expect(publish.status).toBe(409);
    expect(publish.body.result).toMatchObject({ reason: "approver_changed" });
    expect(publishApprovedVersion).not.toHaveBeenCalled();
  });

  it("fails closed when publication is disabled, before asking Google who is signed in", async () => {
    const { post, identity, runner } = await harness({ publicationEnabled: false });
    expect((await post("approve", { versionFingerprint: "version-8", confirmation: "GTM-ABC123" })).status).toBe(403);
    expect((await post("publish", { versionFingerprint: "version-8" })).status).toBe(403);
    expect(identity).not.toHaveBeenCalled();
    expect(runner.get("operation_navigation")?.status).toBe("versioned");
  });

  it("refuses approval when Google cannot verify the account's email", async () => {
    const { post, runner } = await harness({
      identity: async () => {
        throw new GoogleIntegrationError("no verified email", 403);
      },
    });
    const approval = await post("approve", { versionFingerprint: "version-8", confirmation: "GTM-ABC123" });
    expect(approval.status).toBe(403);
    expect(runner.get("operation_navigation")?.approval).toBeUndefined();
  });
});
