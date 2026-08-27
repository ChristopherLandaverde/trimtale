import {
  createFormSetupProposal,
  createKnownInteractionSetupProposal,
  createSetupProposal,
  createTrackingChangePlan,
  fingerprintTrackingChangeActions,
  GTM_MANAGED_ENTITY_NOTE,
  setupArtifactFingerprint,
  type ExactDraftBrowserRunV1,
  type FormSetupRequest,
  type SetupRequest,
  type TrackingSetupOperationV1,
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

function managedConflictPlan() {
  const current = structuredClone(generated.containerFile.containerVersion);
  const tag = current.tag[0] as Record<string, unknown> & {
    parameter?: Array<{ key?: string; value?: string }>;
  };
  tag.tagId = "7";
  tag.fingerprint = "tag-current";
  tag.notes = GTM_MANAGED_ENTITY_NOTE;
  tag.type = "changed-managed-type";
  return createTrackingChangePlan(generated.containerFile, current);
}

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
    rollbackPublishedVersion: vi.fn(),
    ...overrides,
  };
  return client;
}

function exactDraftRun(operation: TrackingSetupOperationV1): ExactDraftBrowserRunV1 {
  return {
    schemaVersion: 1,
    operationId: operation.id,
    setupFingerprint: setupArtifactFingerprint(operation),
    workspaceFingerprint: operation.workspace.fingerprint,
    previewVersionFingerprint: operation.validation!.previewVersionFingerprint!,
    completedAt: "2026-08-22T12:06:00.000Z",
    evidence: {
      schemaVersion: 1,
      runId: "run_exact_preview",
      specificationId: operation.specification.id,
      startedAt: "2026-08-22T12:05:00.000Z",
      observations: {
        interaction: {
          type: "navigation_click",
          targetId: "pricing",
          attempted: true,
          submissionResult: "success",
        },
        outcome: { observed: true, observable: true, evidenceType: "navigation_click" },
        dataLayer: { matchingEvents: [] },
        tagFired: true,
        network: {
          ga4Requests: [{
            url: "https://www.google-analytics.com/g/collect?v=2&en=navigation_click",
            observedAt: "2026-08-22T12:05:01.000Z",
          }],
        },
        consent: { analyticsStorage: "granted" },
      },
      verdict: {
        code: "browser_verified",
        browserVerification: "passed",
        platformConfirmation: "unverified",
        nextAction: "Create the immutable version.",
      },
    },
  };
}

function failedDraftRun(operation: TrackingSetupOperationV1): ExactDraftBrowserRunV1 {
  const run = exactDraftRun(operation);
  run.evidence.runId = `run_failed_${operation.validation!.previewVersionFingerprint}`;
  run.evidence.verdict = {
    code: "tag_fired_request_missing",
    browserVerification: "failed",
    platformConfirmation: "unverified",
    nextAction: "Review a bounded repair.",
  };
  return run;
}

