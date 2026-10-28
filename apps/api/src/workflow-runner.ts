import {
  approveManagedReplacement as bindManagedReplacement,
  approveTrackingVersion,
  createFormSetupProposal,
  createSetupProposal,
  compileTrackingSetup,
  createDraftRepairLedger,
  bindExactDraftBrowserRun,
  assertExactDraftRunCurrent,
  fingerprintDraftValue,
  markRepairPassedToVerification,
  publicationApprovalCurrent,
  providerProgressFromAttempt,
  recordDraftRepairAttempt,
  recordPostPublicationEvidence,
  resumeDraftRepairAfterFailure,
  setupArtifactFingerprint,
  trackingIntentFingerprint,
  validateTrackingSetup,
  verifiedDraftBindingCurrent,
  type ExactDraftBrowserRunV1,
  type FormSetupRequest,
  type GenericTrackingSetupRequest,
  type ManagedReplacementRefV1,
  type ProviderFailureCodeV1,
  type ProviderProgressProjectionV1,
  type ProviderStageV1,
  type SetupRequest,
  type TrackingSetupOperationV1,
  type TrackingRunEvidenceV1,
} from "@gtm-observability/core";
import type { GtmDiscoveryClient } from "./google.js";
import type { OrganizationTrackingOperations } from "./tracking-operations.js";

export type WorkflowGoogleClient = Pick<GtmDiscoveryClient,
  | "planManagedWorkspace"
  | "prepareManagedWorkspace"
  | "applyManagedWorkspace"
  | "validateManagedWorkspace"
  | "createValidatedVersion"
  | "publishApprovedVersion"
  | "rollbackPublishedVersion"
>;

export type TrackingWorkflowRequest = SetupRequest | FormSetupRequest | GenericTrackingSetupRequest;

export type WorkflowPlanResult =
  | { status: "planned" | "reused"; operation: TrackingSetupOperationV1 }
  | { status: "blocked"; stage: "workspace" | "planning"; reason: string; details?: unknown };

export type WorkflowProviderProgressResult = {
  status: "provider_progress";
  operation: TrackingSetupOperationV1;
  progress: ProviderProgressProjectionV1;
};

export type WorkflowResumeResult =
  | WorkflowProviderProgressResult
  | {
    status: "awaiting_preview";
    operation: TrackingSetupOperationV1;
    nextStep: "run_tag_assistant_preview";
    preview: {
      setupFingerprint: string;
      workspaceFingerprint: string;
      previewVersionFingerprint: string;
    };
  }
  | { status: "versioned"; operation: TrackingSetupOperationV1; nextStep: "await_approval" }
  | { status: "published"; operation: TrackingSetupOperationV1; nextStep: "verify_publication" }
  | {
    status: "blocked" | "paused";
    operation: TrackingSetupOperationV1;
    stage: "planning" | "application" | "validation" | "version";
    reason: string;
    details?: unknown;
  };

export type WorkflowReplacementApprovalResult = {
  status: "replacement_approved";
  operation: TrackingSetupOperationV1;
  nextStep: "review_application";
};

export type WorkflowDraftVerificationResult = {
  status: "draft_verified";
  operation: TrackingSetupOperationV1;
  nextStep: "create_version";
};

export type WorkflowDraftRepairResult =
  | WorkflowProviderProgressResult
  | {
    status: "repair_ready";
    operation: TrackingSetupOperationV1;
    nextStep: "review_repair";
    repair: {
      planFingerprint: string;
      reasonCode: "workspace_entity_drift";
      attempt: number;
      maximumAttempts: number;
    };
  }
  | {
    status: "blocked";
    operation: TrackingSetupOperationV1;
    stage: "repair";
    reason: string;
  };

export type WorkflowDraftRepairApplyResult =
  | WorkflowProviderProgressResult
  | Extract<WorkflowResumeResult, { status: "awaiting_preview" }>
  | {
    status: "blocked";
    operation: TrackingSetupOperationV1;
    stage: "repair";
    reason: string;
    details?: unknown;
  };

export type WorkflowPublicationApprovalResult = {
  status: "approved";
  operation: TrackingSetupOperationV1;
  nextStep: "publish";
};

export type WorkflowPublicationResult = WorkflowProviderProgressResult | {
  status: "published";
  operation: TrackingSetupOperationV1;
  nextStep: "verify_publication";
};

