import type { TrackingSetupOperationV1 } from "@gtm-observability/core";
import type { WorkflowResult } from "./workflow-bridge.js";

export interface SetupOperationStage {
  key: "planned" | "applying" | "validated" | "versioned" | "approval" | "publication" | "browser" | "platform" | "rollback";
  label: string;
  detail: string;
  passed: boolean;
}

export type SetupOperationAction =
  | { kind: "resume"; label: "Resume operation"; operationId: string }
  | { kind: "publish"; label: string; operationId: string; versionFingerprint: string }
  | { kind: "browserVerification"; label: "Start browser verification"; operationId: string }
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
const publicationPassed = new Set(["published", "verification_failed", "rollback_required", "rolled_back", "completed"]);
const browserPassed = new Set(["verification_failed", "rollback_required", "rolled_back", "completed"]);
const appliedPassed = new Set(["applied", "validated", "versioned", "approved", "published", "verification_failed", "rollback_required", "rolled_back", "completed"]);
const validatedPassed = new Set(["validated", "versioned", "approved", "published", "verification_failed", "rollback_required", "rolled_back", "completed"]);

function operationSummary(operation: TrackingSetupOperationV1): string {
  const actions = operation.plan.actions.length;
  if (operation.status === "completed") {
    return "Google collection request verified from browser evidence. Platform confirmation unavailable.";
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
  if (result.status === "published") return "verify_publication";
  if (result.status === "completed") return "platform_unavailable";
  if (result.status === "rollback_required") return "rollback_approval";
  if (result.status === "rolled_back") return "complete";
  return result.reason;
}

export function setupOperationGuidance(result: WorkflowResult): string {
  const reason = workflowReason(result);
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
  if (reason === "await_approval") return "Review the immutable version fingerprint before any separate publication step.";
  if (reason === "verify_publication") return "Approved GTM version was published. Run browser verification to confirm the Google collection request.";
  if (reason === "platform_unavailable") return "Google request verified from browser evidence. Platform confirmation remains unavailable.";
  if (reason === "rollback_approval") return "Browser verification failed. Rollback approval is required before restoring the prior live version.";
  if (reason === "complete") return "Rollback completed. The prior live version was restored.";
  if (reason === "fingerprint_mismatch") return "The approved fingerprint did not match the immutable version. Publication was not attempted.";
  if (reason === "operation_not_versioned") return "Only a versioned operation can be approved for publication.";
  return "Review the saved operation state before continuing. Nothing was published.";
}

function labelFor(result: WorkflowResult): string {
  if (result.status === "versioned") return "Awaiting approval";
  if (result.status === "published") return "Published";
  if (result.status === "completed") return "Google request verified";
  if (result.status === "rollback_required") return "Rollback required";
  if (result.status === "rolled_back") return "Rolled back";
  return result.status;
}

function assistantMessageFor(result: WorkflowResult, guidance: string): string {
  if (result.status === "blocked" || result.status === "paused") {
    return `Setup operation ${result.status}: ${guidance} Nothing was published.`;
  }
  if (result.status === "versioned") {
    return "GTM setup operation reached await_approval. Review the version fingerprint before any separate publication step.";
  }
  if (result.status === "published") {
    return "Approved GTM version was published. Browser verification is next; platform confirmation remains unavailable.";
  }
  if (result.status === "completed") {
    return "Google request verified from browser evidence. Platform confirmation remains unavailable.";
  }
  if (result.status === "rollback_required") {
    return `Browser verification failed. Rollback approval is required before restoring ${result.operation.rollback?.targetVersionFingerprint ?? "the prior live version"}.`;
  }
  if (result.status === "rolled_back") {
    return `Rollback completed. Prior live version ${result.operation.rollback?.targetVersionFingerprint ?? "unknown"} was restored.`;
  }
  return `Setup operation ${result.status}: ${guidance} Nothing was published.`;
}

function actionsFor(result: WorkflowResult): SetupOperationAction[] {
  if ((result.status === "blocked" || result.status === "paused") && result.operation) {
    return [{ kind: "resume", label: "Resume operation", operationId: result.operation.id }];
  }
  if (result.status === "versioned" && result.operation.version) {
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
  if (result.status === "rollback_required" && result.operation.rollback) {
    return [{
      kind: "rollback",
      label: `Rollback ${result.operation.rollback.targetVersionFingerprint}`,
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
    || result.status === "published"
    || result.status === "completed"
    || result.status === "rollback_required"
    || result.status === "rolled_back";
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
    {
      key: "approval",
      label: "Publication approval",
      detail: operation?.approval
        ? `Approved fingerprint ${operation.approval.versionFingerprint}`
        : "Separate approval is required; nothing was published",
      passed: Boolean(status && approvalPassed.has(status)),
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
        ? `Restored prior live version ${operation.rollback?.targetVersionFingerprint ?? "unknown"}`
        : operation?.status === "rollback_required"
          ? `Approval required to restore ${operation.rollback?.targetVersionFingerprint ?? "unknown"}`
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