describe("resumable non-publishing tracking workflow", () => {
  it("requires exact replacement review before provider application", async () => {
    const plan = managedConflictPlan();
    const client = google({
      planManagedWorkspace: vi.fn().mockResolvedValue({
        status: "planned",
        publicId: container.publicId,
        container,
        workspace,
        workspaceFingerprint: workspace.fingerprint,
        plan,
      }),
    });
    const runner = new TrackingWorkflowRunner(await repository(), client);
    const planned = await runner.plan(request);
    if (planned.status === "blocked") throw new Error(planned.reason);
    const conflict = planned.operation.plan.actions.find((action) => action.action === "conflict"
      && action.reason === "managed_change_requires_approval");
    if (conflict?.action !== "conflict" || !conflict.existingId || !conflict.replacement) {
      throw new Error("Expected a reviewable conflict.");
    }
    const entities = [{
      kind: conflict.kind,
      entitySignature: conflict.entitySignature,
      existingId: conflict.existingId,
      currentFingerprint: conflict.replacement.currentFingerprint,
    }];

    expect(await runner.resume(planned.operation.id)).toMatchObject({
      status: "blocked",
      reason: "plan_conflict",
    });
    expect(client.applyManagedWorkspace).not.toHaveBeenCalled();
    expect(() => runner.approveManagedReplacement(
      planned.operation.id,
      "plan_stale",
      entities,
      "practitioner@example.test",
    )).toThrow("plan fingerprint");
    expect(() => runner.approveManagedReplacement(
      planned.operation.id,
      plan.fingerprint,
      [{ ...entities[0]!, existingId: "8" }],
      "practitioner@example.test",
    )).toThrow("reviewed managed entities");

    const approval = runner.approveManagedReplacement(
      planned.operation.id,
      plan.fingerprint,
      entities,
      "practitioner@example.test",
    );

    expect(approval).toMatchObject({
      status: "replacement_approved",
      nextStep: "review_application",
      operation: {
        status: "planned",
        plan: { status: "ready" },
        managedReplacement: { entities },
      },
    });
    expect(client.applyManagedWorkspace).not.toHaveBeenCalled();
  });

  it("prepares, plans, applies, validates, versions, persists, and replays without duplicate writes", async () => {
    const store = await repository();
    const client = google();
    const runner = new TrackingWorkflowRunner(store, client, () => new Date("2026-08-22T12:00:00.000Z"));

    const planned = await runner.plan(request);
    expect(planned.status).toBe("planned");
    if (planned.status === "blocked") throw new Error(planned.reason);
    const awaiting = await runner.resume(planned.operation.id);
    expect(awaiting).toMatchObject({
      status: "awaiting_preview",
      nextStep: "run_tag_assistant_preview",
      operation: { status: "validated" },
      preview: {
        workspaceFingerprint: "workspace-final",
        previewVersionFingerprint: "preview-8",
      },
    });
    expect(awaiting.operation.version).toBeUndefined();
    expect(client.createValidatedVersion).not.toHaveBeenCalled();
    runner.verifyDraft(planned.operation.id, exactDraftRun(awaiting.operation));
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

  it("invalidates exact evidence when managed entities change", async () => {
    const client = google({
      createValidatedVersion: vi.fn().mockResolvedValue({
        status: "blocked",
        validation: {
          status: "failed",
          checkedAt: "2026-08-22T12:07:00.000Z",
          workspaceFingerprint: "workspace-final",
          errors: ["Workspace entities do not match the approved tracking change plan."],
          workspaceChanges: [],
        },
      }),
    });
    const runner = new TrackingWorkflowRunner(
      await repository(),
      client,
      () => new Date("2026-08-22T12:08:00.000Z"),
    );
    const planned = await runner.plan(request);
    if (planned.status === "blocked") throw new Error(planned.reason);
    const awaiting = await runner.resume(planned.operation.id);
    if (awaiting.status !== "awaiting_preview") throw new Error(awaiting.status);
    runner.verifyDraft(planned.operation.id, exactDraftRun(awaiting.operation));

    expect(await runner.resume(planned.operation.id)).toMatchObject({
      status: "blocked",
      stage: "version",
      reason: "version_creation_blocked",
      operation: {
        status: "validation_failed",
        validation: { workspaceFingerprint: "workspace-final" },
      },
    });
    expect(runner.get(planned.operation.id)?.draftVerification).toBeUndefined();
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
    const awaiting = await runner.resume(planned.operation.id);
    expect(awaiting).toMatchObject({ status: "awaiting_preview" });
    runner.verifyDraft(planned.operation.id, exactDraftRun(awaiting.operation));
    expect(await runner.resume(planned.operation.id)).toMatchObject({ status: "versioned" });
    expect(client.applyManagedWorkspace).toHaveBeenCalledTimes(2);
  });

  it("reviews and applies one intent-preserving repair before requiring a new exact preview", async () => {
    const repairActions = readyPlan.actions.map((action, index) => index === 0
      ? { ...action, action: "update" as const, existingId: "managed-1" }
      : { ...action, action: "reuse" as const });
    const repairPlan = {
      ...readyPlan,
      fingerprint: fingerprintTrackingChangeActions(repairActions),
      actions: repairActions,
    };
    const planManagedWorkspace = vi.fn()
      .mockResolvedValueOnce({
        status: "planned",
        publicId: container.publicId,
        container,
        workspace,
        workspaceFingerprint: workspace.fingerprint,
        plan: readyPlan,
      })
      .mockResolvedValueOnce({
        status: "planned",
        publicId: container.publicId,
        container,
        workspace: { ...workspace, fingerprint: "workspace-drifted" },
        workspaceFingerprint: "workspace-drifted",
        plan: repairPlan,
      });
    const applyManagedWorkspace = vi.fn()
      .mockResolvedValueOnce({
        status: "applied",
        completedActionSignatures: completed,
        workspaceFingerprint: "workspace-final",
        plan: readyPlan,
      })
      .mockResolvedValueOnce({
        status: "applied",
        completedActionSignatures: completed,
        workspaceFingerprint: "workspace-repaired",
        plan: repairPlan,
      });
    const validateManagedWorkspace = vi.fn()
      .mockResolvedValueOnce({
        status: "passed",
        checkedAt: "2026-08-22T12:04:00.000Z",
        workspaceFingerprint: "workspace-final",
        errors: [],
        workspaceChanges: [],
        previewVersionFingerprint: "preview-8",
      })
      .mockResolvedValueOnce({
        status: "passed",
        checkedAt: "2026-08-22T12:08:00.000Z",
        workspaceFingerprint: "workspace-repaired",
        errors: [],
        workspaceChanges: [],
        previewVersionFingerprint: "preview-9",
      });
    const client = google({ planManagedWorkspace, applyManagedWorkspace, validateManagedWorkspace });
    const runner = new TrackingWorkflowRunner(await repository(), client);
    const planned = await runner.plan(request);
    if (planned.status === "blocked") throw new Error(planned.reason);
    const awaiting = await runner.resume(planned.operation.id);
    if (awaiting.status !== "awaiting_preview") throw new Error("Expected exact preview checkpoint.");

    const repair = await runner.proposeDraftRepair(planned.operation.id, failedDraftRun(awaiting.operation));
    expect(repair).toMatchObject({
      status: "repair_ready",
      nextStep: "review_repair",
      repair: {
        planFingerprint: repairPlan.fingerprint,
        reasonCode: "workspace_entity_drift",
        attempt: 1,
        maximumAttempts: 2,
      },
      operation: {
        status: "validated",
        draftRepair: {
          status: "review_required",
          failedEvidenceRunId: "run_failed_preview-8",
        },
      },
    });
    expect(applyManagedWorkspace).toHaveBeenCalledTimes(1);

    const repaired = await runner.applyDraftRepair(planned.operation.id, repairPlan.fingerprint);
    expect(repaired).toMatchObject({
      status: "awaiting_preview",
      nextStep: "run_tag_assistant_preview",
      preview: {
        setupFingerprint: setupArtifactFingerprint(awaiting.operation),
        workspaceFingerprint: "workspace-repaired",
        previewVersionFingerprint: "preview-9",
      },
      operation: {
        status: "validated",
        draftRepair: {
          status: "passed_to_verification",
          ledger: {
            status: "passed_to_verification",
            attempts: [{
              attempt: 1,
              reasonCode: "workspace_entity_drift",
              result: "applied",
            }],
          },
        },
      },
    });
    expect(applyManagedWorkspace).toHaveBeenCalledTimes(2);
    expect(applyManagedWorkspace).toHaveBeenLastCalledWith(expect.objectContaining({
      status: "planned",
      specification: awaiting.operation.specification,
      generatedSetup: awaiting.operation.generatedSetup,
      plan: repairPlan,
      completedActionSignatures: [],
    }));
  });

  it("stops failed exact-draft repair when the unchanged setup has no known managed-entity repair", async () => {
    const reuseActions = readyPlan.actions.map((action) => ({ ...action, action: "reuse" as const }));
    const reusePlan = {
      ...readyPlan,
      fingerprint: fingerprintTrackingChangeActions(reuseActions),
      actions: reuseActions,
    };
    const planManagedWorkspace = vi.fn()
      .mockResolvedValueOnce({
        status: "planned",
        publicId: container.publicId,
        container,
        workspace,
        workspaceFingerprint: workspace.fingerprint,
        plan: readyPlan,
      })
      .mockResolvedValueOnce({
        status: "planned",
        publicId: container.publicId,
        container,
        workspace: { ...workspace, fingerprint: "workspace-final" },
        workspaceFingerprint: "workspace-final",
        plan: reusePlan,
      });
    const client = google({ planManagedWorkspace });
    const runner = new TrackingWorkflowRunner(await repository(), client);
    const planned = await runner.plan(request);
    if (planned.status === "blocked") throw new Error(planned.reason);
    const awaiting = await runner.resume(planned.operation.id);
    if (awaiting.status !== "awaiting_preview") throw new Error("Expected exact preview checkpoint.");

    await expect(runner.proposeDraftRepair(
      planned.operation.id,
      failedDraftRun(awaiting.operation),
    )).resolves.toMatchObject({
      status: "blocked",
      stage: "repair",
      reason: "no_known_repair",
      operation: {
        draftRepair: {
          status: "stopped",
          ledger: {
            status: "stopped_ambiguous",
            attempts: [{ result: "ambiguous", reasonCode: "no_known_repair" }],
          },
        },
      },
    });
    expect(client.applyManagedWorkspace).toHaveBeenCalledTimes(1);
  });

  it("publishes only after a separate approval bound to the reviewed version fingerprint", async () => {
    const client = google({
      publishApprovedVersion: vi.fn().mockResolvedValue({
        publishedAt: "2026-08-22T12:10:00.000Z",
        versionFingerprint: "version-8",
      }),
    });
    const runner = new TrackingWorkflowRunner(
      await repository(),
      client,
      () => new Date("2026-08-22T12:09:00.000Z"),
    );
    const planned = await runner.plan(request);
    if (planned.status === "blocked") throw new Error(planned.reason);
    const awaiting = await runner.resume(planned.operation.id);
    if (awaiting.status !== "awaiting_preview") throw new Error("Expected exact preview checkpoint.");
    runner.verifyDraft(planned.operation.id, exactDraftRun(awaiting.operation));
    expect(await runner.resume(planned.operation.id)).toMatchObject({ status: "versioned" });

    expect(() => runner.approvePublication(
      planned.operation.id,
      "another-version",
      "website_chat_human",
    )).toThrow("does not match the reviewed version fingerprint");
    expect(client.publishApprovedVersion).not.toHaveBeenCalled();

    expect(runner.approvePublication(
      planned.operation.id,
      "version-8",
      "website_chat_human",
    )).toMatchObject({
      status: "approved",
      nextStep: "publish",
      operation: {
        status: "approved",
        approval: { versionFingerprint: "version-8" },
      },
    });
    expect(await runner.publish(planned.operation.id, "version-8")).toMatchObject({
      status: "published",
      nextStep: "verify_publication",
      operation: {
        status: "published",
        publication: { versionFingerprint: "version-8" },
      },
    });
    expect(client.publishApprovedVersion).toHaveBeenCalledTimes(1);
    expect(await runner.publish(planned.operation.id, "version-8")).toMatchObject({ status: "published" });
    expect(client.publishApprovedVersion).toHaveBeenCalledTimes(1);
    expect(await runner.resume(planned.operation.id)).toMatchObject({
      status: "published",
      nextStep: "verify_publication",
      operation: {
        publication: { versionFingerprint: "version-8" },
      },
    });
  });

  it("binds live evidence and rolls back only after an exact failed publication run", async () => {
    const client = google({
      publishApprovedVersion: vi.fn().mockResolvedValue({
        publishedAt: "2026-08-22T12:10:00.000Z",
        versionFingerprint: "version-8",
      }),
      rollbackPublishedVersion: vi.fn().mockResolvedValue({
        targetVersionFingerprint: "live-7",
        status: "completed",
        completedAt: "2026-08-22T12:12:00.000Z",
      }),
    });
    const runner = new TrackingWorkflowRunner(
      await repository(),
      client,
      () => new Date("2026-08-22T12:09:00.000Z"),
    );
    const planned = await runner.plan(request);
    if (planned.status === "blocked") throw new Error(planned.reason);
    const awaiting = await runner.resume(planned.operation.id);
    if (awaiting.status !== "awaiting_preview") throw new Error("Expected exact preview checkpoint.");
    runner.verifyDraft(planned.operation.id, exactDraftRun(awaiting.operation));
    await runner.resume(planned.operation.id);
    runner.approvePublication(planned.operation.id, "version-8", "website_chat_human");
    const published = await runner.publish(planned.operation.id, "version-8");
    const failedEvidence = structuredClone(exactDraftRun(published.operation).evidence);
    failedEvidence.runId = "run_live_failed";
    failedEvidence.verdict = {
      code: "tag_fired_request_missing",
      browserVerification: "failed",
      platformConfirmation: "unverified",
      nextAction: "Review the recorded rollback target.",
    };

    expect(() => runner.verifyPublication(
      planned.operation.id,
      "another-version",
      failedEvidence,
    )).toThrow("does not match the published version fingerprint");
    expect(runner.verifyPublication(
      planned.operation.id,
      "version-8",
      failedEvidence,
    )).toMatchObject({
      status: "rollback_required",
      nextStep: "rollback",
      operation: {
        status: "rollback_required",
        postPublicationEvidenceId: "run_live_failed",
        rollback: { targetVersionFingerprint: "live-7", status: "required" },
      },
    });
    await expect(runner.rollback(
      planned.operation.id,
      "version-8",
      "another-target",
    )).rejects.toThrow("does not match the recorded prior-live fingerprint");
    expect(client.rollbackPublishedVersion).not.toHaveBeenCalled();
    await expect(runner.rollback(
      planned.operation.id,
      "version-8",
      "live-7",
    )).resolves.toMatchObject({
      status: "rolled_back",
      nextStep: "complete",
      operation: {
        status: "rolled_back",
        rollback: { targetVersionFingerprint: "live-7", status: "completed" },
      },
    });
    expect(client.rollbackPublishedVersion).toHaveBeenCalledTimes(1);
  });

  it("completes an exact passing live publication run without rollback", async () => {
    const client = google({
      publishApprovedVersion: vi.fn().mockResolvedValue({
        publishedAt: "2026-08-22T12:10:00.000Z",
        versionFingerprint: "version-8",
      }),
    });
    const runner = new TrackingWorkflowRunner(await repository(), client);
    const planned = await runner.plan(request);
    if (planned.status === "blocked") throw new Error(planned.reason);
    const awaiting = await runner.resume(planned.operation.id);
    if (awaiting.status !== "awaiting_preview") throw new Error("Expected exact preview checkpoint.");
    runner.verifyDraft(planned.operation.id, exactDraftRun(awaiting.operation));
    await runner.resume(planned.operation.id);
    runner.approvePublication(planned.operation.id, "version-8", "website_chat_human");
    const published = await runner.publish(planned.operation.id, "version-8");
    const passingEvidence = structuredClone(exactDraftRun(published.operation).evidence);
    passingEvidence.runId = "run_live_passed";

    expect(runner.verifyPublication(
      planned.operation.id,
      "version-8",
      passingEvidence,
    )).toMatchObject({
      status: "completed",
      nextStep: "complete",
      operation: {
        status: "completed",
        postPublicationEvidenceId: "run_live_passed",
      },
    });
    expect(client.rollbackPublishedVersion).not.toHaveBeenCalled();
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

  it("plans a generic phone-click setup through the durable boundary", async () => {
    const proposal = createKnownInteractionSetupProposal({
      interaction: "phone_click",
      scope: "current_page",
      pageUrl: request.pageUrl,
      measurementId: request.measurementId,
      container: request.container,
    });
    const genericPlan = createTrackingChangePlan(proposal.compiled.containerFile, {});
    const client = google({
      planManagedWorkspace: vi.fn().mockResolvedValue({
        status: "planned",
        publicId: container.publicId,
        container,
        workspace,
        workspaceFingerprint: workspace.fingerprint,
        plan: genericPlan,
      }),
    });
    const runner = new TrackingWorkflowRunner(await repository(), client);

    const planned = await runner.plan({ setup: proposal.setup, container: request.container });
    expect(planned).toMatchObject({
      status: "planned",
      operation: {
        id: "operation_setup_phone_click_current_page",
        specification: {
          id: "setup_phone_click_current_page",
          tagActions: [{ event: { name: "phone_click", parameters: [] } }],
        },
      },
    });
  });
});