export type WorkflowPublicationVerificationResult = {
  status: "published" | "completed" | "rollback_required";
  operation: TrackingSetupOperationV1;
  nextStep: "verify_publication" | "complete" | "rollback";
};

export type WorkflowRollbackResult = WorkflowProviderProgressResult | {
  status: "rolled_back";
  operation: TrackingSetupOperationV1;
  nextStep: "complete";
};

function nextTimestamp(previous: string, now: () => Date): string {
  const candidate = now().getTime();
  return new Date(Math.max(candidate, Date.parse(previous) + 1)).toISOString();
}

export class TrackingWorkflowRunner {
  private readonly liveProviderAttempts = new Set<string>();

  constructor(
    private readonly repository: OrganizationTrackingOperations,
    private readonly google: WorkflowGoogleClient,
    private readonly now: () => Date = () => new Date(),
  ) {}

  get(id: string): TrackingSetupOperationV1 | undefined {
    return this.repository.get(id);
  }

  progress(
    id: string,
    presentation: { displayTimedOut?: boolean; browserReloaded?: boolean; action?: string } = {},
  ): ProviderProgressProjectionV1 {
    const operation = this.requiredOperation(id);
    return this.projectProgress(operation, presentation);
  }

  async plan(request: TrackingWorkflowRequest): Promise<WorkflowPlanResult> {
    let proposal: {
      specification: TrackingSetupOperationV1["specification"];
      containerFile: TrackingSetupOperationV1["generatedSetup"];
    };
    if ("setup" in request) {
      const errors = validateTrackingSetup(request.setup);
      if (errors.length > 0 || request.setup.status !== "confirmed") {
        throw new Error(errors.length > 0
          ? errors.join(" ")
          : "Generic workflow setup must be confirmed.");
      }
      proposal = {
        specification: request.setup,
        containerFile: compileTrackingSetup(request.setup, request.container).containerFile,
      };
    } else {
      proposal = "specification" in request
        ? createFormSetupProposal(request)
        : createSetupProposal(request);
    }
    const id = `operation_${proposal.specification.id}`;
    const existing = this.repository.get(id);
    if (existing) return { status: "reused", operation: existing };

    let planning = await this.google.planManagedWorkspace(
      request.container.publicId,
      proposal.containerFile,
    );
    if (planning.status === "workspace_required") {
      const preparation = await this.google.prepareManagedWorkspace(request.container.publicId);
      if (preparation.status !== "recognized"
        || (preparation.workspace.status !== "created" && preparation.workspace.status !== "reused")) {
        return { status: "blocked", stage: "workspace", reason: preparation.status, details: preparation };
      }
      planning = await this.google.planManagedWorkspace(
        request.container.publicId,
        proposal.containerFile,
      );
    }
    if (planning.status !== "planned") {
      return { status: "blocked", stage: "planning", reason: planning.status, details: planning };
    }
    if (!planning.workspaceFingerprint) {
      return {
        status: "blocked",
        stage: "planning",
        reason: "workspace_fingerprint_missing",
        details: planning,
      };
    }

    const timestamp = this.now().toISOString();
    const operation: TrackingSetupOperationV1 = {
      schemaVersion: 1,
      id,
      status: "planned",
      createdAt: timestamp,
      updatedAt: timestamp,
      specification: proposal.specification,
      generatedSetup: proposal.containerFile,
      container: {
        publicId: planning.container.publicId,
        path: planning.container.path,
      },
      workspace: {
        path: planning.workspace.path,
        fingerprint: planning.workspaceFingerprint,
      },
      plan: planning.plan,
      completedActionSignatures: [],
      previewPolicy: "exact_draft_required",
    };
    const created = this.repository.create(operation);
    return created.accepted
      ? { status: "planned", operation: created.operation }
      : { status: "reused", operation: this.requiredOperation(id) };
  }

