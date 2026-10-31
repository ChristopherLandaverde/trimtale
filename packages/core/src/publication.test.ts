import { describe, expect, it } from "vitest";
import { createTrackingChangePlan } from "./change-plan.js";
import { createSetupProposal } from "./generator.js";
import {
  approveTrackingRollback,
  approveTrackingVersion,
  publicationApprovalCurrent,
  publicationApprovalExpiresAt,
  recordPostPublicationEvidence,
  rollbackApprovalCurrent,
  rollbackApprovalExpiresAt,
} from "./publication.js";
import type { TrackingRunEvidenceV1 } from "./contracts.js";
import { validateTrackingOperation, type TrackingSetupOperationV1 } from "./tracking-operation.js";

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

function evidence(operation: TrackingSetupOperationV1, passed: boolean): TrackingRunEvidenceV1 {
  return {
    schemaVersion: 1, runId: passed ? "run_passed" : "run_failed", specificationId: operation.specification.id,
    startedAt: "2026-08-22T12:22:00.000Z",
    observations: {
      interaction: { type: "navigation_click", targetId: "pricing", attempted: true, submissionResult: "unknown" },
      outcome: { observed: passed, observable: true, evidenceType: "navigation_click" },
      dataLayer: { matchingEvents: passed ? [{}] : [] }, tagFired: passed,
      network: { ga4Requests: passed ? [{ url: "https://google.test/g/collect", observedAt: "2026-08-22T12:22:00.000Z" }] : [] },
      consent: { analyticsStorage: "granted" },
    },
    verdict: {
      code: passed ? "browser_verified" : "tag_fired_request_missing",
      browserVerification: passed ? "passed" : "failed", platformConfirmation: "unverified", nextAction: "Review.",
    },
  };
}

describe("publication approval and post-publication evidence", () => {
  it("binds short-lived approval to the exact immutable version", () => {
    const approved = approveTrackingVersion(versioned(), "practitioner@example.test", "2026-08-22T12:15:00.000Z");
    expect(approved.approval).toMatchObject({ versionFingerprint: "version-8" });
    expect(publicationApprovalCurrent(approved, Date.parse("2026-08-22T12:44:59.000Z"))).toBe(true);
    expect(publicationApprovalCurrent(approved, Date.parse("2026-08-22T12:45:01.000Z"))).toBe(false);
    if (approved.approval) approved.approval.versionFingerprint = "wrong";
    expect(publicationApprovalCurrent(approved, Date.parse("2026-08-22T12:20:00.000Z"))).toBe(false);
  });

  it("renews an unpublished approval and refuses to approve a published version", () => {
    const first = approveTrackingVersion(versioned(), "practitioner@example.test", "2026-08-22T12:15:00.000Z");
    expect(publicationApprovalExpiresAt(first)).toBe("2026-08-22T12:45:00.000Z");
    const renewed = approveTrackingVersion(first, "practitioner@example.test", "2026-08-22T13:00:00.000Z");
    expect(renewed.approval?.approvedAt).toBe("2026-08-22T13:00:00.000Z");
    expect(publicationApprovalCurrent(renewed, Date.parse("2026-08-22T13:10:00.000Z"))).toBe(true);
    const published = structuredClone(renewed);
    published.status = "published";
    published.publication = { publishedAt: "2026-08-22T13:05:00.000Z", versionFingerprint: "version-8" };
    expect(() => approveTrackingVersion(published, "practitioner@example.test")).toThrow("Only a versioned operation");
    expect(() => approveTrackingVersion(versioned(), "  ")).toThrow("requires an approver");
  });

  it("completes passing evidence and requires rollback for failing evidence", () => {
    const approved = approveTrackingVersion(versioned(), "practitioner", "2026-08-22T12:15:00.000Z");
    approved.status = "published";
    approved.publication = { publishedAt: "2026-08-22T12:20:00.000Z", versionFingerprint: "version-8" };
    expect(recordPostPublicationEvidence(approved, evidence(approved, true))).toMatchObject({ status: "completed", postPublicationEvidenceId: "run_passed" });
    expect(recordPostPublicationEvidence(approved, evidence(approved, false))).toMatchObject({
      status: "rollback_required",
      rollback: { targetVersionFingerprint: "live-7", status: "required" },
    });
  });

  it("binds a short-lived rollback approval to the recorded target and approver", () => {
    const approved = approveTrackingVersion(versioned(), "practitioner@example.test", "2026-08-22T12:15:00.000Z");
    approved.status = "published";
    approved.publication = { publishedAt: "2026-08-22T12:20:00.000Z", versionFingerprint: "version-8" };
    const failed = recordPostPublicationEvidence(approved, evidence(approved, false), "2026-08-22T12:22:00.000Z");
    expect(rollbackApprovalCurrent(failed)).toBe(false);
    expect(rollbackApprovalExpiresAt(failed)).toBeUndefined();

    const rollbackApproved = approveTrackingRollback(failed, " practitioner@example.test ", "2026-08-22T12:30:00.000Z");
    expect(rollbackApproved).toMatchObject({
      status: "rollback_required",
      rollback: {
        status: "required",
        targetVersionFingerprint: "live-7",
        approval: { approvedAt: "2026-08-22T12:30:00.000Z", approvedBy: "practitioner@example.test", targetVersionFingerprint: "live-7" },
      },
    });
    expect(rollbackApprovalExpiresAt(rollbackApproved)).toBe("2026-08-22T13:00:00.000Z");
    expect(rollbackApprovalCurrent(rollbackApproved, Date.parse("2026-08-22T12:59:59.000Z"))).toBe(true);
    expect(rollbackApprovalCurrent(rollbackApproved, Date.parse("2026-08-22T13:00:01.000Z"))).toBe(false);
    expect(rollbackApprovalCurrent(rollbackApproved, Date.parse("2026-08-22T12:29:59.000Z"))).toBe(false);

    const renewed = approveTrackingRollback(rollbackApproved, "practitioner@example.test", "2026-08-22T13:10:00.000Z");
    expect(rollbackApprovalCurrent(renewed, Date.parse("2026-08-22T13:20:00.000Z"))).toBe(true);
    expect(() => approveTrackingRollback(failed, "  ")).toThrow("requires an approver");
    expect(() => approveTrackingRollback(approved, "practitioner@example.test")).toThrow("Only a rollback-required operation");

    const retargeted = structuredClone(rollbackApproved);
    retargeted.rollback!.approval!.targetVersionFingerprint = "other-live";
    expect(rollbackApprovalCurrent(retargeted, Date.parse("2026-08-22T12:40:00.000Z"))).toBe(false);
    expect(validateTrackingOperation(retargeted)).toContain("rollback.approval.targetVersionFingerprint must match rollback.targetVersionFingerprint");
    const anonymous = structuredClone(rollbackApproved);
    anonymous.rollback!.approval!.approvedBy = "";
    expect(validateTrackingOperation(anonymous)).toContain("rollback.approval is invalid");
  });
});
