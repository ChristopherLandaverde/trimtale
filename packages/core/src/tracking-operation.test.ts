import { describe, expect, it } from "vitest";
import { createTrackingChangePlan } from "./change-plan.js";
import { createSetupProposal } from "./generator.js";
import {
  migrateTrackingOperation,
  nextTrackingOperationStep,
  validateTrackingOperation,
  type TrackingSetupOperationV1,
} from "./tracking-operation.js";

function plannedOperation(): TrackingSetupOperationV1 {
  const generatedSetup = createSetupProposal({
    intent: "Track navigation clicks",
    pageUrl: "https://example.test/",
    measurementId: "G-TEST123456",
    container: { accountId: "1", containerId: "10", publicId: "GTM-ABC123", name: "Lead site" },
    navigation: [{
      id: "pricing",
      text: "Pricing",
      href: "https://example.test/pricing",
      area: "nav",
      selector: "nav a[href='/pricing']",
    }],
  });
  return {
    schemaVersion: 1,
    id: "operation_navigation",
    status: "planned",
    createdAt: "2026-08-22T12:00:00.000Z",
    updatedAt: "2026-08-22T12:00:00.000Z",
    specification: generatedSetup.specification,
    generatedSetup: generatedSetup.containerFile,
    container: { publicId: "GTM-ABC123", path: "accounts/1/containers/10" },
    workspace: {
      path: "accounts/1/containers/10/workspaces/2",
      fingerprint: "workspace-before",
    },
    plan: createTrackingChangePlan(generatedSetup.containerFile, {}),
    completedActionSignatures: [],
  };
}

describe("tracking setup operation", () => {
  it("validates a planned operation and chooses application", () => {
    const operation = plannedOperation();
    expect(validateTrackingOperation(operation)).toEqual([]);
    expect(nextTrackingOperationStep(operation, {
      workspaceFingerprint: "workspace-before",
      liveVersionFingerprint: "live-before",
    })).toBe("apply");
  });

  it.each([
    ["applying", "reconcile_application"],
    ["applied", "validate"],
    ["validation_failed", "revise_plan"],
    ["validated", "run_preview"],
    ["versioned", "await_approval"],
    ["approved", "publish"],
    ["published", "verify_publication"],
    ["verification_failed", "rollback"],
    ["rollback_required", "rollback"],
    ["rolled_back", "complete"],
    ["completed", "complete"],
  ] as const)("resumes %s at %s", (status, expectedStep) => {
    const operation = operationAt(status);
    expect(validateTrackingOperation(operation)).toEqual([]);
    expect(nextTrackingOperationStep(operation, freshStateFor(operation))).toBe(expectedStep);
  });

  it("requires a fresh external-state read before choosing a resumable action", () => {
    expect(nextTrackingOperationStep(plannedOperation())).toBe("refresh_state");
  });

  it("forces reconciliation when persisted fingerprints are stale", () => {
    const operation = plannedOperation();
    expect(nextTrackingOperationStep(operation, {
      workspaceFingerprint: "workspace-changed",
      liveVersionFingerprint: "live-before",
    })).toBe("reconcile_state");

    const approved = operationAt("approved");
    expect(nextTrackingOperationStep(approved, {
      workspaceFingerprint: approved.workspace.fingerprint,
      liveVersionFingerprint: "unexpected-live-version",
    })).toBe("reconcile_state");
  });

  it("refuses to apply a conflicting plan", () => {
    const operation = plannedOperation();
    operation.plan.status = "conflict";
    operation.plan.actions[0] = {
      ...operation.plan.actions[0]!,
      action: "conflict",
      reason: "name_collision",
    };
    expect(validateTrackingOperation(operation)).toEqual([]);
    expect(nextTrackingOperationStep(operation, freshStateFor(operation))).toBe("revise_plan");
  });

  it("requires every planned action before application can be declared complete", () => {
    const operation = operationAt("applied");
    operation.completedActionSignatures = [];
    expect(validateTrackingOperation(operation)).toContain(
      "status requires every plan action to be completed",
    );
  });

  it("rejects approval for a different version fingerprint", () => {
    const operation = operationAt("approved");
    if (operation.approval) operation.approval.versionFingerprint = "wrong-version";
    expect(validateTrackingOperation(operation)).toContain(
      "approval.versionFingerprint must match version.fingerprint",
    );
  });

  it.each([
    ["validated", "validation", "validation is required for status"],
    ["versioned", "version", "version is required for status"],
    ["approved", "approval", "approval is required for status"],
    ["published", "publication", "publication is required for status"],
    ["completed", "postPublicationEvidenceId", "postPublicationEvidenceId is required for status"],
    ["rollback_required", "rollback", "rollback is required for status"],
  ] as const)("rejects %s without its required %s evidence", (status, field, expectedError) => {
    const operation = operationAt(status);
    delete (operation as unknown as Record<string, unknown>)[field];
    expect(validateTrackingOperation(operation)).toContain(expectedError);
  });

  it("migrates the planned-only schema and rejects unknown versions", () => {
    const current = plannedOperation();
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
    expect(migrateTrackingOperation(legacy)).toEqual(current);
    expect(() => migrateTrackingOperation({ schemaVersion: 99 })).toThrow("Unsupported tracking operation schema");
  });
});

