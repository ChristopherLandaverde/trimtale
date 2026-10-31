import { publicationApprovalExpiresAt, rollbackApprovalExpiresAt, type TrackingSetupOperationV1 } from "@trimtale/core";
import type { WorkflowResult } from "./workflow-bridge.js";

export interface SetupOperationStage {
  key: "planned" | "applying" | "validated" | "versioned" | "approval" | "publication" | "browser" | "platform" | "rollback";
  label: string;
  detail: string;
  passed: boolean;
}

export type SetupOperationAction =
  | { kind: "resume"; label: "Resume operation"; operationId: string }
  | { kind: "review"; label: "Review and approve"; operationId: string; versionFingerprint: string }
  | { kind: "publish"; label: string; operationId: string; versionFingerprint: string }
  | { kind: "browserVerification"; label: "Start browser verification"; operationId: string }
  | { kind: "rollbackReview"; label: "Review rollback"; operationId: string; targetVersionFingerprint: string }
  | { kind: "rollback"; label: string; operationId: string; targetVersionFingerprint: string };

export interface SetupOperationPresentation {
  label: string;
  guidance: string;
  assistantMessage: string;
  stages: SetupOperationStage[];
  actions: SetupOperationAction[];
}

const approvalPassed = new Set([
  "versioned", "approved", "published", "verification_failed", "rollback_required", "rolled_back", "completed",
]);
// Approval is recorded only from "approved" on; a versioned operation still awaits it.
const approvalRecorded = new Set(["approved", "published", "verification_failed", "rollback_required", "rolled_back", "completed"]);
const publicationPassed = new Set(["published", "verification_failed", "rollback_required", "rolled_back", "completed"]);
const browserPassed = new Set(["verification_failed", "rollback_required", "rolled_back", "completed"]);
const appliedPassed = new Set(["applied", "validated", "versioned", "approved", "published", "verification_failed", "rollback_required", "rolled_back", "completed"]);
const validatedPassed = new Set(["validated", "versioned", "approved", "published", "verification_failed", "rollback_required", "rolled_back", "completed"]);

function operationSummary(operation: TrackingSetupOperationV1): string {
  const actions = operation.plan.actions.length;
  if (operation.status === "completed") {
    return "Google collection request verified from browser evidence. Platform confirmation unavailable.";
  }
  if (operation.status === "rollback_required" && operation.rollback?.approval) {
    return `Browser verification failed; rollback to prior live version ${operation.rollback.targetVersionFingerprint} is approved and waiting for a separate rollback step.`;
  }
  if (operation.status === "rollback_required") {
    return `Browser verification failed; rollback approval is required for prior live version ${operation.rollback?.targetVersionFingerprint ?? "unknown"}.`;
  }
  if (operation.status === "rolled_back") {
    return `Rolled back to prior live version ${operation.rollback?.targetVersionFingerprint ?? "unknown"}.`;
  }
  if (operation.status === "published" && operation.publication) {
    return `Published approved version ${operation.publication.versionFingerprint}. Browser verification is next.`;
  }
  if (operation.status === "approved" && operation.version) {
    return `Approved version ${operation.version.fingerprint} is waiting for a separate publish step. Prior live version: ${operation.version.priorLiveVersionFingerprint}.`;
  }
  if (operation.status === "versioned" && operation.version) {
    return `Immutable version ${operation.version.fingerprint} is ready for separate publication approval. Prior live version: ${operation.version.priorLiveVersionFingerprint}.`;
  }
  if (operation.status === "validation_failed") return "Workspace validation failed; no version was created.";
  if (operation.status === "validated") return "Workspace validation passed; immutable version creation is next.";
  if (operation.status === "applied") return "Owned GTM entities were applied; workspace validation is next.";
  if (operation.status === "applying") return `Applying owned GTM entities (${operation.completedActionSignatures.length}/${actions} complete).`;
  return `Tracking change plan is ready with ${actions} action${actions === 1 ? "" : "s"}.`;
}

export function workflowReason(result: WorkflowResult): string {
  if (result.status === "versioned") return "await_approval";
  if (result.status === "approved") return "ready_to_publish";
  if (result.status === "published") return "verify_publication";
  if (result.status === "completed") return "platform_unavailable";
  if (result.status === "rollback_required") return "rollback_approval";
  if (result.status === "rollback_approved") return "ready_to_roll_back";
  if (result.status === "rolled_back") return "complete";
  return result.reason;
}

