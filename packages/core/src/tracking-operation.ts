import { validateTrackingSpecification, type TrackingSpecificationV1 } from "./contracts.js";
import { validateTrackingSetup, type TrackingSetupV1 } from "./setup-contract.js";
import {
  MAX_REPAIR_ATTEMPT_LIMIT,
  verifiedDraftBindingCurrent,
  type DraftRepairLedgerV1,
} from "./draft-verification.js";
import {
  fingerprintTrackingChangeActions,
  type GtmEntityKind,
  type TrackingChangeAction,
  type TrackingChangePlan,
} from "./change-plan.js";
import type { GtmContainerExport } from "./types.js";

export const TRACKING_OPERATION_SCHEMA_VERSION = 1 as const;

export type TrackingOperationStatus =
  | "planned"
  | "applying"
  | "applied"
  | "validation_failed"
  | "validated"
  | "draft_verified"
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
  | "run_preview"
  | "create_version"
  | "await_approval"
  | "publish"
  | "verify_publication"
  | "rollback"
  | "complete"
  | "refresh_state"
  | "reconcile_state";

export interface TrackingDraftVerificationV1 {
  schemaVersion: 1;
  operationId: string;
  setupFingerprint: string;
  workspaceFingerprint: string;
  previewVersionFingerprint: string;
  evidenceRunId: string;
  evidenceFingerprint: string;
  verifiedAt: string;
}

export interface TrackingDraftRepairV1 {
  schemaVersion: 1;
  status: "review_required" | "passed_to_verification" | "stopped";
  failedEvidenceRunId: string;
  failedEvidenceFingerprint: string;
  reasonCode: string;
  workspaceFingerprint: string;
  plan?: TrackingChangePlan;
  ledger: DraftRepairLedgerV1;
}

export interface ManagedReplacementRefV1 {
  kind: GtmEntityKind;
  entitySignature: string;
  existingId: string;
  currentFingerprint: string;
}

export interface ManagedReplacementApprovalV1 {
  schemaVersion: 1;
  approvedAt: string;
  approvedBy: string;
  sourcePlanFingerprint: string;
  approvedPlanFingerprint: string;
  entities: ManagedReplacementRefV1[];
}

export interface TrackingSetupOperationV1 {
  schemaVersion: typeof TRACKING_OPERATION_SCHEMA_VERSION;
  id: string;
  status: TrackingOperationStatus;
  createdAt: string;
  updatedAt: string;
  specification: TrackingSpecificationV1 | TrackingSetupV1;
  generatedSetup: GtmContainerExport;
  container: { publicId: string; path: string };
  workspace: { path: string; fingerprint: string };
  plan: TrackingChangePlan;
  completedActionSignatures: string[];
  previewPolicy?: "legacy_pre_checkpoint" | "exact_draft_required";
  managedReplacement?: ManagedReplacementApprovalV1;
  validation?: {
    status: "passed" | "failed";
    checkedAt: string;
    workspaceFingerprint: string;
    errors: string[];
    workspaceChanges?: unknown[];
    previewVersionFingerprint?: string;
  } | undefined;
  draftVerification?: TrackingDraftVerificationV1 | undefined;
  draftRepair?: TrackingDraftRepairV1 | undefined;
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
  };
}

type JsonRecord = Record<string, unknown>;

const statuses = new Set<TrackingOperationStatus>([
  "planned", "applying", "applied", "validation_failed", "validated", "draft_verified", "versioned",
  "approved", "published", "verification_failed", "rollback_required", "rolled_back", "completed",
]);

