import type { TrackingRunEvidenceV1 } from "./contracts.js";
import { assertTrackingOperation, type TrackingSetupOperationV1 } from "./tracking-operation.js";

export const PUBLICATION_APPROVAL_LIFETIME_MS = 30 * 60 * 1_000;

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
  const approvedAt = Date.parse(operation.approval.approvedAt);
  return operation.approval.versionFingerprint === operation.version.fingerprint
    && Number.isFinite(approvedAt)
    && now >= approvedAt
    && now - approvedAt <= PUBLICATION_APPROVAL_LIFETIME_MS;
}

/** When the recorded approval stops authorizing publication, or undefined without one. */
export function publicationApprovalExpiresAt(operation: TrackingSetupOperationV1): string | undefined {
  const approvedAt = operation.approval ? Date.parse(operation.approval.approvedAt) : Number.NaN;
  return Number.isFinite(approvedAt) ? new Date(approvedAt + PUBLICATION_APPROVAL_LIFETIME_MS).toISOString() : undefined;
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
