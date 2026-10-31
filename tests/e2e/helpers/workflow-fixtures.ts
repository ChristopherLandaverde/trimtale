import { expect, type BrowserContext, type Locator } from "@playwright/test";

/** The verified Google account the mocked backend reports as the approver. */
export const sessionApprover = "practitioner@example.test";

type WorkflowOperationStatus =
  | "planned"
  | "applying"
  | "validation_failed"
  | "versioned"
  | "approved"
  | "published"
  | "completed"
  | "rollback_required"
  | "rolled_back";

type WorkflowOperationFactory = (status?: WorkflowOperationStatus) => Record<string, unknown>;

export const navigationSpecId = "spec_e8d91c6baf9f";

const rollbackApproval = {
  approvedAt: "2026-08-30T20:04:00.000Z",
  approvedBy: sessionApprover,
  targetVersionFingerprint: "live-7",
};

/** A rollback-required operation after the separate rollback approval request. */
export function withRollbackApproval(value: Record<string, unknown>): Record<string, unknown> {
  const rollback = value.rollback as Record<string, unknown>;
  return { ...value, rollback: { ...rollback, approval: rollbackApproval } };
}
const navigationOperationId = `operation_${navigationSpecId}`;

export function operation(status: WorkflowOperationStatus = "versioned"): Record<string, unknown> {
  const completedActionSignatures = status === "planned"
    ? []
    : status === "applying"
      ? ["tag:navigation_click"]
      : ["tag:navigation_click", "trigger:navigation_click"];
  return {
    schemaVersion: 1,
    id: navigationOperationId,
    status,
    createdAt: "2026-08-30T20:00:00.000Z",
    updatedAt: "2026-08-30T20:01:00.000Z",
    specification: {
      schemaVersion: 1,
      id: navigationSpecId,
      status: "confirmed",
      originalIntent: "Track navigation clicks",
      interaction: { type: "navigation_click" },
      conversionOutcome: { type: "navigation_engagement", practitionerConfirmed: true },
      event: {
        name: "navigation_click",
        requiredParameters: ["link_text", "link_url"],
        optionalParameters: [],
      },
      targets: [{
        id: "nav_services",
        label: "Services",
        selector: "header a[href=\"/services\"]",
        pageUrl: "http://127.0.0.1:14173/",
      }],
      successEvidence: [{ type: "browser_request", signal: "GA4 navigation_click request" }],
    },
    generatedSetup: {
      exportFormatVersion: 2,
      exportTime: "2026-08-30T20:00:00.000Z",
      containerVersion: {
        path: "accounts/1/containers/10/versions/0",
        accountId: "1",
        containerId: "10",
        containerVersionId: "0",
        name: "Trimtale import",
        description: "fixture",
        container: {
          path: "accounts/1/containers/10",
          accountId: "1",
          containerId: "10",
          name: "Lead site",
          publicId: "GTM-TEST123",
          usageContext: ["WEB"],
        },
        tag: [],
        trigger: [],
        builtInVariable: [],
      },
    },
    container: { publicId: "GTM-TEST123", path: "accounts/1/containers/10" },
    workspace: {
      path: "accounts/1/containers/10/workspaces/99",
      fingerprint: "workspace-final",
    },
    plan: {
      schemaVersion: 1,
      status: "ready",
      fingerprint: "plan-ready",
      actions: [{
        kind: "tag",
        action: "create",
        generatedName: "GA4 Event - navigation_click",
        entitySignature: "tag:navigation_click",
      }, {
        kind: "trigger",
        action: "create",
        generatedName: "Navigation Click Trigger",
        entitySignature: "trigger:navigation_click",
      }],
    },
    completedActionSignatures,
    ...((status === "validation_failed" || status === "versioned" || status === "approved" || status === "published" || status === "completed" || status === "rollback_required" || status === "rolled_back") ? {
      validation: {
        status: status === "validation_failed" ? "failed" : "passed",
        checkedAt: "2026-08-30T20:01:00.000Z",
        workspaceFingerprint: "workspace-final",
        errors: status === "validation_failed" ? ["The preview compiler rejected the generated trigger."] : [],
      },
    } : {}),
    ...((status === "versioned" || status === "approved" || status === "published" || status === "completed" || status === "rollback_required" || status === "rolled_back") ? {
      version: {
        path: "accounts/1/containers/10/versions/8",
        fingerprint: "version-8",
        priorLiveVersionPath: "accounts/1/containers/10/versions/7",
        priorLiveVersionFingerprint: "live-7",
      },
    } : {}),
    ...((status === "approved" || status === "published" || status === "completed" || status === "rollback_required" || status === "rolled_back") ? {
      approval: {
        approvedAt: "2026-08-30T20:02:00.000Z",
        approvedBy: sessionApprover,
        versionFingerprint: "version-8",
      },
    } : {}),
    ...((status === "published" || status === "completed" || status === "rollback_required" || status === "rolled_back") ? {
      publication: {
        publishedAt: "2026-08-30T20:03:00.000Z",
        versionFingerprint: "version-8",
      },
    } : {}),
    ...(status === "completed" ? {
      postPublicationEvidenceId: "run_nav_services_1798646400000",
    } : {}),
    ...((status === "rollback_required" || status === "rolled_back") ? {
      postPublicationEvidenceId: "run_nav_services_1798646400000",
      rollback: {
        targetVersionFingerprint: "live-7",
        status: status === "rolled_back" ? "completed" : "required",
        ...(status === "rolled_back" ? { completedAt: "2026-08-30T20:05:00.000Z", approval: rollbackApproval } : {}),
      },
    } : {}),
  };
}

