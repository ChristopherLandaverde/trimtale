import type {
  FormSetupRequest,
  SetupRequest,
  TrackingRunEvidenceV1,
  TrackingSetupOperationV1,
} from "@trimtale/core";

export type GtmWorkflowAction =
  | "start"
  | "resume"
  | "get"
  | "approve"
  | "publish"
  | "browserVerification"
  | "approveRollback"
  | "rollback";
export type TrackingWorkflowRequest = SetupRequest | FormSetupRequest;

export type WorkflowResult<Operation = TrackingSetupOperationV1> =
  | {
    status: "versioned";
    operation: Operation;
    nextStep: "await_approval";
  }
  | {
    status: "approved";
    operation: Operation;
    nextStep: "publish";
    approvalExpiresAt?: string;
  }
  | {
    status: "published";
    operation: Operation;
    nextStep: "verify_publication";
  }
  | {
    status: "completed";
    operation: Operation;
    nextStep: "platform_unavailable";
  }
  | {
    status: "rollback_required";
    operation: Operation;
    nextStep: "rollback_approval";
  }
  | {
    status: "rollback_approved";
    operation: Operation;
    nextStep: "rollback";
    approvalExpiresAt?: string;
  }
  | {
    status: "rolled_back";
    operation: Operation;
    nextStep: "complete";
  }
  | {
    status: "blocked" | "paused";
    operation?: Operation;
    stage?: "planning" | "application" | "validation" | "version" | "approval" | "publication" | "browser_verification" | "rollback";
    reason: string;
    details?: unknown;
  };

export type WorkflowBridgeResponse<Operation = TrackingSetupOperationV1> =
  | { ok: true; result: WorkflowResult<Operation> }
  | { ok: false; error: string };

export interface GtmWorkflowRequestMessage {
  type?: string;
  action?: GtmWorkflowAction;
  request?: TrackingWorkflowRequest;
  operationId?: string;
  versionFingerprint?: string;
  /**
   * The container ID the practitioner typed to confirm publication or rollback. No
   * approver is ever sent: the backend records its verified Google session account.
   */
  confirmation?: string;
  evidence?: TrackingRunEvidenceV1;
  targetVersionFingerprint?: string;
}

export function workflowResultFromStoredOperation(
  operation: Record<string, unknown>,
): WorkflowResult<Record<string, unknown>> {
  const status = typeof operation.status === "string" ? operation.status : "unknown";
  if (status === "versioned") {
    return { status: "versioned", operation, nextStep: "await_approval" };
  }
  if (status === "approved") {
    return { status: "approved", operation, nextStep: "publish" };
  }
  if (status === "published") {
    return { status: "published", operation, nextStep: "verify_publication" };
  }
  if (status === "completed") {
    return { status: "completed", operation, nextStep: "platform_unavailable" };
  }
  if (status === "rollback_required") {
    const rollback = operation.rollback;
    const approved = typeof rollback === "object" && rollback !== null && "approval" in rollback;
    return approved
      ? { status: "rollback_approved", operation, nextStep: "rollback" }
      : { status: "rollback_required", operation, nextStep: "rollback_approval" };
  }
  if (status === "rolled_back") {
    return { status: "rolled_back", operation, nextStep: "complete" };
  }
  if (status === "planned") {
    return { status: "paused", operation, stage: "planning", reason: "ready_to_apply" };
  }
  if (status === "applying") {
    return { status: "paused", operation, stage: "application", reason: "partial_application" };
  }
  if (status === "applied") {
    return { status: "paused", operation, stage: "validation", reason: "ready_to_validate" };
  }
  if (status === "validated") {
    return { status: "paused", operation, stage: "version", reason: "ready_to_version" };
  }
  if (status === "validation_failed") {
    return { status: "blocked", operation, stage: "validation", reason: "validation_failed" };
  }
  return { status: "blocked", operation, stage: "version", reason: `operation_${status}` };
}
