import type { TrackingRunEvidenceV1 } from "./contracts.js";
import { assertTrackingOperation, type TrackingSetupOperationV1 } from "./tracking-operation.js";

export const PUBLICATION_APPROVAL_LIFETIME_MS = 30 * 60 * 1_000;
/** Rollback changes the live container too, so its approval lasts exactly as long as a publication approval. */
export const ROLLBACK_APPROVAL_LIFETIME_MS = PUBLICATION_APPROVAL_LIFETIME_MS;

/** True while an approval stamped at `approvedAt` is no older than the approval lifetime. */
function approvalWindowOpen(approvedAt: string, now: number, lifetime: number): boolean {
  const stamped = Date.parse(approvedAt);
  return Number.isFinite(stamped) && now >= stamped && now - stamped <= lifetime;
}

function approvalWindowEnd(approvedAt: string | undefined, lifetime: number): string | undefined {
  const stamped = approvedAt ? Date.parse(approvedAt) : Number.NaN;
  return Number.isFinite(stamped) ? new Date(stamped + lifetime).toISOString() : undefined;
}

export function approveTrackingVersion(
  operation: TrackingSetupOperationV1,
  approvedBy: string,
  approvedAt = new Date().toISOString(),
): TrackingSetupOperationV1 {
  assertTrackingOperation(operation);
  // An approved but unpublished version may be approved again; that is how a stale approval is renewed.
  if ((operation.status !== "versioned" && operation.status !== "approved") || !operation.version) {
    throw new Error("Only a versioned operation can be approved.");
  }
  if (!approvedBy.trim()) throw new Error("Publication approval requires an approver.");
  const approved = structuredClone(operation);
  approved.status = "approved";
  approved.updatedAt = approvedAt;
  approved.approval = { approvedAt, approvedBy: approvedBy.trim(), versionFingerprint: operation.version.fingerprint };
  assertTrackingOperation(approved);
  return approved;
}

export function publicationApprovalCurrent(operation: TrackingSetupOperationV1, now = Date.now()): boolean {
  if (!operation.approval || !operation.version) return false;
  return operation.approval.versionFingerprint === operation.version.fingerprint
    && approvalWindowOpen(operation.approval.approvedAt, now, PUBLICATION_APPROVAL_LIFETIME_MS);
}

/** When the recorded approval stops authorizing publication, or undefined without one. */
export function publicationApprovalExpiresAt(operation: TrackingSetupOperationV1): string | undefined {
  return approvalWindowEnd(operation.approval?.approvedAt, PUBLICATION_APPROVAL_LIFETIME_MS);
}

/**
 * Records an explicit approval to restore the recorded prior live version. Like a
 * publication approval it names one exact target, one approver and a 30-minute window;
 * nothing is rolled back here. A pending approval may be renewed the same way.
 */
export function approveTrackingRollback(
  operation: TrackingSetupOperationV1,
  approvedBy: string,
  approvedAt = new Date().toISOString(),
): TrackingSetupOperationV1 {
  assertTrackingOperation(operation);
  if (operation.status !== "rollback_required" || !operation.rollback || operation.rollback.status !== "required") {
    throw new Error("Only a rollback-required operation can be approved for rollback.");
  }
  if (!approvedBy.trim()) throw new Error("Rollback approval requires an approver.");
  const approved = structuredClone(operation);
  approved.updatedAt = approvedAt;
  approved.rollback = {
    ...operation.rollback,
    approval: {
      approvedAt,
      approvedBy: approvedBy.trim(),
      targetVersionFingerprint: operation.rollback.targetVersionFingerprint,
    },
  };
  assertTrackingOperation(approved);
  return approved;
}

export function rollbackApprovalCurrent(operation: TrackingSetupOperationV1, now = Date.now()): boolean {
  const approval = operation.rollback?.approval;
  if (!approval || !operation.rollback) return false;
  return approval.targetVersionFingerprint === operation.rollback.targetVersionFingerprint
    && approvalWindowOpen(approval.approvedAt, now, ROLLBACK_APPROVAL_LIFETIME_MS);
}

/** When the recorded rollback approval stops authorizing rollback, or undefined without one. */
export function rollbackApprovalExpiresAt(operation: TrackingSetupOperationV1): string | undefined {
  return approvalWindowEnd(operation.rollback?.approval?.approvedAt, ROLLBACK_APPROVAL_LIFETIME_MS);
}

export function recordPostPublicationEvidence(
  operation: TrackingSetupOperationV1,
  evidence: TrackingRunEvidenceV1,
  updatedAt = new Date().toISOString(),
): TrackingSetupOperationV1 {
  assertTrackingOperation(operation);
  if (operation.status !== "published" || !operation.version) throw new Error("Only a published operation accepts post-publication evidence.");
  if (evidence.specificationId !== operation.specification.id) throw new Error("Post-publication evidence belongs to another specification.");
  const result = structuredClone(operation);
  result.updatedAt = updatedAt;
  result.postPublicationEvidenceId = evidence.runId;
  if (evidence.verdict.browserVerification === "passed" && evidence.verdict.code === "browser_verified") {
    result.status = "completed";
  } else {
    result.status = "rollback_required";
    result.rollback = { targetVersionFingerprint: operation.version.priorLiveVersionFingerprint, status: "required" };
  }
  assertTrackingOperation(result);
  return result;
}