  async resume(id: string): Promise<WorkflowResumeResult> {
    let operation = this.requiredOperation(id);
    if (this.providerAttemptBlocksMutation(operation)) {
      return {
        status: "provider_progress",
        operation,
        progress: this.projectProgress(operation, { action: "repeat_mutation" }),
      };
    }
    if (operation.status === "versioned") {
      return { status: "versioned", operation, nextStep: "await_approval" };
    }
    if (operation.status === "published") {
      return { status: "published", operation, nextStep: "verify_publication" };
    }
    if (operation.status === "planned" && operation.plan.status === "conflict") {
      return {
        status: "blocked",
        operation,
        stage: "planning",
        reason: "plan_conflict",
        details: operation.plan,
      };
    }
    if (!["planned", "applying", "applied", "validated", "draft_verified"].includes(operation.status)) {
      return {
        status: "blocked",
        operation,
        stage: operation.status === "validation_failed" ? "validation" : "version",
        reason: `operation_${operation.status}`,
      };
    }

    if (operation.status === "planned") {
      operation = this.save(operation, { status: "applying" });
    }
    if (operation.status === "applying") {
      operation = this.beginProviderAttempt(operation, "application");
      let application: Awaited<ReturnType<WorkflowGoogleClient["applyManagedWorkspace"]>>;
      try {
        application = await this.google.applyManagedWorkspace(operation);
      } catch (error) {
        this.failProviderAttempt(operation, this.providerFailureCode(error));
        throw error;
      }
      if (application.status !== "applied") {
        operation = this.failProviderAttempt(operation, application.status === "partial_failure"
          ? "partial_failure"
          : "provider_rejected", {
          completedActionSignatures: application.completedActionSignatures,
        });
        return {
          status: application.status === "partial_failure" ? "paused" : "blocked",
          operation,
          stage: "application",
          reason: application.status === "partial_failure" ? "partial_failure" : application.reason,
          details: application,
        };
      }
      operation = this.completeProviderAttempt(operation, {
        status: "applied",
        completedActionSignatures: application.completedActionSignatures,
        workspace: {
          ...operation.workspace,
          fingerprint: application.workspaceFingerprint ?? operation.workspace.fingerprint,
        },
      });
    }

    if (operation.status === "applied") {
      operation = this.beginProviderAttempt(operation, "validation");
      let validation: Awaited<ReturnType<WorkflowGoogleClient["validateManagedWorkspace"]>>;
      try {
        validation = await this.google.validateManagedWorkspace(operation);
      } catch (error) {
        this.failProviderAttempt(operation, this.providerFailureCode(error));
        throw error;
      }
      operation = this.completeProviderAttempt(operation, {
        status: validation.status === "passed" ? "validated" : "validation_failed",
        validation,
      });
      if (validation.status !== "passed") {
        return {
          status: "blocked",
          operation,
          stage: "validation",
          reason: "validation_failed",
          details: validation,
        };
      }
      if (!validation.previewVersionFingerprint) {
        operation = this.save(operation, {
          status: "validation_failed",
          validation: {
            ...validation,
            status: "failed",
            errors: [...validation.errors, "GTM preview fingerprint is missing."],
          },
        });
        return {
          status: "blocked",
          operation,
          stage: "validation",
          reason: "preview_fingerprint_missing",
        };
      }
    }

    if (operation.status === "validated") {
      if (!operation.validation?.previewVersionFingerprint) {
        return {
          status: "blocked",
          operation,
          stage: "validation",
          reason: "preview_fingerprint_missing",
        };
      }
      return {
        status: "awaiting_preview",
        operation,
        nextStep: "run_tag_assistant_preview",
        preview: {
          setupFingerprint: setupArtifactFingerprint(operation),
          workspaceFingerprint: operation.workspace.fingerprint,
          previewVersionFingerprint: operation.validation.previewVersionFingerprint,
        },
      };
    }

    if (operation.status !== "draft_verified"
      || !operation.draftVerification
      || !verifiedDraftBindingCurrent(operation, operation.draftVerification)) {
      return {
        status: "blocked",
        operation,
        stage: "version",
        reason: `operation_${operation.status}`,
      };
    }
    operation = this.beginProviderAttempt(operation, "versioning");
    let version: Awaited<ReturnType<WorkflowGoogleClient["createValidatedVersion"]>>;
    try {
      version = await this.google.createValidatedVersion(operation);
    } catch (error) {
      this.failProviderAttempt(operation, this.providerFailureCode(error));
      throw error;
    }
    if (version.status !== "versioned") {
      const invalidated = structuredClone(operation);
      delete invalidated.draftVerification;
      operation = this.failProviderAttempt(invalidated, "version_creation_blocked", {
        status: "validation_failed",
        validation: version.validation,
      });
      return {
        status: "blocked",
        operation,
        stage: "version",
        reason: "version_creation_blocked",
        details: version,
      };
    }
    operation = this.completeProviderAttempt(operation, {
      status: "versioned",
      validation: version.validation,
      version: version.version,
    });
    return { status: "versioned", operation, nextStep: "await_approval" };
  }