function operationAt(status: TrackingSetupOperationV1["status"]): TrackingSetupOperationV1 {
  const operation = plannedOperation();
  operation.status = status;
  if (status !== "planned") {
    operation.completedActionSignatures = [...new Set(operation.plan.actions
      .filter(({ action }) => action !== "conflict")
      .map(({ entitySignature }) => entitySignature))];
  }
  if (["validation_failed"].includes(status)) {
    operation.validation = {
      status: "failed",
      checkedAt: operation.updatedAt,
      workspaceFingerprint: operation.workspace.fingerprint,
      errors: ["Compiler error"],
    };
  }
  if (["validated", "versioned", "approved", "published", "verification_failed", "rollback_required", "rolled_back", "completed"].includes(status)) {
    operation.validation = {
      status: "passed",
      checkedAt: operation.updatedAt,
      workspaceFingerprint: operation.workspace.fingerprint,
      errors: [],
    };
  }
  if (["versioned", "approved", "published", "verification_failed", "rollback_required", "rolled_back", "completed"].includes(status)) {
    operation.version = {
      path: "accounts/1/containers/10/versions/7",
      fingerprint: "version-seven",
      priorLiveVersionPath: "accounts/1/containers/10/versions/6",
      priorLiveVersionFingerprint: "live-before",
    };
  }
  if (["approved", "published", "verification_failed", "rollback_required", "rolled_back", "completed"].includes(status)) {
    operation.approval = {
      approvedAt: operation.updatedAt,
      approvedBy: "practitioner@example.test",
      versionFingerprint: "version-seven",
    };
  }
  if (["published", "verification_failed", "rollback_required", "rolled_back", "completed"].includes(status)) {
    operation.publication = { publishedAt: operation.updatedAt, versionFingerprint: "version-seven" };
  }
  if (["verification_failed", "rollback_required", "rolled_back", "completed"].includes(status)) {
    operation.postPublicationEvidenceId = status === "completed" ? "run_after_publish" : "run_publish_failed";
  }
  if (["rollback_required", "rolled_back"].includes(status)) {
    operation.rollback = {
      targetVersionFingerprint: "live-before",
      status: status === "rolled_back" ? "completed" : "required",
      ...(status === "rolled_back" ? { completedAt: operation.updatedAt } : {}),
    };
  }
  return operation;
}

function freshStateFor(operation: TrackingSetupOperationV1): {
  workspaceFingerprint: string;
  liveVersionFingerprint: string;
} {
  const published = ["published", "verification_failed", "rollback_required", "completed"].includes(operation.status);
  return {
    workspaceFingerprint: operation.workspace.fingerprint,
    liveVersionFingerprint: operation.status === "rolled_back"
      ? operation.version?.priorLiveVersionFingerprint ?? "live-before"
      : published
        ? operation.version?.fingerprint ?? "live-before"
        : operation.version?.priorLiveVersionFingerprint ?? "live-before",
  };
}
