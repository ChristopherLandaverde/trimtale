import { validateTrackingSpecification, type TrackingSpecificationV1 } from "./contracts.js";
import type { TrackingChangePlan } from "./change-plan.js";
import type { GtmContainerExport } from "./types.js";

export const TRACKING_OPERATION_SCHEMA_VERSION = 1 as const;

export type TrackingOperationStatus =
  | "planned"
  | "applying"
  | "applied"
  | "validation_failed"
  | "validated"
  | "versioned"
  | "approved"
  | "published"
  | "verification_failed"
  | "rollback_required"
  | "rolled_back"
  | "completed";

export type TrackingOperationNextStep =
  | "apply"
  | "reconcile_application"
  | "validate"
  | "revise_plan"
  | "create_version"
  | "await_approval"
  | "publish"
  | "verify_publication"
  | "rollback"
  | "complete"
  | "refresh_state"
  | "reconcile_state";

export interface TrackingSetupOperationV1 {
  schemaVersion: typeof TRACKING_OPERATION_SCHEMA_VERSION;
  id: string;
  status: TrackingOperationStatus;
  createdAt: string;
  updatedAt: string;
  specification: TrackingSpecificationV1;
  generatedSetup: GtmContainerExport;
  container: { publicId: string; path: string };
  workspace: { path: string; fingerprint: string };
  plan: TrackingChangePlan;
  completedActionSignatures: string[];
  validation?: {
    status: "passed" | "failed";
    checkedAt: string;
    workspaceFingerprint: string;
    errors: string[];
    workspaceChanges?: unknown[];
    previewVersionFingerprint?: string;
  };
  version?: {
    path: string;
    fingerprint: string;
    priorLiveVersionPath: string;
    priorLiveVersionFingerprint: string;
  };
  approval?: {
    approvedAt: string;
    approvedBy: string;
    versionFingerprint: string;
  };
  publication?: { publishedAt: string; versionFingerprint: string };
  postPublicationEvidenceId?: string;
  rollback?: {
    targetVersionFingerprint: string;
    status: "required" | "completed";
    completedAt?: string;
    /** The verified account that approved restoring the target, and when. */
    approval?: {
      approvedAt: string;
      approvedBy: string;
      targetVersionFingerprint: string;
    };
  };
}

type JsonRecord = Record<string, unknown>;

const statuses = new Set<TrackingOperationStatus>([
  "planned", "applying", "applied", "validation_failed", "validated", "versioned",
  "approved", "published", "verification_failed", "rollback_required", "rolled_back", "completed",
]);