  approveManagedReplacement(
    id: string,
    expectedPlanFingerprint: string,
    reviewedEntities: ManagedReplacementRefV1[],
    approvedBy: string,
  ): WorkflowReplacementApprovalResult {
    const operation = this.requiredOperation(id);
    const approved = bindManagedReplacement(
      operation,
      expectedPlanFingerprint,
      reviewedEntities,
      approvedBy,
      this.now().toISOString(),
    );
    if (!approved.managedReplacement) {
      throw new Error("Managed replacement approval was not recorded.");
    }
    const updated = this.save(operation, {
      plan: approved.plan,
      managedReplacement: approved.managedReplacement,
    });
    return {
      status: "replacement_approved",
      operation: updated,
      nextStep: "review_application",
    };
  }

  verifyDraft(id: string, run: ExactDraftBrowserRunV1): WorkflowDraftVerificationResult {
    const operation = this.requiredOperation(id);
    if (operation.status === "draft_verified" && operation.draftVerification) {
      if (!verifiedDraftBindingCurrent(operation, operation.draftVerification)) {
        throw new Error("Stored draft verification no longer matches the operation.");
      }
      return { status: "draft_verified", operation, nextStep: "create_version" };
    }
    if (operation.status !== "validated") {
      throw new Error("Only a validated workspace can accept exact preview evidence.");
    }
    const draftVerification = bindExactDraftBrowserRun(operation, run);
    const updated = this.save(operation, {
      status: "draft_verified",
      draftVerification,
    });
    return { status: "draft_verified", operation: updated, nextStep: "create_version" };
  }

  async proposeDraftRepair(
    id: string,
    run: ExactDraftBrowserRunV1,
  ): Promise<WorkflowDraftRepairResult> {
    let operation = this.requiredOperation(id);
    if (this.providerAttemptBlocksMutation(operation)) {
      return this.providerProgressResult(operation);
    }
    assertExactDraftRunCurrent(operation, run);
    if (run.evidence.verdict.browserVerification !== "failed") {
      throw new Error("Only failed exact-draft evidence can enter bounded repair.");
    }
    if (operation.draftRepair?.failedEvidenceRunId === run.evidence.runId) {
      if (operation.draftRepair.status === "review_required" && operation.draftRepair.plan) {
        return this.repairReady(operation);
      }
      return {
        status: "blocked",
        operation,
        stage: "repair",
        reason: operation.draftRepair.ledger.status,
      };
    }

    let ledger = operation.draftRepair?.ledger ?? createDraftRepairLedger(operation);
    if (ledger.status === "passed_to_verification") {
      ledger = resumeDraftRepairAfterFailure(ledger);
    }
    if (ledger.status !== "available") {
      operation = this.save(operation, {
        draftRepair: {
          schemaVersion: 1,
          status: "stopped",
          failedEvidenceRunId: run.evidence.runId,
          failedEvidenceFingerprint: fingerprintDraftValue("evidence", run.evidence),
          reasonCode: "repair_attempts_exhausted",
          workspaceFingerprint: operation.workspace.fingerprint,
          ledger,
        },
      });
      return { status: "blocked", operation, stage: "repair", reason: "repair_attempts_exhausted" };
    }

    operation = this.beginProviderAttempt(operation, "planning");
    let planning: Awaited<ReturnType<WorkflowGoogleClient["planManagedWorkspace"]>>;
    try {
      planning = await this.google.planManagedWorkspace(
        operation.container.publicId,
        operation.generatedSetup,
      );
    } catch (error) {
      this.failProviderAttempt(operation, this.providerFailureCode(error));
      throw error;
    }
    const repairPlanning = planning.status === "planned" ? planning : undefined;
    const planned = Boolean(repairPlanning
      && repairPlanning.workspace.path === operation.workspace.path
      && repairPlanning.workspaceFingerprint);
    const hasKnownRepair = Boolean(planned
      && repairPlanning?.plan.status === "ready"
      && repairPlanning.plan.actions.some(({ action }) => action === "create" || action === "update"));
    if (!hasKnownRepair) {
      ledger = recordDraftRepairAttempt(ledger, {
        attemptedAt: this.now().toISOString(),
        intentFingerprint: trackingIntentFingerprint(operation),
        fromSetupFingerprint: setupArtifactFingerprint(operation),
        toSetupFingerprint: setupArtifactFingerprint(operation),
        reasonCode: "no_known_repair",
        result: "ambiguous",
      });
      operation = this.completeProviderAttempt(operation, {
        draftRepair: {
          schemaVersion: 1,
          status: "stopped",
          failedEvidenceRunId: run.evidence.runId,
          failedEvidenceFingerprint: fingerprintDraftValue("evidence", run.evidence),
          reasonCode: "no_known_repair",
          workspaceFingerprint: planned
            ? repairPlanning!.workspaceFingerprint!
            : operation.workspace.fingerprint,
          ...(planned ? { plan: repairPlanning!.plan } : {}),
          ledger,
        },
      });
      return { status: "blocked", operation, stage: "repair", reason: "no_known_repair" };
    }

    operation = this.completeProviderAttempt(operation, {
      draftRepair: {
        schemaVersion: 1,
        status: "review_required",
        failedEvidenceRunId: run.evidence.runId,
        failedEvidenceFingerprint: fingerprintDraftValue("evidence", run.evidence),
        reasonCode: "workspace_entity_drift",
        workspaceFingerprint: repairPlanning!.workspaceFingerprint!,
        plan: repairPlanning!.plan,
        ledger,
      },
    });
    return this.repairReady(operation);
  }