export function formOperation(status: WorkflowOperationStatus = "versioned"): Record<string, unknown> {
  const completedActionSignatures = status === "planned"
    ? []
    : status === "applying"
      ? ["tag:generate_lead"]
      : ["tag:generate_lead", "trigger:generate_lead"];
  return {
    schemaVersion: 1,
    id: "operation_spec_form_contact",
    status,
    createdAt: "2026-08-30T20:00:00.000Z",
    updatedAt: "2026-08-30T20:01:00.000Z",
    specification: {
      schemaVersion: 1,
      id: "spec_form_contact",
      status: "confirmed",
      originalIntent: "Track qualified inquiries from Contact sales",
      interaction: { type: "form_submission" },
      conversionOutcome: { type: "qualified_inquiry", practitionerConfirmed: true },
      event: {
        name: "generate_lead",
        requiredParameters: ["form_id", "form_name", "page_location"],
        optionalParameters: [],
      },
      targets: [{
        id: "contact",
        label: "Contact sales",
        selector: "#contact",
        pageUrl: "http://127.0.0.1:14173/",
      }],
      successEvidence: [{ type: "visible_element", selector: "#contact-success" }],
    },
    generatedSetup: {
      exportFormatVersion: 2,
      exportTime: "2026-08-30T20:00:00.000Z",
      containerVersion: {
        path: "accounts/1/containers/10/versions/0",
        accountId: "1",
        containerId: "10",
        containerVersionId: "0",
        name: "Trimtale import",
        description: "fixture",
        container: {
          path: "accounts/1/containers/10",
          accountId: "1",
          containerId: "10",
          name: "Lead site",
          publicId: "GTM-TEST123",
          usageContext: ["WEB"],
        },
        tag: [],
        trigger: [],
        builtInVariable: [],
      },
    },
    container: { publicId: "GTM-TEST123", path: "accounts/1/containers/10" },
    workspace: {
      path: "accounts/1/containers/10/workspaces/99",
      fingerprint: "workspace-final",
    },
    plan: {
      schemaVersion: 1,
      status: "ready",
      fingerprint: "form-plan-ready",
      actions: [{
        kind: "tag",
        action: "create",
        generatedName: "GA4 Event - generate_lead",
        entitySignature: "tag:generate_lead",
      }, {
        kind: "trigger",
        action: "create",
        generatedName: "Generate Lead Trigger",
        entitySignature: "trigger:generate_lead",
      }],
    },
    completedActionSignatures,
    ...((status === "validation_failed" || status === "versioned" || status === "approved" || status === "published" || status === "completed" || status === "rollback_required" || status === "rolled_back") ? {
      validation: {
        status: status === "validation_failed" ? "failed" : "passed",
        checkedAt: "2026-08-30T20:01:00.000Z",
        workspaceFingerprint: "workspace-final",
        errors: status === "validation_failed" ? ["The preview compiler rejected the generated trigger."] : [],
      },
    } : {}),
    ...((status === "versioned" || status === "approved" || status === "published" || status === "completed" || status === "rollback_required" || status === "rolled_back") ? {
      version: {
        path: "accounts/1/containers/10/versions/8",
        fingerprint: "version-8",
        priorLiveVersionPath: "accounts/1/containers/10/versions/7",
        priorLiveVersionFingerprint: "live-7",
      },
    } : {}),
    ...((status === "approved" || status === "published" || status === "completed" || status === "rollback_required" || status === "rolled_back") ? {
      approval: {
        approvedAt: "2026-08-30T20:02:00.000Z",
        approvedBy: sessionApprover,
        versionFingerprint: "version-8",
      },
    } : {}),
    ...((status === "published" || status === "completed" || status === "rollback_required" || status === "rolled_back") ? {
      publication: {
        publishedAt: "2026-08-30T20:03:00.000Z",
        versionFingerprint: "version-8",
      },
    } : {}),
    ...(status === "completed" ? {
      postPublicationEvidenceId: "run_form_contact",
    } : {}),
    ...((status === "rollback_required" || status === "rolled_back") ? {
      postPublicationEvidenceId: "run_form_contact",
      rollback: {
        targetVersionFingerprint: "live-7",
        status: status === "rolled_back" ? "completed" : "required",
        ...(status === "rolled_back" ? { completedAt: "2026-08-30T20:05:00.000Z", approval: rollbackApproval } : {}),
      },
    } : {}),
  };
}

