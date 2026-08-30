import {
  createFormSetupProposal,
  createSetupProposal,
  createTrackingChangePlan,
  fingerprintTrackingChangeActions,
  type FormSetupRequest,
  type SetupRequest,
} from "@gtm-observability/core";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TrackingOperationRepository } from "./tracking-operations.js";
import { TrackingWorkflowRunner, type WorkflowGoogleClient } from "./workflow-runner.js";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

const request: SetupRequest = {
  intent: "Track navigation clicks",
  pageUrl: "https://example.test/",
  measurementId: "G-TEST123456",
  container: { accountId: "1", containerId: "10", publicId: "GTM-ABC123", name: "Disposable" },
  navigation: [{
    id: "pricing",
    text: "Pricing",
    href: "https://example.test/pricing",
    area: "nav",
    selector: "nav a[href='/pricing']",
  }],
};

const container = {
  accountId: "1",
  containerId: "10",
  publicId: "GTM-ABC123",
  name: "Disposable",
  path: "accounts/1/containers/10",
  usageContext: ["web"],
};
const workspace = {
  accountId: "1",
  containerId: "10",
  workspaceId: "2",
  name: "GTM Observability",
  path: "accounts/1/containers/10/workspaces/2",
  fingerprint: "workspace-before",
};
const generated = createSetupProposal(request);
const readyPlan = createTrackingChangePlan(generated.containerFile, {});
const completed = readyPlan.actions.map(({ entitySignature }) => entitySignature);

async function repository() {
  const directory = await mkdtemp(join(tmpdir(), "workflow-runner-"));
  directories.push(directory);
  return new TrackingOperationRepository(join(directory, "operations.json"));
}

function google(overrides: Partial<WorkflowGoogleClient> = {}) {
  const client = {
    planManagedWorkspace: vi.fn()
      .mockResolvedValueOnce({
        status: "workspace_required",
        publicId: container.publicId,
        container,
        workspace: { status: "available", action: "create", workspaceCount: 2, remainingSlots: 1 },
      })
      .mockResolvedValue({
        status: "planned",
        publicId: container.publicId,
        container,
        workspace,
        workspaceFingerprint: workspace.fingerprint,
        plan: readyPlan,
      }),
    prepareManagedWorkspace: vi.fn().mockResolvedValue({
      status: "recognized",
      publicId: container.publicId,
      container,
      liveVersion: { path: `${container.path}/versions/7`, fingerprint: "live-7" },
      workspace: { status: "created", workspaceCount: 3, workspace },
    }),
    applyManagedWorkspace: vi.fn().mockResolvedValue({
      status: "applied",
      completedActionSignatures: completed,
      workspaceFingerprint: "workspace-final",
      plan: readyPlan,
    }),
    validateManagedWorkspace: vi.fn().mockResolvedValue({
      status: "passed",
      checkedAt: "2026-08-22T12:04:00.000Z",
      workspaceFingerprint: "workspace-final",
      errors: [],
      workspaceChanges: [],
      previewVersionFingerprint: "preview-8",
    }),
    createValidatedVersion: vi.fn().mockResolvedValue({
      status: "versioned",
      validation: {
        status: "passed",
        checkedAt: "2026-08-22T12:05:00.000Z",
        workspaceFingerprint: "workspace-final",
        errors: [],
        workspaceChanges: [],
        previewVersionFingerprint: "preview-8",
      },
      version: {
        path: `${container.path}/versions/8`,
        fingerprint: "version-8",
        priorLiveVersionPath: `${container.path}/versions/7`,
        priorLiveVersionFingerprint: "live-7",
      },
    }),
    publishApprovedVersion: vi.fn(),
    ...overrides,
  };
  return client;
}