  async applyDraftRepair(
    id: string,
    expectedPlanFingerprint: string,
  ): Promise<WorkflowDraftRepairApplyResult> {
    let operation = this.requiredOperation(id);
    if (this.providerAttemptBlocksMutation(operation)) {
      return this.providerProgressResult(operation);
    }
    const repair = operation.draftRepair;
    if (operation.status !== "validated" || repair?.status !== "review_required" || !repair.plan) {
      throw new Error("Draft repair requires a validated operation and reviewed repair plan.");
    }
    if (repair.plan.fingerprint !== expectedPlanFingerprint) {
      throw new Error("Draft repair does not match the reviewed plan fingerprint.");
    }

    const {
      validation: _validation,
      draftVerification: _draftVerification,
      draftRepair: _draftRepair,
      ...operationBase
    } = operation;
    const repairOperation: TrackingSetupOperationV1 = {
      ...operationBase,
      status: "planned",
      workspace: { ...operation.workspace, fingerprint: repair.workspaceFingerprint },
      plan: repair.plan,
      completedActionSignatures: [],
      validation: undefined,
      draftVerification: undefined,
      draftRepair: undefined,
    };
    operation = this.beginProviderAttempt(repairOperation, "application");
    let application: Awaited<ReturnType<WorkflowGoogleClient["applyManagedWorkspace"]>>;
    try {
      application = await this.google.applyManagedWorkspace(operation);
    } catch (error) {
      this.failProviderAttempt(operation, this.providerFailureCode(error), { draftRepair: repair });
      throw error;
    }
    if (application.status !== "applied") {
      const result = application.status === "partial_failure" ? "ambiguous" : "rejected";
      const ledger = recordDraftRepairAttempt(repair.ledger, {
        attemptedAt: this.now().toISOString(),
        intentFingerprint: trackingIntentFingerprint(operation),
        fromSetupFingerprint: setupArtifactFingerprint(operation),
        toSetupFingerprint: setupArtifactFingerprint(operation),
        reasonCode: application.status === "partial_failure" ? "partial_repair" : "repair_rejected",
        result,
      });
      operation = this.failProviderAttempt(operation, application.status === "partial_failure"
        ? "partial_failure"
        : "provider_rejected", {
        ...(application.status === "partial_failure" ? {
          status: "applying" as const,
          workspace: repairOperation.workspace,
          plan: repair.plan,
          completedActionSignatures: application.completedActionSignatures,
          validation: undefined,
        } : {}),
        draftRepair: {
          ...repair,
          status: ledger.status === "available" ? "review_required" : "stopped",
          ledger,
        },
      });
      return { status: "blocked", operation, stage: "repair", reason: application.status, details: application };
    }

    operation = this.completeProviderAttempt(operation, {
      status: "applied",
      workspace: {
        ...operation.workspace,
        fingerprint: application.workspaceFingerprint ?? operation.workspace.fingerprint,
      },
      completedActionSignatures: application.completedActionSignatures,
      draftRepair: repair,
    });
    operation = this.beginProviderAttempt(operation, "validation");
    let validation: Awaited<ReturnType<WorkflowGoogleClient["validateManagedWorkspace"]>>;
    try {
      validation = await this.google.validateManagedWorkspace(operation);
    } catch (error) {
      this.failProviderAttempt(operation, this.providerFailureCode(error), { draftRepair: repair });
      throw error;
    }
    if (validation.status !== "passed" || !validation.previewVersionFingerprint) {
      const ledger = recordDraftRepairAttempt(repair.ledger, {
        attemptedAt: this.now().toISOString(),
        intentFingerprint: trackingIntentFingerprint(operation),
        fromSetupFingerprint: setupArtifactFingerprint(operation),
        toSetupFingerprint: setupArtifactFingerprint(operation),
        reasonCode: "repair_validation_failed",
        result: "ambiguous",
      });
      operation = this.completeProviderAttempt(operation, {
        status: "validation_failed",
        workspace: operation.workspace,
        plan: repair.plan,
        completedActionSignatures: application.completedActionSignatures,
        validation: validation.status === "failed"
          ? validation
          : { ...validation, status: "failed", errors: ["GTM preview fingerprint is missing."] },
        draftVerification: undefined,
        draftRepair: { ...repair, status: "stopped", ledger },
      });
      return { status: "blocked", operation, stage: "repair", reason: "repair_validation_failed" };
    }

    let ledger = recordDraftRepairAttempt(repair.ledger, {
      attemptedAt: this.now().toISOString(),
      intentFingerprint: trackingIntentFingerprint(operation),
      fromSetupFingerprint: setupArtifactFingerprint(operation),
      toSetupFingerprint: setupArtifactFingerprint(operation),
      reasonCode: "workspace_entity_drift",
      result: "applied",
    });
    ledger = markRepairPassedToVerification(ledger);
    operation = this.completeProviderAttempt(operation, {
      status: "validated",
      workspace: operation.workspace,
      plan: repair.plan,
      completedActionSignatures: application.completedActionSignatures,
      validation,
      draftVerification: undefined,
      draftRepair: { ...repair, status: "passed_to_verification", ledger },
    });
    return {
      status: "awaiting_preview",
      operation,
      nextStep: "run_tag_assistant_preview",
      preview: {
        setupFingerprint: setupArtifactFingerprint(operation),
        workspaceFingerprint: operation.workspace.fingerprint,
        previewVersionFingerprint: validation.previewVersionFingerprint,
      },
    };
  }