export async function mockWritableContainerAndWorkflow(
  context: BrowserContext,
  options: {
    resumeResults?: Array<Record<string, unknown>>;
    approveResult?: Record<string, unknown>;
    approveStatus?: number;
    onApprove?: (body: Record<string, unknown>) => void;
    publishResult?: Record<string, unknown>;
    publishStatus?: number;
    publishError?: string;
    browserVerificationResult?: Record<string, unknown>;
    onBrowserVerification?: (body: Record<string, unknown>) => void;
    rollbackApprovalResult?: Record<string, unknown>;
    onRollbackApproval?: (body: Record<string, unknown>) => void;
    rollbackResult?: Record<string, unknown>;
    rollbackStatus?: number;
    rollbackError?: string;
    onRollback?: (body: Record<string, unknown>) => void;
    storedOperation?: Record<string, unknown>;
    workflowOperation?: WorkflowOperationFactory;
    onResume?: () => void;
    onPublish?: (body: Record<string, unknown>) => void;
  } = {},
): Promise<void> {
  const workflowOperation = options.workflowOperation ?? operation;
  await context.route("http://127.0.0.1:18787/api/google/containers/**", async (route) => {
    const request = route.request();
    const preparing = request.method() === "POST";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ...(preparing ? {} : { containerWritesEnabled: true }),
        result: {
          status: "recognized",
          publicId: "GTM-TEST123",
          container: { name: "Lead site", publicId: "GTM-TEST123" },
          workspace: preparing
            ? {
              status: "created",
              workspaceCount: 2,
              workspace: { name: "GTM Observability", workspaceId: "99" },
            }
            : {
              status: "available",
              action: "create",
              workspaceCount: 1,
              remainingSlots: 2,
            },
        },
      }),
    });
  });
  await context.route("http://127.0.0.1:18787/api/google/workflows/plan", async (route) => {
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ result: { status: "planned", operation: workflowOperation("planned") } }),
    });
  });
  let resumeIndex = 0;
  await context.route("http://127.0.0.1:18787/api/google/workflows/*/resume", async (route) => {
    options.onResume?.();
    const resumeResult = options.resumeResults?.[
      Math.min(resumeIndex, Math.max(options.resumeResults.length - 1, 0))
    ] ?? { status: "versioned", nextStep: "await_approval", operation: workflowOperation("versioned") };
    resumeIndex += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ result: resumeResult }),
    });
  });
  await context.route(/http:\/\/127\.0\.0\.1:18787\/api\/google\/workflows\/(?!plan$)[^/]+$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ operation: options.storedOperation ?? workflowOperation("versioned") }),
    });
  });
  await context.route("http://127.0.0.1:18787/api/google/workflows/*/approve", async (route) => {
    options.onApprove?.(postedJson(route.request().postData()));
    const status = options.approveStatus ?? 200;
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(status >= 400 && !options.approveResult
        ? { error: "Approval blocked." }
        : {
          result: options.approveResult ?? {
            status: "approved",
            nextStep: "publish",
            approvalExpiresAt: "2026-08-30T20:32:00.000Z",
            operation: workflowOperation("approved"),
          },
        }),
    });
  });
  await context.route("http://127.0.0.1:18787/api/google/workflows/*/publish", async (route) => {
    options.onPublish?.(postedJson(route.request().postData()));
    if (options.publishStatus && options.publishStatus >= 400) {
      await route.fulfill({
        status: options.publishStatus,
        contentType: "application/json",
        body: JSON.stringify(options.publishResult
          ? { result: options.publishResult }
          : { error: options.publishError ?? "Publication blocked." }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        result: options.publishResult ?? {
          status: "published",
          nextStep: "verify_publication",
          operation: workflowOperation("published"),
        },
      }),
    });
  });
  await context.route("http://127.0.0.1:18787/api/google/workflows/*/browser-verification", async (route) => {
    let raw: unknown = {};
    try {
      raw = route.request().postDataJSON();
    } catch {
      raw = {};
    }
    if (raw && typeof raw === "object" && !Array.isArray(raw)) options.onBrowserVerification?.(raw as Record<string, unknown>);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        result: options.browserVerificationResult ?? {
          status: "completed",
          nextStep: "platform_unavailable",
          operation: workflowOperation("completed"),
        },
      }),
    });
  });
  await context.route("http://127.0.0.1:18787/api/google/workflows/*/rollback-approval", async (route) => {
    options.onRollbackApproval?.(postedJson(route.request().postData()));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        result: options.rollbackApprovalResult ?? {
          status: "rollback_approved",
          nextStep: "rollback",
          approvalExpiresAt: "2026-08-30T20:34:00.000Z",
          operation: withRollbackApproval(workflowOperation("rollback_required")),
        },
      }),
    });
  });
  await context.route("http://127.0.0.1:18787/api/google/workflows/*/rollback", async (route) => {
    let raw: unknown = {};
    try {
      raw = route.request().postDataJSON();
    } catch {
      raw = {};
    }
    if (raw && typeof raw === "object" && !Array.isArray(raw)) options.onRollback?.(raw as Record<string, unknown>);
    if (options.rollbackStatus && options.rollbackStatus >= 400) {
      await route.fulfill({
        status: options.rollbackStatus,
        contentType: "application/json",
        body: JSON.stringify(options.rollbackResult
          ? { result: options.rollbackResult }
          : { error: options.rollbackError ?? "Rollback blocked." }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        result: options.rollbackResult ?? {
          status: "rolled_back",
          nextStep: "complete",
          operation: workflowOperation("rolled_back"),
        },
      }),
    });
  });
}

