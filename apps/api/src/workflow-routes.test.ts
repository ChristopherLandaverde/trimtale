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

function rollbackRequired(): TrackingSetupOperationV1 {
  return {
    ...versioned(),
    status: "rollback_required",
    approval: { approvedAt: "2026-08-22T12:11:00.000Z", approvedBy: sessionAccount, versionFingerprint: "version-8" },
    publication: { publishedAt: "2026-08-22T12:12:00.000Z", versionFingerprint: "version-8" },
    postPublicationEvidenceId: "run_failed",
    rollback: { targetVersionFingerprint: "live-7", status: "required" },
  };
}

async function harness(options: {
  publicationEnabled?: boolean;
  identity?: () => Promise<string>;
  clock?: { now: Date };
  operation?: TrackingSetupOperationV1;
} = {}) {
  const directory = await mkdtemp(join(tmpdir(), "workflow-routes-"));
  directories.push(directory);
  const repository = new TrackingOperationRepository(join(directory, "operations.json"));
  repository.create(options.operation ?? versioned());
  const publishApprovedVersion = vi.fn().mockResolvedValue({
    publishedAt: "2026-08-22T12:20:00.000Z",
    versionFingerprint: "version-8",
  });
  const clock = options.clock ?? { now: new Date("2026-08-22T12:15:00.000Z") };
  const rollbackPublishedVersion = vi.fn().mockResolvedValue({
    targetVersionFingerprint: "live-7",
    status: "completed",
    completedAt: "2026-08-22T12:21:00.000Z",
  });
  const runner = new TrackingWorkflowRunner(
    repository,
    { publishApprovedVersion, rollbackPublishedVersion } as unknown as WorkflowGoogleClient,
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

  return { post, runner, publishApprovedVersion, rollbackPublishedVersion, identity, clock };
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

describe("rollback approval and rollback routes", () => {
  const target = { targetVersionFingerprint: "live-7" };

  it("records the session account as rollback approver and ignores a client-supplied approver", async () => {
    const { post, runner, rollbackPublishedVersion } = await harness({ operation: rollbackRequired() });
    const approved = await post("rollback-approval", { ...target, confirmation: "GTM-ABC123", approvedBy: "website assistant" });
    expect(approved.status).toBe(200);
    expect(approved.body.result).toMatchObject({
      status: "rollback_approved",
      nextStep: "rollback",
      approvalExpiresAt: "2026-08-22T12:45:00.000Z",
      operation: { rollback: { approval: { approvedBy: sessionAccount, targetVersionFingerprint: "live-7" } } },
    });
    expect(rollbackPublishedVersion).not.toHaveBeenCalled();

    const rolledBack = await post("rollback", { ...target, approvedBy: "attacker@example.test" });
    expect(rolledBack.status).toBe(200);
    expect(rolledBack.body.result).toMatchObject({
      status: "rolled_back",
      operation: { rollback: { status: "completed", approval: { approvedBy: sessionAccount } } },
    });
    expect(rollbackPublishedVersion).toHaveBeenCalledTimes(1);
    const stored = JSON.stringify(runner.get("operation_navigation"));
    expect(stored).not.toContain("website assistant");
    expect(stored).not.toContain("attacker@example.test");
  });

  it("refuses a rollback approval without a matching typed container ID", async () => {
    const { post, runner, rollbackPublishedVersion } = await harness({ operation: rollbackRequired() });
    expect((await post("rollback-approval", target)).status).toBe(400);
    const wrong = await post("rollback-approval", { ...target, confirmation: "GTM-WRONG" });
    expect(wrong.status).toBe(409);
    expect(wrong.body.result).toMatchObject({ status: "blocked", stage: "rollback", reason: "confirmation_mismatch" });
    const rollback = await post("rollback", target);
    expect(rollback.status).toBe(409);
    expect(rollback.body.result).toMatchObject({ reason: "approval_required" });
    expect(runner.get("operation_navigation")?.rollback?.approval).toBeUndefined();
    expect(rollbackPublishedVersion).not.toHaveBeenCalled();
  });

  it("refuses a stale rollback approval with 409 and no Google call", async () => {
    const clock = { now: new Date("2026-08-22T12:15:00.000Z") };
    const { post, rollbackPublishedVersion } = await harness({ clock, operation: rollbackRequired() });
    expect((await post("rollback-approval", { ...target, confirmation: "GTM-ABC123" })).status).toBe(200);
    clock.now = new Date("2026-08-22T12:45:01.000Z");
    const rollback = await post("rollback", target);
    expect(rollback.status).toBe(409);
    expect(rollback.body.result).toMatchObject({ status: "blocked", stage: "rollback", reason: "approval_expired" });
    expect(rollbackPublishedVersion).not.toHaveBeenCalled();
  });

  it("refuses rolling back from a different signed-in account than the approver", async () => {
    let account = sessionAccount;
    const { post, rollbackPublishedVersion } = await harness({ identity: async () => account, operation: rollbackRequired() });
    await post("rollback-approval", { ...target, confirmation: "GTM-ABC123" });
    account = "someone-else@example.test";
    const rollback = await post("rollback", target);
    expect(rollback.status).toBe(409);
    expect(rollback.body.result).toMatchObject({ reason: "approver_changed" });
    expect(rollbackPublishedVersion).not.toHaveBeenCalled();
  });

  it("refuses rollback approval when Google cannot verify the account's email", async () => {
    const { post, runner, rollbackPublishedVersion } = await harness({
      operation: rollbackRequired(),
      identity: async () => {
        throw new GoogleIntegrationError("no verified email", 403);
      },
    });
    const approval = await post("rollback-approval", { ...target, confirmation: "GTM-ABC123" });
    expect(approval.status).toBe(403);
    expect(approval.body.error).toBe("no verified email");
    expect((await post("rollback", target)).status).toBe(403);
    expect(runner.get("operation_navigation")?.rollback?.approval).toBeUndefined();
    expect(rollbackPublishedVersion).not.toHaveBeenCalled();
  });

  it("fails closed when publication is disabled, before asking Google who is signed in", async () => {
    const { post, identity, runner, rollbackPublishedVersion } = await harness({
      publicationEnabled: false,
      operation: rollbackRequired(),
    });
    expect((await post("rollback-approval", { ...target, confirmation: "GTM-ABC123" })).status).toBe(403);
    expect((await post("rollback", target)).status).toBe(403);
    expect(identity).not.toHaveBeenCalled();
    expect(rollbackPublishedVersion).not.toHaveBeenCalled();
    expect(runner.get("operation_navigation")?.status).toBe("rollback_required");
  });
});