  approvePublication(
    id: string,
    expectedVersionFingerprint: string,
    approvedBy: string,
  ): WorkflowPublicationApprovalResult {
    const operation = this.requiredOperation(id);
    if (operation.status === "approved"
      && operation.version?.fingerprint === expectedVersionFingerprint
      && publicationApprovalCurrent(operation, this.now().getTime())) {
      return { status: "approved", operation, nextStep: "publish" };
    }
    if (operation.status !== "versioned" || !operation.version) {
      throw new Error("Only a versioned operation can receive publication approval.");
    }
    if (operation.version.fingerprint !== expectedVersionFingerprint) {
      throw new Error("Publication approval does not match the reviewed version fingerprint.");
    }
    const approved = approveTrackingVersion(
      operation,
      approvedBy,
      nextTimestamp(operation.updatedAt, this.now),
    );
    if (!approved.approval) throw new Error("Publication approval was not recorded.");
    const updated = this.save(operation, {
      status: "approved",
      approval: approved.approval,
    });
    return { status: "approved", operation: updated, nextStep: "publish" };
  }

  async publish(
    id: string,
    expectedVersionFingerprint: string,
  ): Promise<WorkflowPublicationResult> {
    let operation = this.requiredOperation(id);
    if (this.providerAttemptBlocksMutation(operation)) {
      return this.providerProgressResult(operation);
    }
    if (operation.status === "published"
      && operation.version?.fingerprint === expectedVersionFingerprint
      && operation.publication?.versionFingerprint === expectedVersionFingerprint) {
      return { status: "published", operation, nextStep: "verify_publication" };
    }
    if (operation.status !== "approved" || !operation.version) {
      throw new Error("Publication requires current approval for a versioned operation.");
    }
    if (operation.version.fingerprint !== expectedVersionFingerprint
      || operation.approval?.versionFingerprint !== expectedVersionFingerprint) {
      throw new Error("Publication does not match the approved version fingerprint.");
    }
    operation = this.beginProviderAttempt(operation, "publication");
    let publication: Awaited<ReturnType<WorkflowGoogleClient["publishApprovedVersion"]>>;
    try {
      publication = await this.google.publishApprovedVersion(operation);
    } catch (error) {
      this.failProviderAttempt(operation, this.providerFailureCode(error));
      throw error;
    }
    if (publication.versionFingerprint !== expectedVersionFingerprint) {
      this.failProviderAttempt(operation, "publication_mismatch");
      throw new Error("Google publication did not match the approved version fingerprint.");
    }
    const updated = this.completeProviderAttempt(operation, {
      status: "published",
      publication,
    });
    return { status: "published", operation: updated, nextStep: "verify_publication" };
  }

