import { describe, expect, it } from "vitest";
import type { TrackingSetupOperationV1 } from "@trimtale/core";
import { presentSetupOperation } from "./setup-operation-presenter.js";
import type { WorkflowResult } from "./workflow-bridge.js";

function operation(status: TrackingSetupOperationV1["status"]): TrackingSetupOperationV1 {
  const base: TrackingSetupOperationV1 = {
    schemaVersion: 1,
    id: "operation_spec_navigation",
    status,
    createdAt: "2026-08-30T20:00:00.000Z",
    updatedAt: "2026-08-30T20:01:00.000Z",
    specification: {
      schemaVersion: 1,
      id: "spec_navigation",
      status: "confirmed",
      originalIntent: "Track navigation clicks",
      interaction: { type: "navigation_click" },
      conversionOutcome: { type: "navigation", practitionerConfirmed: true },
      event: {
        name: "navigation_click",
        requiredParameters: ["link_text", "link_url"],
        optionalParameters: [],
      },
      targets: [{
        id: "nav_services",
        label: "Services",
        selector: "header a[href=\"/services\"]",
        pageUrl: "http://127.0.0.1:14173/",
      }],
      successEvidence: [],
    },
    generatedSetup: {
      exportFormatVersion: 2,
      exportTime: "2026-08-30T20:00:00.000Z",
      containerVersion: {
        path: "accounts/1/containers/10/versions/0",
        accountId: "1",
        containerId: "10",
        containerVersionId: "0",
        name: "Trimtale import",
        description: "fixture",
        container: {
          path: "accounts/1/containers/10",
          accountId: "1",
          containerId: "10",
          name: "Lead site",
          publicId: "GTM-TEST123",
          usageContext: ["WEB"],
        },
        tag: [],
        trigger: [],
        builtInVariable: [],
      },
    },
    container: { publicId: "GTM-TEST123", path: "accounts/1/containers/10" },
    workspace: {
      path: "accounts/1/containers/10/workspaces/99",
      fingerprint: "workspace-final",
    },
    plan: {
      schemaVersion: 1,
      status: "ready",
      fingerprint: "plan-ready",
      actions: [{
        kind: "tag",
        action: "create",
        generatedName: "GA4 Event - navigation_click",
        entitySignature: "tag:navigation_click",
      }, {
        kind: "trigger",
        action: "create",
        generatedName: "Navigation Click Trigger",
        entitySignature: "trigger:navigation_click",
      }],
    },
    completedActionSignatures: ["tag:navigation_click", "trigger:navigation_click"],
  };

  if (["versioned", "approved", "published", "verification_failed", "rollback_required", "rolled_back", "completed"].includes(status)) {
    base.validation = {
      status: "passed",
      checkedAt: "2026-08-30T20:01:00.000Z",
      workspaceFingerprint: "workspace-final",
      errors: [],
    };
  }
  if (["versioned", "approved", "published", "verification_failed", "rollback_required", "rolled_back", "completed"].includes(status)) {
    base.version = {
      path: "accounts/1/containers/10/versions/8",
      fingerprint: "version-8",
      priorLiveVersionPath: "accounts/1/containers/10/versions/7",
      priorLiveVersionFingerprint: "live-7",
    };
  }
  if (["published", "verification_failed", "rollback_required", "rolled_back", "completed"].includes(status)) {
    base.approval = {
      approvedAt: "2026-08-30T20:02:00.000Z",
      approvedBy: "website assistant",
      versionFingerprint: "version-8",
    };
    base.publication = {
      publishedAt: "2026-08-30T20:03:00.000Z",
      versionFingerprint: "version-8",
    };
  }
  if (status === "completed") base.postPublicationEvidenceId = "run_nav_services";
  if (status === "rollback_required" || status === "rolled_back") {
    base.postPublicationEvidenceId = "run_nav_services";
    base.rollback = {
      targetVersionFingerprint: "live-7",
      status: status === "rolled_back" ? "completed" : "required",
      ...(status === "rolled_back" ? { completedAt: "2026-08-30T20:05:00.000Z" } : {}),
    };
  }
  return base;
}