const nextSteps: Record<TrackingOperationStatus, TrackingOperationNextStep> = {
  planned: "apply",
  applying: "reconcile_application",
  applied: "validate",
  validation_failed: "revise_plan",
  validated: "run_preview",
  draft_verified: "create_version",
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

function validReplacementRef(value: unknown): value is ManagedReplacementRefV1 {
  if (!isRecord(value)) return false;
  return ["tag", "trigger", "variable", "builtInVariable"].includes(String(value.kind))
    && nonempty(value.entitySignature)
    && nonempty(value.existingId)
    && nonempty(value.currentFingerprint);
}

export function validateTrackingOperation(value: unknown): string[] {
  if (!isRecord(value)) return ["tracking operation must be an object"];
  const errors: string[] = [];
  if (value.schemaVersion !== TRACKING_OPERATION_SCHEMA_VERSION) errors.push("schemaVersion must be 1");
  if (!nonempty(value.id)) errors.push("id is required");
  if (!statuses.has(value.status as TrackingOperationStatus)) errors.push("status is unsupported");
  if (!validTimestamp(value.createdAt)) errors.push("createdAt is invalid");
  if (!validTimestamp(value.updatedAt)) errors.push("updatedAt is invalid");
  const genericSetup = isRecord(value.specification) && Array.isArray(value.specification.tagActions);
  const specificationErrors = genericSetup
    ? validateTrackingSetup(value.specification)
    : validateTrackingSpecification(value.specification);
  errors.push(...specificationErrors.map((error) => `specification.${error}`));
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
    || (action.action === "update" && (!nonempty(action.existingId)
      || (action.expectedFingerprint !== undefined && !nonempty(action.expectedFingerprint)))));
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

  const managedReplacement = isRecord(value.managedReplacement)
    ? value.managedReplacement
    : undefined;
  if (value.managedReplacement !== undefined && !managedReplacement) {
    errors.push("managedReplacement is invalid");
  }
  if (managedReplacement) {
    const entities = Array.isArray(managedReplacement.entities)
      ? managedReplacement.entities
      : [];
    const valid = managedReplacement.schemaVersion === 1
      && validTimestamp(managedReplacement.approvedAt)
      && nonempty(managedReplacement.approvedBy)
      && nonempty(managedReplacement.sourcePlanFingerprint)
      && nonempty(managedReplacement.approvedPlanFingerprint)
      && managedReplacement.approvedPlanFingerprint === plan?.fingerprint
      && entities.length > 0
      && entities.every(validReplacementRef);
    if (!valid) errors.push("managedReplacement is invalid");

    const updates = planActions.filter((action): action is JsonRecord => isRecord(action)
      && action.action === "update");
    const allBound = entities.every((entity) => updates.some((action) =>
      action.kind === entity.kind
      && action.entitySignature === entity.entitySignature
      && action.existingId === entity.existingId
      && action.expectedFingerprint === entity.currentFingerprint));
    if (!allBound || updates.length !== entities.length) {
      errors.push("managedReplacement must match every approved update action");
    }
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
  if (value.previewPolicy !== undefined
    && value.previewPolicy !== "legacy_pre_checkpoint"
    && value.previewPolicy !== "exact_draft_required") {
    errors.push("previewPolicy is unsupported");
  }
  const exactDraftRequired = value.previewPolicy === "exact_draft_required";
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
    "applied", "validation_failed", "validated", "draft_verified", "versioned", "approved", "published",
    "verification_failed", "rollback_required", "rolled_back", "completed",
  ]) && actionableSignatures.some((signature) => !completed.has(signature))) {
    errors.push("status requires every plan action to be completed");
  }
  const validation = isRecord(value.validation) ? value.validation : undefined;
  const validationErrors = validation && Array.isArray(validation.errors) ? validation.errors : undefined;
  const requiresFailedValidation = status === "validation_failed";
  const requiresPassedValidation = requires(status, [
    "validated", "draft_verified", "versioned", "approved", "published", "verification_failed",
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

  const draftVerificationStatuses: TrackingOperationStatus[] = [
    "draft_verified", "versioned", "approved", "published", "verification_failed",
    "rollback_required", "rolled_back", "completed",
  ];
  const draftVerification = isRecord(value.draftVerification) ? value.draftVerification : undefined;
  if ((exactDraftRequired || status === "draft_verified")
    && requires(status, draftVerificationStatuses)
    && !draftVerification) {
    errors.push("draftVerification is required for status");
  }
  if (draftVerification) {
    if (draftVerification.schemaVersion !== 1
      || draftVerification.operationId !== value.id
      || !nonempty(draftVerification.setupFingerprint)
      || !nonempty(draftVerification.workspaceFingerprint)
      || !nonempty(draftVerification.previewVersionFingerprint)
      || !nonempty(draftVerification.evidenceRunId)
      || !nonempty(draftVerification.evidenceFingerprint)
      || !validTimestamp(draftVerification.verifiedAt)) {
      errors.push("draftVerification is invalid");
    } else if (!verifiedDraftBindingCurrent(
      value as unknown as TrackingSetupOperationV1,
      draftVerification as unknown as TrackingDraftVerificationV1,
    )) {
      errors.push("draftVerification must match the current setup, workspace, and preview fingerprints");
    }
  }

  const draftRepair = isRecord(value.draftRepair) ? value.draftRepair : undefined;
  if (draftRepair) {
    const repairPlan = isRecord(draftRepair.plan) ? draftRepair.plan : undefined;
    const ledger = isRecord(draftRepair.ledger) ? draftRepair.ledger : undefined;
    const attempts = ledger && Array.isArray(ledger.attempts) ? ledger.attempts : undefined;
    if (draftRepair.schemaVersion !== 1
      || !["review_required", "passed_to_verification", "stopped"].includes(String(draftRepair.status))
      || !nonempty(draftRepair.failedEvidenceRunId)
      || !nonempty(draftRepair.failedEvidenceFingerprint)
      || !nonempty(draftRepair.reasonCode)
      || !nonempty(draftRepair.workspaceFingerprint)) {
      errors.push("draftRepair is invalid");
    }
    if (!ledger
      || ledger.schemaVersion !== 1
      || ledger.operationId !== value.id
      || !nonempty(ledger.intentFingerprint)
      || !Number.isInteger(ledger.maximumAttempts)
      || Number(ledger.maximumAttempts) < 1
      || Number(ledger.maximumAttempts) > MAX_REPAIR_ATTEMPT_LIMIT
      || !attempts
      || !["available", "passed_to_verification", "stopped_ambiguous", "exhausted"].includes(String(ledger.status))) {
      errors.push("draftRepair.ledger is invalid");
    } else {
      const malformedAttempt = attempts.some((attempt, index) => !isRecord(attempt)
        || attempt.attempt !== index + 1
        || !validTimestamp(attempt.attemptedAt)
        || attempt.intentFingerprint !== ledger.intentFingerprint
        || !nonempty(attempt.fromSetupFingerprint)
        || !nonempty(attempt.toSetupFingerprint)
        || !nonempty(attempt.reasonCode)
        || !["applied", "rejected", "ambiguous"].includes(String(attempt.result)));
      if (malformedAttempt || attempts.length > Number(ledger.maximumAttempts)) {
        errors.push("draftRepair.ledger attempts are invalid");
      }
      if (draftRepair.status === "review_required" && ledger.status !== "available") {
        errors.push("review-required repair needs an available ledger");
      }
      if (draftRepair.status === "passed_to_verification" && ledger.status !== "passed_to_verification") {
        errors.push("repair verification status must match its ledger");
      }
      if (draftRepair.status === "stopped"
        && ledger.status !== "stopped_ambiguous"
        && ledger.status !== "exhausted") {
        errors.push("stopped repair needs a terminal ledger");
      }
    }
    if (draftRepair.status === "review_required"
      && (!repairPlan
        || repairPlan.schemaVersion !== 1
        || repairPlan.status !== "ready"
        || !nonempty(repairPlan.fingerprint)
        || !Array.isArray(repairPlan.actions)
        || !repairPlan.actions.some((action) => isRecord(action)
          && (action.action === "create" || action.action === "update")))) {
      errors.push("review-required repair needs a concrete ready plan");
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
  }
  return [...new Set(errors)];
}

export function assertTrackingOperation(value: unknown): asserts value is TrackingSetupOperationV1 {
  const errors = validateTrackingOperation(value);
  if (errors.length > 0) throw new Error(errors.join(" "));
}

export function approveManagedReplacement(
  operation: TrackingSetupOperationV1,
  expectedPlanFingerprint: string,
  reviewedEntities: ManagedReplacementRefV1[],
  approvedBy: string,
  approvedAt: string,
): TrackingSetupOperationV1 {
  assertTrackingOperation(operation);
  if (operation.status !== "planned" || operation.plan.status !== "conflict") {
    throw new Error("Managed replacement requires a conflicting planned operation.");
  }
  if (operation.plan.fingerprint !== expectedPlanFingerprint) {
    throw new Error("Managed replacement does not match the reviewed plan fingerprint.");
  }
  if (!nonempty(approvedBy) || !validTimestamp(approvedAt)) {
    throw new Error("Managed replacement approval identity is invalid.");
  }

  const replacements = operation.plan.actions.filter((action) => action.action === "conflict");
  const expectedEntities = replacements.flatMap((action): ManagedReplacementRefV1[] => {
    if (action.reason !== "managed_change_requires_approval"
      || !action.existingId
      || !action.replacement) {
      return [];
    }
    return [{
      kind: action.kind,
      entitySignature: action.entitySignature,
      existingId: action.existingId,
      currentFingerprint: action.replacement.currentFingerprint,
    }];
  });
  if (expectedEntities.length !== replacements.length
    || JSON.stringify(reviewedEntities) !== JSON.stringify(expectedEntities)) {
    throw new Error("Approval does not match the reviewed managed entities.");
  }

  const actions = operation.plan.actions.map((action): TrackingChangeAction => {
    if (action.action !== "conflict") return action;
    return {
      kind: action.kind,
      generatedName: action.generatedName,
      entitySignature: action.entitySignature,
      action: "update",
      existingId: action.existingId!,
      expectedFingerprint: action.replacement!.currentFingerprint,
    };
  });
  const approvedPlan: TrackingChangePlan = {
    schemaVersion: 1,
    status: "ready",
    fingerprint: fingerprintTrackingChangeActions(actions),
    actions,
  };
  const approved: TrackingSetupOperationV1 = {
    ...structuredClone(operation),
    updatedAt: approvedAt,
    plan: approvedPlan,
    managedReplacement: {
      schemaVersion: 1,
      approvedAt,
      approvedBy,
      sourcePlanFingerprint: expectedPlanFingerprint,
      approvedPlanFingerprint: approvedPlan.fingerprint,
      entities: structuredClone(reviewedEntities),
    },
  };
  assertTrackingOperation(approved);
  return approved;
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