  verifyPublication(
    id: string,
    expectedVersionFingerprint: string,
    evidence: TrackingRunEvidenceV1,
  ): WorkflowPublicationVerificationResult {
    const operation = this.requiredOperation(id);
    if (operation.version?.fingerprint !== expectedVersionFingerprint
      || operation.publication?.versionFingerprint !== expectedVersionFingerprint) {
      throw new Error("Live verification does not match the published version fingerprint.");
    }
    if (["published", "completed", "rollback_required"].includes(operation.status)
      && operation.postPublicationEvidenceId === evidence.runId) {
      return {
        status: operation.status as "published" | "completed" | "rollback_required",
        operation,
        nextStep: operation.status === "completed"
          ? "complete"
          : operation.status === "rollback_required" ? "rollback" : "verify_publication",
      };
    }
    if (operation.status !== "published") {
      throw new Error("Only a published operation accepts live verification evidence.");
    }
    const decision = recordPostPublicationEvidence(
      operation,
      evidence,
      nextTimestamp(operation.updatedAt, this.now),
    );
    if (!decision.postPublicationEvidenceId) {
      throw new Error("Live verification evidence was not recorded.");
    }
    const updated = this.save(operation, {
      status: decision.status,
      postPublicationEvidenceId: decision.postPublicationEvidenceId,
      ...(decision.rollback ? { rollback: decision.rollback } : {}),
    });
    return {
      status: updated.status as "published" | "completed" | "rollback_required",
      operation: updated,
      nextStep: updated.status === "completed"
        ? "complete"
        : updated.status === "rollback_required" ? "rollback" : "verify_publication",
    };
  }

  async rollback(
    id: string,
    expectedPublishedFingerprint: string,
    expectedTargetFingerprint: string,
  ): Promise<WorkflowRollbackResult> {
    let operation = this.requiredOperation(id);
    if (this.providerAttemptBlocksMutation(operation)) {
      return this.providerProgressResult(operation);
    }
    if (operation.status === "rolled_back"
      && operation.publication?.versionFingerprint === expectedPublishedFingerprint
      && operation.rollback?.targetVersionFingerprint === expectedTargetFingerprint) {
      return { status: "rolled_back", operation, nextStep: "complete" };
    }
    if (operation.status !== "rollback_required" || !operation.version || !operation.rollback) {
      throw new Error("Rollback requires failed live publication evidence.");
    }
    if (operation.version.fingerprint !== expectedPublishedFingerprint
      || operation.publication?.versionFingerprint !== expectedPublishedFingerprint) {
      throw new Error("Rollback does not match the failed published fingerprint.");
    }
    if (operation.version.priorLiveVersionFingerprint !== expectedTargetFingerprint
      || operation.rollback.targetVersionFingerprint !== expectedTargetFingerprint) {
      throw new Error("Rollback does not match the recorded prior-live fingerprint.");
    }
    operation = this.beginProviderAttempt(operation, "rollback");
    let rollback: Awaited<ReturnType<WorkflowGoogleClient["rollbackPublishedVersion"]>>;
    try {
      rollback = await this.google.rollbackPublishedVersion(operation);
    } catch (error) {
      this.failProviderAttempt(operation, this.providerFailureCode(error));
      throw error;
    }
    if (rollback.targetVersionFingerprint !== expectedTargetFingerprint) {
      this.failProviderAttempt(operation, "rollback_mismatch");
      throw new Error("Google rollback did not match the reviewed target fingerprint.");
    }
    const updated = this.completeProviderAttempt(operation, {
      status: "rolled_back",
      rollback,
    });
    return { status: "rolled_back", operation: updated, nextStep: "complete" };
  }

  private requiredOperation(id: string): TrackingSetupOperationV1 {
    const operation = this.repository.get(id);
    if (!operation) throw new Error("Tracking operation was not found.");
    return operation;
  }

