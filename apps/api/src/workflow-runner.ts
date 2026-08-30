import {
  approveTrackingVersion,
  createFormSetupProposal,
  createSetupProposal,
  recordPostPublicationEvidence,
  type FormSetupRequest,
  type SetupRequest,
  type TrackingRunEvidenceV1,
  type TrackingSetupOperationV1,
} from "@gtm-observability/core";
import type { GtmDiscoveryClient } from "./google.js";
import { TrackingOperationRepository } from "./tracking-operations.js";

export type WorkflowGoogleClient = Pick<GtmDiscoveryClient,
  | "planManagedWorkspace"
  | "prepareManagedWorkspace"
  | "applyManagedWorkspace"
  | "validateManagedWorkspace"
  | "createValidatedVersion"
  | "publishApprovedVersion"
>;

export type TrackingWorkflowRequest = SetupRequest | FormSetupRequest;

export type WorkflowPlanResult =
  | { status: "planned" | "reused"; operation: TrackingSetupOperationV1 }
  | { status: "blocked"; stage: "workspace" | "planning"; reason: string; details?: unknown };

export type WorkflowResumeResult =
  | { status: "versioned"; operation: TrackingSetupOperationV1; nextStep: "await_approval" }
  | {
    status: "blocked" | "paused";
    operation: TrackingSetupOperationV1;
    stage: "planning" | "application" | "validation" | "version";
    reason: string;
    details?: unknown;
  };

export type WorkflowPublishResult =
  | { status: "published"; operation: TrackingSetupOperationV1; nextStep: "verify_publication" }
  | {
    status: "blocked";
    operation: TrackingSetupOperationV1;
    stage: "approval" | "publication";
    reason: string;
    details?: unknown;
  };

export type WorkflowBrowserVerificationResult =
  | { status: "completed"; operation: TrackingSetupOperationV1; nextStep: "platform_unavailable" }
  | { status: "rollback_required"; operation: TrackingSetupOperationV1; nextStep: "rollback_approval" };

function nextTimestamp(previous: string, now: () => Date): string {
  const candidate = now().getTime();
  return new Date(Math.max(candidate, Date.parse(previous) + 1)).toISOString();
}

export class TrackingWorkflowRunner {
  constructor(
    private readonly repository: TrackingOperationRepository,
    private readonly google: WorkflowGoogleClient,
    private readonly now: () => Date = () => new Date(),
  ) {}

  get(id: string): TrackingSetupOperationV1 | undefined {
    return this.repository.get(id);
  }

  async plan(request: TrackingWorkflowRequest): Promise<WorkflowPlanResult> {
    const proposal = "specification" in request
      ? createFormSetupProposal(request)
      : createSetupProposal(request);
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
    };
    const created = this.repository.create(operation);
    return created.accepted
      ? { status: "planned", operation: created.operation }
      : { status: "reused", operation: this.requiredOperation(id) };
  }

  async resume(id: string): Promise<WorkflowResumeResult> {
    let operation = this.requiredOperation(id);
    if (operation.status === "versioned") {
      return { status: "versioned", operation, nextStep: "await_approval" };
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
    if (!["planned", "applying", "applied", "validated"].includes(operation.status)) {
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
      const application = await this.google.applyManagedWorkspace(operation);
      if (application.status !== "applied") {
        operation = this.save(operation, {
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
      operation = this.save(operation, {
        status: "applied",
        completedActionSignatures: application.completedActionSignatures,
        workspace: {
          ...operation.workspace,
          fingerprint: application.workspaceFingerprint ?? operation.workspace.fingerprint,
        },
      });
    }

    if (operation.status === "applied") {
      const validation = await this.google.validateManagedWorkspace(operation);
      operation = this.save(operation, {
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
    }

    if (operation.status !== "validated") {
      return {
        status: "blocked",
        operation,
        stage: "version",
        reason: `operation_${operation.status}`,
      };
    }
    const version = await this.google.createValidatedVersion(operation);
    if (version.status !== "versioned") {
      operation = this.save(operation, {
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
    operation = this.save(operation, {
      status: "versioned",
      validation: version.validation,
      version: version.version,
    });
    return { status: "versioned", operation, nextStep: "await_approval" };
  }

  async approveAndPublish(
    id: string,
    approvedFingerprint: string,
    approvedBy: string,
  ): Promise<WorkflowPublishResult> {
    const operation = this.requiredOperation(id);
    if (operation.status !== "versioned" || !operation.version) {
      return {
        status: "blocked",
        operation,
        stage: "approval",
        reason: "operation_not_versioned",
      };
    }
    if (approvedFingerprint !== operation.version.fingerprint) {
      return {
        status: "blocked",
        operation,
        stage: "approval",
        reason: "fingerprint_mismatch",
      };
    }
    const approved = approveTrackingVersion(
      operation,
      approvedBy,
      nextTimestamp(operation.updatedAt, this.now),
    );
    if (!approved.approval) throw new Error("Publication approval was not recorded.");
    const publication = await this.google.publishApprovedVersion(approved);
    const published = this.save(operation, {
      status: "published",
      approval: approved.approval,
      publication,
    });
    return { status: "published", operation: published, nextStep: "verify_publication" };
  }

  async recordBrowserVerification(
    id: string,
    evidence: TrackingRunEvidenceV1,
  ): Promise<WorkflowBrowserVerificationResult> {
    const operation = this.requiredOperation(id);
    const updated = recordPostPublicationEvidence(
      operation,
      evidence,
      nextTimestamp(operation.updatedAt, this.now),
    );
    const saved = this.save(operation, updated);
    return saved.status === "completed"
      ? { status: "completed", operation: saved, nextStep: "platform_unavailable" }
      : { status: "rollback_required", operation: saved, nextStep: "rollback_approval" };
  }

  private requiredOperation(id: string): TrackingSetupOperationV1 {
    const operation = this.repository.get(id);
    if (!operation) throw new Error("Tracking operation was not found.");
    return operation;
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