function terminalResult(status: "versioned" | "published" | "completed" | "rollback_required" | "rolled_back"): WorkflowResult {
  const nextStep = {
    versioned: "await_approval",
    published: "verify_publication",
    completed: "platform_unavailable",
    rollback_required: "rollback_approval",
    rolled_back: "complete",
  }[status];
  return { status, operation: operation(status), nextStep } as WorkflowResult;
}

function stage(result: WorkflowResult, key: string) {
  const match = presentSetupOperation(result).stages.find((item) => item.key === key);
  expect(match).toBeDefined();
  return match!;
}

describe("presentSetupOperation", () => {
  it("keeps platform confirmation unavailable for every terminal status", () => {
    for (const status of ["versioned", "published", "completed", "rollback_required", "rolled_back"] as const) {
      const platform = stage(terminalResult(status), "platform");
      expect(platform.detail).toBe("Platform confirmation unavailable");
      expect(platform.passed).toBe(false);
    }
  });

  it("shows only publish approval for a versioned operation", () => {
    const presentation = presentSetupOperation(terminalResult("versioned"));

    expect(presentation.label).toBe("Awaiting approval");
    expect(presentation.actions).toEqual([{
      kind: "publish",
      label: "Publish version-8",
      operationId: "operation_spec_navigation",
      versionFingerprint: "version-8",
    }]);
  });

  it("shows browser verification only for a published operation", () => {
    const presentation = presentSetupOperation(terminalResult("published"));

    expect(presentation.label).toBe("Published");
    expect(presentation.actions).toEqual([{
      kind: "browserVerification",
      label: "Start browser verification",
      operationId: "operation_spec_navigation",
    }]);
    expect(stage(terminalResult("published"), "browser")).toMatchObject({
      detail: "Run browser verification after publication",
      passed: false,
    });
  });

  it("marks completed browser verification without exposing follow-up actions", () => {
    const presentation = presentSetupOperation(terminalResult("completed"));

    expect(presentation.actions).toEqual([]);
    expect(presentation.assistantMessage).toContain("Google request verified from browser evidence");
    expect(stage(terminalResult("completed"), "browser")).toMatchObject({
      detail: "Google request verified",
      passed: true,
    });
  });

  it("shows rollback approval only for rollback-required operations", () => {
    const presentation = presentSetupOperation(terminalResult("rollback_required"));

    expect(presentation.label).toBe("Rollback required");
    expect(presentation.guidance).toContain("Rollback approval is required");
    expect(presentation.actions).toEqual([{
      kind: "rollback",
      label: "Rollback live-7",
      operationId: "operation_spec_navigation",
      targetVersionFingerprint: "live-7",
    }]);
    expect(stage(terminalResult("rollback_required"), "rollback")).toMatchObject({
      detail: "Approval required to restore live-7",
      passed: false,
    });
  });

  it("renders rolled-back completion without platform confirmation or actions", () => {
    const presentation = presentSetupOperation(terminalResult("rolled_back"));

    expect(presentation.actions).toEqual([]);
    expect(presentation.assistantMessage).toContain("Rollback completed");
    expect(stage(terminalResult("rolled_back"), "rollback")).toMatchObject({
      detail: "Restored prior live version live-7",
      passed: true,
    });
  });

  it("shows resume only when a paused or blocked result has an operation", () => {
    expect(presentSetupOperation({
      status: "paused",
      reason: "partial_application",
      operation: operation("applying"),
    }).actions).toEqual([{
      kind: "resume",
      label: "Resume operation",
      operationId: "operation_spec_navigation",
    }]);
    expect(presentSetupOperation({
      status: "blocked",
      reason: "not_accessible",
    }).actions).toEqual([]);
  });
});