  private projectProgress(
    operation: TrackingSetupOperationV1,
    presentation: { displayTimedOut?: boolean; browserReloaded?: boolean; action?: string } = {},
  ): ProviderProgressProjectionV1 {
    const attempt = operation.providerAttempt;
    const checkpoint = operation.status === "versioned"
      ? "await_approval"
      : operation.status === "validated"
        ? "run_preview"
        : operation.status === "published"
          ? "verify_publication"
          : operation.status === "completed" || operation.status === "rolled_back"
            ? "complete"
            : operation.status;
    return providerProgressFromAttempt(
      attempt,
      Boolean(attempt && this.liveProviderAttempts.has(attempt.id)),
      checkpoint,
      presentation,
      this.now().getTime(),
    );
  }

  private providerAttemptBlocksMutation(operation: TrackingSetupOperationV1): boolean {
    const attempt = operation.providerAttempt;
    return attempt?.status === "started"
      || (attempt?.status === "failed" && attempt.failureCode !== "partial_failure");
  }

  private providerProgressResult(operation: TrackingSetupOperationV1): WorkflowProviderProgressResult {
    return {
      status: "provider_progress",
      operation,
      progress: this.projectProgress(operation, { action: "repeat_mutation" }),
    };
  }

  private beginProviderAttempt(
    operation: TrackingSetupOperationV1,
    stage: ProviderStageV1,
  ): TrackingSetupOperationV1 {
    const startedAt = nextTimestamp(operation.updatedAt, this.now);
    const started = this.save(operation, {
      providerAttempt: {
        schemaVersion: 1,
        id: `attempt_${stage}_${Date.parse(startedAt)}`,
        stage,
        status: "started",
        startedAt,
        updatedAt: startedAt,
      },
    });
    this.liveProviderAttempts.add(started.providerAttempt!.id);
    return started;
  }

  private completeProviderAttempt(
    operation: TrackingSetupOperationV1,
    patch: Partial<TrackingSetupOperationV1> = {},
  ): TrackingSetupOperationV1 {
    const attempt = operation.providerAttempt;
    if (!attempt || attempt.status !== "started") throw new Error("No provider attempt is active.");
    const updatedAt = nextTimestamp(attempt.updatedAt, this.now);
    const completed = this.save(operation, {
      ...patch,
      providerAttempt: { ...attempt, status: "completed", updatedAt },
    });
    this.liveProviderAttempts.delete(attempt.id);
    return completed;
  }

  private failProviderAttempt(
    operation: TrackingSetupOperationV1,
    failureCode: ProviderFailureCodeV1,
    patch: Partial<TrackingSetupOperationV1> = {},
  ): TrackingSetupOperationV1 {
    const attempt = operation.providerAttempt;
    if (!attempt || attempt.status !== "started") throw new Error("No provider attempt is active.");
    const updatedAt = nextTimestamp(attempt.updatedAt, this.now);
    const failed = this.save(operation, {
      ...patch,
      providerAttempt: { ...attempt, status: "failed", updatedAt, failureCode },
    });
    this.liveProviderAttempts.delete(attempt.id);
    return failed;
  }

  private providerFailureCode(error: unknown): ProviderFailureCodeV1 {
    if (typeof error === "object" && error !== null && "status" in error) {
      const status = Number((error as { status?: unknown }).status);
      if (status === 401 || status === 403) return "provider_forbidden";
      if (status === 409) return "provider_conflict";
    }
    return "provider_unavailable";
  }

  private repairReady(operation: TrackingSetupOperationV1): Extract<WorkflowDraftRepairResult, { status: "repair_ready" }> {
    const repair = operation.draftRepair;
    if (repair?.status !== "review_required" || !repair.plan) {
      throw new Error("Tracking operation has no reviewable repair.");
    }
    return {
      status: "repair_ready",
      operation,
      nextStep: "review_repair",
      repair: {
        planFingerprint: repair.plan.fingerprint,
        reasonCode: "workspace_entity_drift",
        attempt: repair.ledger.attempts.length + 1,
        maximumAttempts: repair.ledger.maximumAttempts,
      },
    };
  }

  private save(
    current: TrackingSetupOperationV1,
    patch: Partial<TrackingSetupOperationV1>,
  ): TrackingSetupOperationV1 {
    const updated: TrackingSetupOperationV1 = {
      ...current,
      ...patch,
      updatedAt: nextTimestamp(current.updatedAt, this.now),
    };
    const result = this.repository.update(current.id, current.updatedAt, updated);
    if (!result.accepted) throw new Error(`Unable to persist tracking operation: ${result.error}.`);
    return result.operation;
  }
}