/** Copy for a refused rollback request. Rollback reuses publication's refusal codes. */
function rollbackGuidance(reason: string): string {
  if (reason === "approval_required") return "Rolling back needs a separate approval first. Review the rollback, then approve it.";
  if (reason === "approval_expired") return "The rollback approval is older than 30 minutes, so nothing was rolled back. Review and approve again.";
  if (reason === "approver_changed") return "A different Google account is connected than the one that approved the rollback. Approve again as this account.";
  if (reason === "confirmation_mismatch") return "The typed container ID did not match, so the rollback was not approved.";
  if (reason === "rollback_fingerprint_mismatch") return "The target did not match the recorded prior live version. Review the rollback again.";
  if (reason === "operation_not_rollback_required") return "Only a failed publication awaiting rollback can be rolled back. Reload the setup operation.";
  return "Review the saved rollback state before continuing.";
}

export function setupOperationGuidance(result: WorkflowResult): string {
  const reason = workflowReason(result);
  if (result.status === "blocked" && result.stage === "rollback") return rollbackGuidance(reason);
  if (reason === "ready_to_apply") return "Ready to apply owned GTM entities from the saved plan.";
  if (reason === "partial_application" || reason === "partial_failure") {
    return "Interrupted after a partial application. Resume re-reads GTM state and applies only incomplete owned actions.";
  }
  if (reason === "ready_to_validate") return "Owned entities were applied. Resume runs workspace validation before any version is created.";
  if (reason === "ready_to_version") return "Workspace validation passed. Resume creates the immutable version for separate approval.";
  if (reason === "validation_failed") return "Workspace validation failed. Review the validation errors before changing or publishing anything.";
  if (reason === "stale_workspace") return "The managed workspace changed since planning. Recheck GTM access before resuming.";
  if (reason === "stale_plan") return "The GTM entities no longer match the saved plan. Regenerate and review the setup before applying.";
  if (reason === "ownership_conflict" || reason === "plan_conflict") {
    return "An existing GTM entity conflicts with the owned plan. Manual review is required before any write.";
  }
  if (reason === "sync_conflict") return "The managed workspace has synchronization conflicts. Resolve them in GTM before resuming.";
  if (reason === "capacity_blocked" || reason === "workspace_unavailable") {
    return "A managed workspace is unavailable. Free capacity or resolve workspace ownership before continuing.";
  }
  if (reason === "not_accessible" || reason === "ambiguous") {
    return "The connected Google account cannot uniquely access the observed container. Reconnect or choose the correct account.";
  }
  if (reason === "version_creation_blocked") return "GTM refused version creation. Review validation evidence and current workspace state.";
  if (reason === "await_approval") return "Review exactly what will publish, then approve it. Approving does not publish.";
  if (reason === "ready_to_publish") return "Approved. Publishing is a separate step and must happen within 30 minutes of approval.";
  if (reason === "approval_required") return "Publishing needs a separate approval first. Review the version, then approve it.";
  if (reason === "approval_expired") return "The approval is older than 30 minutes, so nothing was published. Review and approve again.";
  if (reason === "approver_changed") return "A different Google account is connected than the one that approved. Approve again as this account.";
  if (reason === "confirmation_mismatch") return "The typed container ID did not match, so nothing was approved.";
  if (reason === "operation_not_approved") return "Only an approved, unpublished version can be published.";
  if (reason === "verify_publication") return "Approved GTM version was published. Run browser verification to confirm the Google collection request.";
  if (reason === "platform_unavailable") return "Google request verified from browser evidence. Platform confirmation remains unavailable.";
  if (reason === "rollback_approval") return "Browser verification failed. Review the rollback, then approve it. Approving does not roll back.";
  if (reason === "ready_to_roll_back") return "Rollback approved. Rolling back is a separate step and must happen within 30 minutes of approval.";
  if (reason === "complete") return "Rollback completed. The prior live version was restored.";
  if (reason === "fingerprint_mismatch") return "The fingerprint did not match the immutable version, so nothing was approved or published.";
  if (reason === "operation_not_versioned") return "Only a versioned operation can be approved for publication.";
  return "Review the saved operation state before continuing. Nothing was published.";
}