function postedJson(data: string | null): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(data ?? "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

/** Review what will publish, type the container ID, approve; then publish in a separate step. */
export async function approveThenPublish(root: Locator, containerId = "GTM-TEST123", fingerprint = "version-8"): Promise<void> {
  await root.getByRole("region", { name: "Setup operation" }).getByRole("button", { name: "Review and approve" }).click();
  const review = root.getByRole("region", { name: "Publication review" });
  await review.getByLabel(`Type ${containerId} to confirm`).fill(containerId);
  await review.getByRole("button", { name: `Approve ${fingerprint}` }).click();
  const operationRegion = root.getByRole("region", { name: "Setup operation" });
  await expect(operationRegion.getByText(`Approved fingerprint ${fingerprint} by ${sessionApprover}`)).toBeVisible();
  await operationRegion.getByRole("button", { name: `Publish ${fingerprint}` }).click();
}

/** Review the rollback, type the container ID, approve; then roll back in a separate step. */
export async function approveThenRollBack(root: Locator, containerId = "GTM-TEST123", target = "live-7"): Promise<void> {
  await root.getByRole("region", { name: "Setup operation" }).getByRole("button", { name: "Review rollback" }).click();
  const review = root.getByRole("region", { name: "Rollback review" });
  await review.getByLabel(`Type ${containerId} to confirm`).fill(containerId);
  await review.getByRole("button", { name: `Approve rollback to ${target}` }).click();
  const operationRegion = root.getByRole("region", { name: "Setup operation" });
  await expect(operationRegion.getByText(`Approved restoring ${target} by ${sessionApprover}`)).toBeVisible();
  await operationRegion.getByRole("button", { name: `Roll back to ${target}` }).click();
}
