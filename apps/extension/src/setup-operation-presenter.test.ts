import { describe, expect, it } from "vitest";
import type { TrackingSetupOperationV1 } from "@trimtale/core";
import { presentPublicationReview, presentRollbackReview, presentSetupOperation } from "./setup-operation-presenter.js";
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
  if (["approved", "published", "verification_failed", "rollback_required", "rolled_back", "completed"].includes(status)) {
    base.approval = {
      approvedAt: "2026-08-30T20:02:00.000Z",
      approvedBy: "practitioner@example.test",
      versionFingerprint: "version-8",
    };
  }
  if (["published", "verification_failed", "rollback_required", "rolled_back", "completed"].includes(status)) {
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

function terminalResult(status: "versioned" | "approved" | "published" | "completed" | "rollback_required" | "rolled_back"): WorkflowResult {
  const nextStep = {
    versioned: "await_approval",
    approved: "publish",
    published: "verify_publication",
    completed: "platform_unavailable",
    rollback_required: "rollback_approval",
    rolled_back: "complete",
  }[status];
  return { status, operation: operation(status), nextStep } as WorkflowResult;
}

function rollbackApproved(): TrackingSetupOperationV1 {
  const approved = operation("rollback_required");
  approved.rollback = {
    ...approved.rollback!,
    approval: { approvedAt: "2026-08-30T20:06:00.000Z", approvedBy: "practitioner@example.test", targetVersionFingerprint: "live-7" },
  };
  return approved;
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

  it("offers review, never a direct publish, for a versioned operation", () => {
    const presentation = presentSetupOperation(terminalResult("versioned"));

    expect(presentation.label).toBe("Awaiting approval");
    expect(presentation.actions).toEqual([{
      kind: "review",
      label: "Review and approve",
      operationId: "operation_spec_navigation",
      versionFingerprint: "version-8",
    }]);
    expect(presentation.assistantMessage).toBe("Version version-8 is ready and nothing is published. Review exactly what will change, then approve it.");
    expect(presentation.assistantMessage).not.toMatch(/await_approval/);
    expect(stage(terminalResult("versioned"), "approval")).toMatchObject({
      passed: false,
      detail: "Separate approval is required; nothing was published",
    });
  });

  it("offers publish only after a recorded approval, naming the approver", () => {
    const presentation = presentSetupOperation(terminalResult("approved"));

    expect(presentation.label).toBe("Approved, not published");
    expect(presentation.actions).toEqual([{
      kind: "publish",
      label: "Publish version-8",
      operationId: "operation_spec_navigation",
      versionFingerprint: "version-8",
    }]);
    expect(presentation.assistantMessage).toMatch(/^Approved by practitioner@example\.test\. Nothing is published yet\. Publish before .+, or approve again\.$/);
    expect(stage(terminalResult("approved"), "approval")).toMatchObject({
      passed: true,
      detail: "Approved fingerprint version-8 by practitioner@example.test",
    });
    expect(stage(terminalResult("approved"), "publication").passed).toBe(false);
  });

  it.each([
    ["approval_expired", "approved", /older than 30 minutes/],
    ["approver_changed", "approved", /different Google account/],
    ["approval_required", "versioned", /separate approval first/],
    ["fingerprint_mismatch", "approved", /did not match/],
  ] as const)("routes a blocked %s publish back to review", (reason, status, guidance) => {
    const presentation = presentSetupOperation({
      status: "blocked",
      stage: "approval",
      reason,
      operation: operation(status),
    } as WorkflowResult);
    expect(presentation.guidance).toMatch(guidance);
    expect(presentation.assistantMessage).toMatch(/^Setup stopped\. /);
    // The outcome is stated exactly once, whether the guidance or the suffix states it.
    expect(presentation.assistantMessage.match(/nothing was published/gi)).toHaveLength(1);
    expect(presentation.actions).toEqual([expect.objectContaining({ kind: "review", versionFingerprint: "version-8" })]);
    const approval = presentation.stages.find((item) => item.key === "approval");
    if (reason === "approval_expired" || reason === "approver_changed") expect(approval?.passed).toBe(false);
    expect(presentation.stages.find((item) => item.key === "publication")?.passed).toBe(false);
  });

  it("presents exactly what one publish would change", () => {
    expect(presentPublicationReview(operation("versioned") as never)).toEqual({
      title: "Publish version-8 to GTM-TEST123?",
      consequence: "Publishing makes version-8 the live version of GTM-TEST123, replacing live-7. Every page that loads this container gets the change.",
      rows: [
        { label: "Container", value: "GTM-TEST123 · accounts/1/containers/10" },
        { label: "Workspace", value: "99 · accounts/1/containers/10/workspaces/99" },
        { label: "Version", value: "version-8" },
        { label: "Replaces", value: "live-7" },
      ],
      changes: [
        "Create tag “GA4 Event - navigation_click”",
        "Create trigger “Navigation Click Trigger”",
      ],
      approvalNote: expect.stringContaining("connected Google account as the approver"),
      confirmation: "GTM-TEST123",
      approveLabel: "Approve version-8",
    });
    expect(presentPublicationReview(operation("published") as never)).toBeUndefined();
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

  it("offers rollback review, never a direct rollback, for a rollback-required operation", () => {
    const presentation = presentSetupOperation(terminalResult("rollback_required"));

    expect(presentation.label).toBe("Rollback required");
    expect(presentation.guidance).toContain("Review the rollback, then approve it");
    expect(presentation.actions).toEqual([{
      kind: "rollbackReview",
      label: "Review rollback",
      operationId: "operation_spec_navigation",
      targetVersionFingerprint: "live-7",
    }]);
    expect(stage(terminalResult("rollback_required"), "rollback")).toMatchObject({
      detail: "Separate approval is required to restore live-7; nothing was rolled back",
      passed: false,
    });
    expect(JSON.stringify(presentation)).not.toContain("website assistant");
  });

  it("offers rollback only after a recorded rollback approval, naming the approver", () => {
    const result = { status: "rollback_approved", operation: rollbackApproved(), nextStep: "rollback" } as WorkflowResult;
    const presentation = presentSetupOperation(result);

    expect(presentation.label).toBe("Rollback approved, not rolled back");
    expect(presentation.actions).toEqual([{
      kind: "rollback",
      label: "Roll back to live-7",
      operationId: "operation_spec_navigation",
      targetVersionFingerprint: "live-7",
    }]);
    expect(presentation.assistantMessage).toMatch(
      /^Rollback to live-7 approved by practitioner@example\.test\. Nothing is rolled back yet\. Roll back before .+, or approve again\.$/,
    );
    expect(stage(result, "rollback")).toMatchObject({
      detail: "Approved restoring live-7 by practitioner@example.test",
      passed: false,
    });
    // The publication approval stays what it was; a rollback approval does not rewrite it.
    expect(stage(result, "approval")).toMatchObject({ passed: true, detail: "Approved fingerprint version-8 by practitioner@example.test" });
  });

  it.each([
    ["approval_expired", rollbackApproved, /older than 30 minutes, so nothing was rolled back/],
    ["approver_changed", rollbackApproved, /different Google account/],
    ["approval_required", () => operation("rollback_required"), /separate approval first/],
    ["confirmation_mismatch", () => operation("rollback_required"), /^The typed container ID did not match\. Review the rollback and type it again\.$/],
    ["rollback_fingerprint_mismatch", rollbackApproved, /did not match the recorded prior live version/],
  ] as const)("routes a blocked %s rollback back to rollback review", (reason, build, guidance) => {
    const presentation = presentSetupOperation({
      status: "blocked",
      stage: "rollback",
      reason,
      operation: build(),
    } as WorkflowResult);
    expect(presentation.guidance).toMatch(guidance);
    expect(presentation.assistantMessage).toMatch(/^Rollback stopped\. /);
    expect(presentation.assistantMessage.match(/nothing was rolled back/gi)).toHaveLength(1);
    expect(presentation.assistantMessage).not.toContain("Nothing was published");
    expect(presentation.actions).toEqual([expect.objectContaining({ kind: "rollbackReview", targetVersionFingerprint: "live-7" })]);
    // A refused rollback leaves the earlier publication approval and publication intact.
    expect(presentation.stages.find((item) => item.key === "approval")?.passed).toBe(true);
    expect(presentation.stages.find((item) => item.key === "publication")?.passed).toBe(true);
    expect(presentation.stages.find((item) => item.key === "rollback")?.passed).toBe(false);
    if (reason === "approval_expired") {
      expect(presentation.stages.find((item) => item.key === "rollback")?.detail).toBe("Rollback approval for live-7 expired; approve again");
    }
  });

  it("presents exactly what one rollback would change", () => {
    expect(presentRollbackReview(operation("rollback_required"))).toEqual({
      title: "Roll back GTM-TEST123 to live-7?",
      consequence: "Rolling back makes live-7 the live version of GTM-TEST123 again, replacing version-8. Every page that loads this container gets the change.",
      rows: [
        { label: "Container", value: "GTM-TEST123 · accounts/1/containers/10" },
        { label: "Restores", value: "live-7" },
        { label: "Replaces", value: "version-8" },
      ],
      changes: [],
      approvalNote: "The backend records your connected Google account as the approver. The approval lasts 30 minutes, and rolling back is a separate step.",
      confirmation: "GTM-TEST123",
      approveLabel: "Approve rollback to live-7",
    });
    expect(presentRollbackReview(rollbackApproved())?.approveLabel).toBe("Approve rollback to live-7");
    expect(presentRollbackReview(operation("published"))).toBeUndefined();
    expect(presentRollbackReview(operation("rolled_back"))).toBeUndefined();
  });

  it("renders rolled-back completion with the recorded approver and no actions", () => {
    const rolledBack = operation("rolled_back");
    rolledBack.rollback = {
      ...rolledBack.rollback!,
      approval: { approvedAt: "2026-08-30T20:04:00.000Z", approvedBy: "practitioner@example.test", targetVersionFingerprint: "live-7" },
    };
    const result = { status: "rolled_back", operation: rolledBack, nextStep: "complete" } as WorkflowResult;
    const presentation = presentSetupOperation(result);

    expect(presentation.actions).toEqual([]);
    expect(presentation.assistantMessage).toContain("Rollback completed");
    expect(stage(result, "rollback")).toMatchObject({
      detail: "Restored prior live version live-7; approved by practitioner@example.test",
      passed: true,
    });
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