const nextSteps: Record<TrackingOperationStatus, TrackingOperationNextStep> = {
  planned: "apply",
  applying: "reconcile_application",
  applied: "validate",
  validation_failed: "revise_plan",
  validated: "create_version",
  versioned: "await_approval",
  approved: "publish",
  published: "verify_publication",
  verification_failed: "rollback",
  rollback_required: "rollback",
  rolled_back: "complete",
  completed: "complete",
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonempty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validTimestamp(value: unknown): value is string {
  return nonempty(value) && !Number.isNaN(Date.parse(value));
}

function requires(status: TrackingOperationStatus, candidates: TrackingOperationStatus[]): boolean {
  return candidates.includes(status);
}

export function validateTrackingOperation(value: unknown): string[] {
  if (!isRecord(value)) return ["tracking operation must be an object"];
  const errors: string[] = [];
  if (value.schemaVersion !== TRACKING_OPERATION_SCHEMA_VERSION) errors.push("schemaVersion must be 1");
  if (!nonempty(value.id)) errors.push("id is required");
  if (!statuses.has(value.status as TrackingOperationStatus)) errors.push("status is unsupported");
  if (!validTimestamp(value.createdAt)) errors.push("createdAt is invalid");
  if (!validTimestamp(value.updatedAt)) errors.push("updatedAt is invalid");
  errors.push(...validateTrackingSpecification(value.specification).map((error) => `specification.${error}`));
  if (isRecord(value.specification) && value.specification.status !== "confirmed") {
    errors.push("specification must be confirmed");
  }

  const generated = isRecord(value.generatedSetup) ? value.generatedSetup : undefined;
  const generatedContainer = generated && isRecord(generated.containerVersion) ? generated.containerVersion : undefined;
  if (!generatedContainer) errors.push("generatedSetup.containerVersion is required");
  const container = isRecord(value.container) ? value.container : undefined;
  if (!container || !nonempty(container.publicId) || !nonempty(container.path)) errors.push("container is invalid");
  const generatedContainerIdentity = generatedContainer && isRecord(generatedContainer.container)
    ? generatedContainer.container
    : undefined;
  if (!generatedContainerIdentity || !nonempty(generatedContainerIdentity.publicId)) {
    errors.push("generatedSetup.containerVersion.container is required");
  }
  if (container && generatedContainerIdentity && generatedContainerIdentity.publicId !== container.publicId) {
    errors.push("generatedSetup publicId must match container.publicId");
  }
  const workspace = isRecord(value.workspace) ? value.workspace : undefined;
  if (!workspace || !nonempty(workspace.path) || !nonempty(workspace.fingerprint)) errors.push("workspace is invalid");
  if (container && workspace && nonempty(container.path) && nonempty(workspace.path)
    && !workspace.path.startsWith(`${container.path}/workspaces/`)) {
    errors.push("workspace.path must belong to container.path");
  }

  const plan = isRecord(value.plan) ? value.plan : undefined;
  if (!plan || plan.schemaVersion !== 1 || !["ready", "conflict"].includes(String(plan.status))
    || !nonempty(plan.fingerprint) || !Array.isArray(plan.actions)) {
    errors.push("plan is invalid");
  }
  const planActions = plan && Array.isArray(plan.actions) ? plan.actions : [];
  const malformedPlanAction = planActions.some((action) => !isRecord(action)
    || !["tag", "trigger", "variable", "builtInVariable"].includes(String(action.kind))
    || !["create", "reuse", "no_op", "update", "conflict"].includes(String(action.action))
    || !nonempty(action.generatedName)
    || !nonempty(action.entitySignature)
    || (action.action === "update" && !nonempty(action.existingId)));
  if (malformedPlanAction) errors.push("plan.actions contains an invalid action");
  if (plan && Array.isArray(plan.actions)) {
    const hasConflict = planActions.some((action) => isRecord(action) && action.action === "conflict");
    if ((plan.status === "conflict") !== hasConflict) errors.push("plan.status must reflect conflict actions");
  }
  const actionSignatures = planActions.flatMap((action) =>
    isRecord(action) && nonempty(action.entitySignature) ? [action.entitySignature] : []);
  if (new Set(actionSignatures).size !== actionSignatures.length) {
    errors.push("plan action signatures must be unique");
  }
  if (!Array.isArray(value.completedActionSignatures)
    || value.completedActionSignatures.some((item) => !nonempty(item))) {
    errors.push("completedActionSignatures is invalid");
  } else {
    const completed = value.completedActionSignatures as string[];
    if (new Set(completed).size !== completed.length) errors.push("completedActionSignatures must be unique");
    if (plan && Array.isArray(plan.actions)) {
      const planned = new Set(planActions.flatMap((action) => isRecord(action) && nonempty(action.entitySignature) ? [action.entitySignature] : []));
      if (completed.some((signature) => !planned.has(signature))) {
        errors.push("completedActionSignatures must belong to the plan");
      }
    }
  }

  if (!statuses.has(value.status as TrackingOperationStatus)) return [...new Set(errors)];
  const status = value.status as TrackingOperationStatus;
  const completed = Array.isArray(value.completedActionSignatures)
    ? new Set(value.completedActionSignatures.filter(nonempty))
    : new Set<string>();
  const actionableSignatures = planActions.flatMap((action) =>
    isRecord(action) && action.action !== "conflict" && nonempty(action.entitySignature)
      ? [action.entitySignature]
      : []);
  if (status === "planned" && completed.size > 0) errors.push("planned operations cannot contain completed actions");
  if (status !== "planned" && status !== "applying" && plan?.status !== "ready") {
    errors.push("only ready plans may advance beyond planning");
  }
  if (requires(status, [
    "applied", "validation_failed", "validated", "versioned", "approved", "published",
    "verification_failed", "rollback_required", "rolled_back", "completed",
  ]) && actionableSignatures.some((signature) => !completed.has(signature))) {
    errors.push("status requires every plan action to be completed");
  }
  const validation = isRecord(value.validation) ? value.validation : undefined;
  const validationErrors = validation && Array.isArray(validation.errors) ? validation.errors : undefined;
  const requiresFailedValidation = status === "validation_failed";
  const requiresPassedValidation = requires(status, [
    "validated", "versioned", "approved", "published", "verification_failed",
    "rollback_required", "rolled_back", "completed",
  ]);
  if ((requiresFailedValidation || requiresPassedValidation) && !validation) {
    errors.push("validation is required for status");
  } else if (validation) {
    if (!validTimestamp(validation.checkedAt) || !nonempty(validation.workspaceFingerprint)
      || !Array.isArray(validation.errors) || validation.errors.some((item) => typeof item !== "string")) {
      errors.push("validation is invalid");
    }
    if (validation.workspaceChanges !== undefined && !Array.isArray(validation.workspaceChanges)) {
      errors.push("validation.workspaceChanges is invalid");
    }
    if (workspace && validation.workspaceFingerprint !== workspace.fingerprint) {
      errors.push("validation.workspaceFingerprint must match workspace.fingerprint");
    }
    if (requiresFailedValidation && (validation.status !== "failed" || !validationErrors || validationErrors.length === 0)) {
      errors.push("validation_failed requires failing validation evidence");
    }
    if (requiresPassedValidation && (validation.status !== "passed" || !validationErrors || validationErrors.length !== 0)) {
      errors.push("status requires passing validation evidence");
    }
  }

  const versionStatuses: TrackingOperationStatus[] = [
    "versioned", "approved", "published", "verification_failed", "rollback_required", "rolled_back", "completed",
  ];
  const version = isRecord(value.version) ? value.version : undefined;
  if (requires(status, versionStatuses) && !version) errors.push("version is required for status");
  if (version && (!nonempty(version.path) || !nonempty(version.fingerprint)
    || !nonempty(version.priorLiveVersionPath) || !nonempty(version.priorLiveVersionFingerprint))) {
    errors.push("version is invalid");
  }

  const approvalStatuses: TrackingOperationStatus[] = [
    "approved", "published", "verification_failed", "rollback_required", "rolled_back", "completed",
  ];
  const approval = isRecord(value.approval) ? value.approval : undefined;
  if (requires(status, approvalStatuses) && !approval) errors.push("approval is required for status");
  if (approval) {
    if (!validTimestamp(approval.approvedAt) || !nonempty(approval.approvedBy) || !nonempty(approval.versionFingerprint)) {
      errors.push("approval is invalid");
    }
    if (version && approval.versionFingerprint !== version.fingerprint) {
      errors.push("approval.versionFingerprint must match version.fingerprint");
    }
  }

  const publicationStatuses: TrackingOperationStatus[] = [
    "published", "verification_failed", "rollback_required", "rolled_back", "completed",
  ];
  const publication = isRecord(value.publication) ? value.publication : undefined;
  if (requires(status, publicationStatuses) && !publication) errors.push("publication is required for status");
  if (publication) {
    if (!validTimestamp(publication.publishedAt) || !nonempty(publication.versionFingerprint)) errors.push("publication is invalid");
    if (version && publication.versionFingerprint !== version.fingerprint) {
      errors.push("publication.versionFingerprint must match version.fingerprint");
    }
  }

  if (requires(status, ["verification_failed", "rollback_required", "rolled_back", "completed"])
    && !nonempty(value.postPublicationEvidenceId)) {
    errors.push("postPublicationEvidenceId is required for status");
  }

  const rollback = isRecord(value.rollback) ? value.rollback : undefined;
  if (requires(status, ["rollback_required", "rolled_back"]) && !rollback) errors.push("rollback is required for status");
  if (rollback) {
    if (!nonempty(rollback.targetVersionFingerprint)) errors.push("rollback.targetVersionFingerprint is required");
    if (version && rollback.targetVersionFingerprint !== version.priorLiveVersionFingerprint) {
      errors.push("rollback target must match the prior live version fingerprint");
    }
    const expectedRollbackStatus = status === "rolled_back" ? "completed" : "required";
    if (requires(status, ["rollback_required", "rolled_back"]) && rollback.status !== expectedRollbackStatus) {
      errors.push(`rollback status must be ${expectedRollbackStatus}`);
    }
    if (rollback.status === "completed" && !validTimestamp(rollback.completedAt)) {
      errors.push("completed rollback requires completedAt");
    }
    if (rollback.approval !== undefined) {
      const rollbackApproval = isRecord(rollback.approval) ? rollback.approval : {};
      if (!validTimestamp(rollbackApproval.approvedAt) || !nonempty(rollbackApproval.approvedBy)
        || !nonempty(rollbackApproval.targetVersionFingerprint)) {
        errors.push("rollback.approval is invalid");
      }
      if (rollbackApproval.targetVersionFingerprint !== rollback.targetVersionFingerprint) {
        errors.push("rollback.approval.targetVersionFingerprint must match rollback.targetVersionFingerprint");
      }
    }
  }
  return [...new Set(errors)];
}

export function assertTrackingOperation(value: unknown): asserts value is TrackingSetupOperationV1 {
  const errors = validateTrackingOperation(value);
  if (errors.length > 0) throw new Error(errors.join(" "));
}

export function nextTrackingOperationStep(
  operation: TrackingSetupOperationV1,
  freshState?: { workspaceFingerprint: string; liveVersionFingerprint: string },
): TrackingOperationNextStep {
  assertTrackingOperation(operation);
  if (!freshState) return "refresh_state";
  if (freshState) {
    if (freshState.workspaceFingerprint !== operation.workspace.fingerprint) return "reconcile_state";
    if (operation.version) {
      const afterPublication = requires(operation.status, [
        "published", "verification_failed", "rollback_required", "completed",
      ]);
      const expectedLive = afterPublication
        ? operation.version.fingerprint
        : operation.status === "rolled_back"
          ? operation.version.priorLiveVersionFingerprint
          : operation.version.priorLiveVersionFingerprint;
      if (freshState.liveVersionFingerprint !== expectedLive) return "reconcile_state";
    }
  }
  if (operation.status === "planned" && operation.plan.status === "conflict") return "revise_plan";
  return nextSteps[operation.status];
}

export function migrateTrackingOperation(value: unknown): TrackingSetupOperationV1 {
  if (!isRecord(value)) throw new Error("Tracking operation must be an object.");
  if (value.schemaVersion === TRACKING_OPERATION_SCHEMA_VERSION) {
    assertTrackingOperation(value);
    return structuredClone(value);
  }
  if (value.schemaVersion !== 0) throw new Error("Unsupported tracking operation schema.");
  const migrated = {
    schemaVersion: TRACKING_OPERATION_SCHEMA_VERSION,
    id: value.id,
    status: "planned",
    createdAt: value.createdAt,
    updatedAt: value.createdAt,
    specification: value.specification,
    generatedSetup: value.generatedSetup,
    container: { publicId: value.publicId, path: containerPathFromWorkspace(value.workspacePath) },
    workspace: { path: value.workspacePath, fingerprint: value.workspaceFingerprint },
    plan: value.plan,
    completedActionSignatures: [],
  };
  assertTrackingOperation(migrated);
  return migrated;
}

function containerPathFromWorkspace(workspacePath: unknown): string | undefined {
  if (!nonempty(workspacePath)) return undefined;
  const marker = "/workspaces/";
  const index = workspacePath.indexOf(marker);
  return index > 0 ? workspacePath.slice(0, index) : undefined;
}