function labelFor(result: WorkflowResult): string {
  if (result.status === "versioned") return "Awaiting approval";
  if (result.status === "approved") return "Approved, not published";
  if (result.status === "blocked") return "Blocked";
  if (result.status === "paused") return "Paused";
  if (result.status === "published") return "Published";
  if (result.status === "completed") return "Google request verified";
  if (result.status === "rollback_required") return "Rollback required";
  if (result.status === "rollback_approved") return "Rollback approved, not rolled back";
  if (result.status === "rolled_back") return "Rolled back";
  return result.status;
}

function localTime(iso: string | undefined): string {
  return iso ? ` before ${new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "";
}

function assistantMessageFor(result: WorkflowResult, guidance: string): string {
  if (result.status === "blocked" && result.stage === "rollback") {
    return `Rollback stopped. ${guidance} Nothing was rolled back.`;
  }
  if (result.status === "blocked" || result.status === "paused") {
    return `Setup ${result.status === "blocked" ? "stopped" : "paused"}. ${guidance} Nothing was published.`;
  }
  if (result.status === "versioned") {
    return `Version ${result.operation.version?.fingerprint ?? ""} is ready and nothing is published. Review exactly what will change, then approve it.`;
  }
  if (result.status === "approved") {
    const until = localTime(publicationApprovalExpiresAt(result.operation));
    return `Approved by ${result.operation.approval?.approvedBy ?? "the connected Google account"}. Nothing is published yet. Publish${until}, or approve again.`;
  }
  if (result.status === "published") {
    return "Approved GTM version was published. Browser verification is next; platform confirmation remains unavailable.";
  }
  if (result.status === "completed") {
    return "Google request verified from browser evidence. Platform confirmation remains unavailable.";
  }
  if (result.status === "rollback_required") {
    return `Browser verification failed. Review the rollback to ${result.operation.rollback?.targetVersionFingerprint ?? "the prior live version"}, then approve it.`;
  }
  if (result.status === "rollback_approved") {
    const target = result.operation.rollback?.targetVersionFingerprint ?? "the prior live version";
    const approver = result.operation.rollback?.approval?.approvedBy ?? "the connected Google account";
    return `Rollback to ${target} approved by ${approver}. Nothing is rolled back yet. Roll back${localTime(rollbackApprovalExpiresAt(result.operation))}, or approve again.`;
  }
  if (result.status === "rolled_back") {
    return `Rollback completed. Prior live version ${result.operation.rollback?.targetVersionFingerprint ?? "unknown"} was restored.`;
  }
  return `Setup operation ${result.status}: ${guidance} Nothing was published.`;
}

function rollbackReviewAction(operation: TrackingSetupOperationV1): SetupOperationAction[] {
  return operation.status === "rollback_required" && operation.rollback
    ? [{
      kind: "rollbackReview",
      label: "Review rollback",
      operationId: operation.id,
      targetVersionFingerprint: operation.rollback.targetVersionFingerprint,
    }]
    : [];
}

function actionsFor(result: WorkflowResult): SetupOperationAction[] {
  if (result.status === "blocked" && result.stage === "rollback") {
    return result.operation ? rollbackReviewAction(result.operation) : [];
  }
  const reviewable = result.operation?.version
    && (result.operation.status === "versioned" || result.operation.status === "approved");
  if (result.status === "blocked" && result.stage === "approval" && reviewable && result.operation?.version) {
    return [{
      kind: "review",
      label: "Review and approve",
      operationId: result.operation.id,
      versionFingerprint: result.operation.version.fingerprint,
    }];
  }
  if ((result.status === "blocked" || result.status === "paused") && result.operation) {
    return [{ kind: "resume", label: "Resume operation", operationId: result.operation.id }];
  }
  if (result.status === "versioned" && result.operation.version) {
    return [{
      kind: "review",
      label: "Review and approve",
      operationId: result.operation.id,
      versionFingerprint: result.operation.version.fingerprint,
    }];
  }
  if (result.status === "approved" && result.operation.version) {
    return [{
      kind: "publish",
      label: `Publish ${result.operation.version.fingerprint}`,
      operationId: result.operation.id,
      versionFingerprint: result.operation.version.fingerprint,
    }];
  }
  if (result.status === "published") {
    return [{ kind: "browserVerification", label: "Start browser verification", operationId: result.operation.id }];
  }
  if (result.status === "rollback_required") return rollbackReviewAction(result.operation);
  if (result.status === "rollback_approved" && result.operation.rollback?.approval) {
    return [{
      kind: "rollback",
      label: `Roll back to ${result.operation.rollback.targetVersionFingerprint}`,
      operationId: result.operation.id,
      targetVersionFingerprint: result.operation.rollback.targetVersionFingerprint,
    }];
  }
  return [];
}

export function presentSetupOperation(result: WorkflowResult): SetupOperationPresentation {
  const operation = result.operation;
  const status = operation?.status;
  const guidance = setupOperationGuidance(result);
  const reason = workflowReason(result);
  const terminalWorkflow = result.status === "versioned"
    || result.status === "approved"
    || result.status === "published"
    || result.status === "completed"
    || result.status === "rollback_required"
    || result.status === "rollback_approved"
    || result.status === "rolled_back";
  const rollbackRefused = result.status === "blocked" && result.stage === "rollback";
  // A blocked publish whose approval expired or belongs to another account must not keep a passed approval stage.
  const approvalUnusable = result.status === "blocked" && !rollbackRefused
    && (reason === "approval_expired" || reason === "approver_changed");
  const rollbackApprovalUnusable = rollbackRefused && (reason === "approval_expired" || reason === "approver_changed");
  const rollbackTarget = operation?.rollback?.targetVersionFingerprint ?? "unknown";
  const rollbackApprover = operation?.rollback?.approval?.approvedBy;
  const blockedReason = terminalWorkflow ? "Operation reached version creation" : result.reason;
  const stages: SetupOperationStage[] = [
    { key: "planned", label: "Tracking change plan", detail: operation ? operationSummary(operation) : blockedReason, passed: Boolean(status) },
    {
      key: "applying",
      label: "Owned entities applied",
      detail: operation
        ? reason === "partial_application" || reason === "partial_failure"
          ? guidance
          : `${operation.completedActionSignatures.length}/${operation.plan.actions.length} actions complete`
        : blockedReason,
      passed: Boolean(status && appliedPassed.has(status)),
    },
    {
      key: "validated",
      label: "Workspace validated",
      detail: operation?.validation
        ? operation.validation.status === "failed"
          ? guidance
          : `${operation.validation.status} at ${operation.validation.checkedAt}`
        : "Validation has not run yet",
      passed: Boolean(status && validatedPassed.has(status)),
    },
    {
      key: "versioned",
      label: "Immutable version created",
      detail: operation?.version ? `Version fingerprint ${operation.version.fingerprint}` : "No immutable version yet",
      passed: Boolean(status && approvalPassed.has(status)),
    },
    approvalUnusable
      ? {
        key: "approval",
        label: "Publication approval",
        detail: reason === "approval_expired"
          ? `Approval for ${operation?.approval?.versionFingerprint ?? "this version"} expired; approve again`
          : `Approval by ${operation?.approval?.approvedBy ?? "another account"} no longer matches the connected account`,
        passed: false,
      }
      : {
        key: "approval",
        label: "Publication approval",
        detail: operation?.approval
          ? `Approved fingerprint ${operation.approval.versionFingerprint} by ${operation.approval.approvedBy}`
          : "Separate approval is required; nothing was published",
        passed: Boolean(status && approvalRecorded.has(status)),
      },
    {
      key: "publication",
      label: "Published version",
      detail: operation?.publication
        ? `Published version ${operation.publication.versionFingerprint}`
        : "No version was published",
      passed: Boolean(status && publicationPassed.has(status)),
    },
    {
      key: "browser",
      label: "Browser verification",
      detail: operation?.status === "completed"
        ? "Google request verified"
        : operation?.status === "rollback_required"
          ? `Verification failed; prior live version ${operation.rollback?.targetVersionFingerprint ?? "unknown"} is ready for rollback approval`
          : "Run browser verification after publication",
      passed: Boolean(status && browserPassed.has(status)),
    },
    { key: "platform", label: "Platform confirmation", detail: "Platform confirmation unavailable", passed: false },
    {
      key: "rollback",
      label: "Rollback",
      detail: operation?.status === "rolled_back"
        ? `Restored prior live version ${rollbackTarget}${rollbackApprover ? `; approved by ${rollbackApprover}` : ""}`
        : rollbackApprovalUnusable
          ? reason === "approval_expired"
            ? `Rollback approval for ${rollbackTarget} expired; approve again`
            : `Rollback approval by ${rollbackApprover ?? "another account"} no longer matches the connected account`
          : operation?.status === "rollback_required" && rollbackApprover
            ? `Approved restoring ${rollbackTarget} by ${rollbackApprover}`
            : operation?.status === "rollback_required"
              ? `Separate approval is required to restore ${rollbackTarget}; nothing was rolled back`
              : "No rollback required",
      passed: status === "rolled_back",
    },
  ];
  return {
    label: labelFor(result),
    guidance,
    assistantMessage: assistantMessageFor(result, guidance),
    stages,
    actions: actionsFor(result),
  };
}

export interface PublicationReviewRow {
  label: string;
  value: string;
}

/** A typed-confirmation review shown before approving any change to the live container. */
export interface PublicationReview {
  title: string;
  consequence: string;
  rows: PublicationReviewRow[];
  changes: string[];
  approvalNote: string;
  /** The exact text the practitioner must type; the backend checks it again. */
  confirmation: string;
  approveLabel: string;
}

const changeVerbs: Record<string, string> = {
  create: "Create",
  update: "Update",
  reuse: "Reuse existing",
  no_op: "Leave unchanged",
  conflict: "Conflict on",
};

const entityNouns: Record<string, string> = {
  tag: "tag",
  trigger: "trigger",
  variable: "variable",
  builtInVariable: "built-in variable",
};

/** What one publish would change, built only from the stored operation. */
export function presentPublicationReview(operation: TrackingSetupOperationV1): PublicationReview | undefined {
  const version = operation.version;
  if (!version || (operation.status !== "versioned" && operation.status !== "approved")) return undefined;
  const publicId = operation.container.publicId;
  const workspaceId = operation.workspace.path.split("/").at(-1) ?? operation.workspace.path;
  return {
    title: `Publish ${version.fingerprint} to ${publicId}?`,
    consequence: `Publishing makes ${version.fingerprint} the live version of ${publicId}, replacing ${version.priorLiveVersionFingerprint}. Every page that loads this container gets the change.`,
    rows: [
      { label: "Container", value: `${publicId} · ${operation.container.path}` },
      { label: "Workspace", value: `${workspaceId} · ${operation.workspace.path}` },
      { label: "Version", value: version.fingerprint },
      { label: "Replaces", value: version.priorLiveVersionFingerprint },
    ],
    changes: operation.plan.actions.map((action) =>
      `${changeVerbs[action.action] ?? action.action} ${entityNouns[action.kind] ?? action.kind} “${action.generatedName}”`),
    approvalNote: "The backend records your connected Google account as the approver. The approval lasts 30 minutes, and publishing is a separate step.",
    confirmation: publicId,
    approveLabel: `Approve ${version.fingerprint}`,
  };
}

/** What one rollback would change, built only from the stored operation. */
export function presentRollbackReview(operation: TrackingSetupOperationV1): PublicationReview | undefined {
  const version = operation.version;
  const rollback = operation.rollback;
  if (!version || !rollback || operation.status !== "rollback_required" || rollback.status !== "required") return undefined;
  const publicId = operation.container.publicId;
  const target = rollback.targetVersionFingerprint;
  return {
    title: `Roll back ${publicId} to ${target}?`,
    consequence: `Rolling back makes ${target} the live version of ${publicId} again, replacing ${version.fingerprint}. Every page that loads this container gets the change.`,
    rows: [
      { label: "Container", value: `${publicId} · ${operation.container.path}` },
      { label: "Restores", value: target },
      { label: "Replaces", value: version.fingerprint },
    ],
    changes: [],
    approvalNote: "The backend records your connected Google account as the approver. The approval lasts 30 minutes, and rolling back is a separate step.",
    confirmation: publicId,
    approveLabel: `Approve rollback to ${target}`,
  };
}