describe("resumable non-publishing tracking workflow", () => {
  it("prepares, plans, applies, validates, versions, persists, and replays without duplicate writes", async () => {
    const store = await repository();
    const client = google();
    const runner = new TrackingWorkflowRunner(store, client, () => new Date("2026-08-22T12:00:00.000Z"));

    const planned = await runner.plan(request);
    expect(planned.status).toBe("planned");
    if (planned.status === "blocked") throw new Error(planned.reason);
    const finished = await runner.resume(planned.operation.id);
    expect(finished).toMatchObject({
      status: "versioned",
      nextStep: "await_approval",
      operation: {
        status: "versioned",
        workspace: { fingerprint: "workspace-final" },
        version: { fingerprint: "version-8", priorLiveVersionFingerprint: "live-7" },
      },
    });
    expect(new TrackingOperationRepository(store.filePath).get(planned.operation.id)?.status).toBe("versioned");

    expect((await runner.plan(request)).status).toBe("reused");
    expect((await runner.resume(planned.operation.id)).status).toBe("versioned");
    expect(client.applyManagedWorkspace).toHaveBeenCalledTimes(1);
    expect(client.createValidatedVersion).toHaveBeenCalledTimes(1);
    expect(client.publishApprovedVersion).not.toHaveBeenCalled();
  });

  it("publishes only after exact current fingerprint approval", async () => {
    const store = await repository();
    const client = google({
      publishApprovedVersion: vi.fn().mockResolvedValue({
        publishedAt: "2026-08-22T12:07:00.000Z",
        versionFingerprint: "version-8",
      }),
    });
    const runner = new TrackingWorkflowRunner(store, client, () => new Date("2026-08-22T12:00:00.000Z"));
    const planned = await runner.plan(request);
    if (planned.status === "blocked") throw new Error(planned.reason);
    const versioned = await runner.resume(planned.operation.id);
    if (versioned.status !== "versioned") throw new Error(versioned.status);

    const published = await runner.approveAndPublish(
      planned.operation.id,
      "version-8",
      "practitioner@example.test",
    );
    expect(published).toMatchObject({
      status: "published",
      nextStep: "verify_publication",
      operation: {
        status: "published",
        approval: { versionFingerprint: "version-8", approvedBy: "practitioner@example.test" },
        publication: { versionFingerprint: "version-8" },
      },
    });
    expect(client.publishApprovedVersion).toHaveBeenCalledTimes(1);
    expect(new TrackingOperationRepository(store.filePath).get(planned.operation.id)?.status).toBe("published");
  });

  it("blocks stale or repeated publication before any Google publish call", async () => {
    const publishApprovedVersion = vi.fn();
    const client = google({ publishApprovedVersion });
    const runner = new TrackingWorkflowRunner(await repository(), client);
    const planned = await runner.plan(request);
    if (planned.status === "blocked") throw new Error(planned.reason);
    const versioned = await runner.resume(planned.operation.id);
    if (versioned.status !== "versioned") throw new Error(versioned.status);

    await expect(runner.approveAndPublish(
      planned.operation.id,
      "wrong-version",
      "practitioner@example.test",
    )).resolves.toMatchObject({
      status: "blocked",
      stage: "approval",
      reason: "fingerprint_mismatch",
    });
    expect(publishApprovedVersion).not.toHaveBeenCalled();

    publishApprovedVersion.mockResolvedValue({
      publishedAt: "2026-08-22T12:07:00.000Z",
      versionFingerprint: "version-8",
    });
    await runner.approveAndPublish(planned.operation.id, "version-8", "practitioner@example.test");
    await expect(runner.approveAndPublish(
      planned.operation.id,
      "version-8",
      "practitioner@example.test",
    )).resolves.toMatchObject({
      status: "blocked",
      stage: "approval",
      reason: "operation_not_versioned",
    });
    expect(publishApprovedVersion).toHaveBeenCalledTimes(1);
  });

  it("persists partial application evidence and resumes safely", async () => {
    const client = google({
      applyManagedWorkspace: vi.fn()
        .mockResolvedValueOnce({
          status: "partial_failure",
          failedActionSignature: completed[1],
          completedActionSignatures: [completed[0]],
          message: "injected failure",
        })
        .mockResolvedValue({
          status: "applied",
          completedActionSignatures: completed,
          workspaceFingerprint: "workspace-final",
          plan: readyPlan,
        }),
    });
    const runner = new TrackingWorkflowRunner(await repository(), client, () => new Date("2026-08-22T12:00:00.000Z"));
    const planned = await runner.plan(request);
    if (planned.status === "blocked") throw new Error(planned.reason);

    const paused = await runner.resume(planned.operation.id);
    expect(paused).toMatchObject({
      status: "paused",
      stage: "application",
      operation: { status: "applying", completedActionSignatures: [completed[0]] },
    });
    expect(await runner.resume(planned.operation.id)).toMatchObject({ status: "versioned" });
    expect(client.applyManagedWorkspace).toHaveBeenCalledTimes(2);
  });

  it("durably records a conflicting plan and refuses every write stage", async () => {
    const actions = readyPlan.actions.map((action, index) => index === 0
      ? { ...action, action: "conflict" as const, reason: "name_collision" as const }
      : action);
    const conflictPlan = {
      ...readyPlan,
      status: "conflict" as const,
      actions,
      fingerprint: fingerprintTrackingChangeActions(actions),
    };
    const client = google({
      planManagedWorkspace: vi.fn().mockResolvedValue({
        status: "planned",
        publicId: container.publicId,
        container,
        workspace,
        workspaceFingerprint: workspace.fingerprint,
        plan: conflictPlan,
      }),
    });
    const runner = new TrackingWorkflowRunner(await repository(), client);
    const planned = await runner.plan(request);
    if (planned.status === "blocked") throw new Error(planned.reason);

    expect(await runner.resume(planned.operation.id)).toMatchObject({
      status: "blocked",
      stage: "planning",
      reason: "plan_conflict",
    });
    expect(client.prepareManagedWorkspace).not.toHaveBeenCalled();
    expect(client.applyManagedWorkspace).not.toHaveBeenCalled();
    expect(client.validateManagedWorkspace).not.toHaveBeenCalled();
    expect(client.createValidatedVersion).not.toHaveBeenCalled();
    expect(client.publishApprovedVersion).not.toHaveBeenCalled();
  });

  it("fails closed for unknown operation identities", async () => {
    const runner = new TrackingWorkflowRunner(await repository(), google());
    await expect(runner.resume("operation_missing")).rejects.toThrow("Tracking operation was not found");
  });

  it("plans an already-confirmed lead-form specification through the same durable boundary", async () => {
    const formRequest: FormSetupRequest = {
      measurementId: request.measurementId,
      container: request.container,
      specification: {
        schemaVersion: 1,
        id: "spec_disposable_form",
        status: "confirmed",
        originalIntent: "Track a disposable qualified inquiry",
        interaction: { type: "form_submission" },
        conversionOutcome: { type: "qualified_inquiry", practitionerConfirmed: true },
        event: {
          name: "generate_lead",
          requiredParameters: ["form_id", "form_name", "page_location"],
          optionalParameters: [],
        },
        targets: [{
          id: "disposable-form",
          label: "Disposable verification form",
          selector: "#disposable-form",
          pageUrl: request.pageUrl,
        }],
        successEvidence: [{ type: "data_layer_event", eventName: "disposable_form_success" }],
      },
    };
    const formPlan = createTrackingChangePlan(
      createFormSetupProposal(formRequest).containerFile,
      {},
    );
    const client = google({
      planManagedWorkspace: vi.fn().mockResolvedValue({
        status: "planned",
        publicId: container.publicId,
        container,
        workspace,
        workspaceFingerprint: workspace.fingerprint,
        plan: formPlan,
      }),
    });
    const runner = new TrackingWorkflowRunner(await repository(), client);

    const planned = await runner.plan(formRequest);
    expect(planned).toMatchObject({
      status: "planned",
      operation: {
        id: "operation_spec_disposable_form",
        specification: { event: { name: "generate_lead" } },
      },
    });
  });
});
