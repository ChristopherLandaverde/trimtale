import {
  bindExactDraftBrowserRun,
  createSetupProposal,
  createTrackingChangePlan,
  GTM_MANAGED_ENTITY_NOTE,
  GTM_MANAGED_WORKSPACE_DESCRIPTION,
  GTM_MANAGED_WORKSPACE_NAME,
  setupArtifactFingerprint,
  type GtmEntitySet,
  type TrackingSetupOperationV1,
} from "@gtm-observability/core";
import { describe, expect, it, vi } from "vitest";
import { GtmDiscoveryClient } from "./google.js";

const workspace = {
  path: "accounts/1/containers/10/workspaces/2", accountId: "1", containerId: "10",
  workspaceId: "2", name: GTM_MANAGED_WORKSPACE_NAME,
  description: GTM_MANAGED_WORKSPACE_DESCRIPTION, fingerprint: "workspace-final",
};

function proposal() {
  return createSetupProposal({
    intent: "Track navigation clicks", pageUrl: "https://example.test/", measurementId: "G-TEST123456",
    container: { accountId: "1", containerId: "10", publicId: "GTM-ABC123", name: "Lead site" },
    navigation: [{ id: "pricing", text: "Pricing", href: "https://example.test/pricing", area: "nav", selector: "nav a[href='/pricing']" }],
  });
}

function currentEntities(): Required<GtmEntitySet> {
  const current = structuredClone(proposal().containerFile.containerVersion);
  const trigger = current.trigger[0] as Record<string, unknown>;
  const tag = current.tag[0] as Record<string, unknown>;
  trigger.triggerId = "42";
  trigger.notes = GTM_MANAGED_ENTITY_NOTE;
  tag.tagId = "43";
  tag.notes = GTM_MANAGED_ENTITY_NOTE;
  tag.firingTriggerId = ["42"];
  return {
    tag: current.tag,
    trigger: current.trigger,
    variable: current.variable ?? [],
    builtInVariable: current.builtInVariable,
  };
}

function operation(status: "applied" | "validated" | "draft_verified" = "applied"): TrackingSetupOperationV1 {
  if (status === "draft_verified") {
    const validated = operation("validated");
    validated.previewPolicy = "exact_draft_required";
    const draftVerification = bindExactDraftBrowserRun(validated, {
      schemaVersion: 1,
      operationId: validated.id,
      setupFingerprint: setupArtifactFingerprint(validated),
      workspaceFingerprint: validated.workspace.fingerprint,
      previewVersionFingerprint: validated.validation!.previewVersionFingerprint!,
      completedAt: "2026-08-22T12:05:00.000Z",
      evidence: {
        schemaVersion: 1,
        runId: "run_exact_preview",
        specificationId: validated.specification.id,
        startedAt: "2026-08-22T12:04:30.000Z",
        observations: {
          interaction: { type: "navigation_click", targetId: "pricing", attempted: true, submissionResult: "unknown" },
          outcome: { observed: true, observable: true, evidenceType: "navigation_click" },
          dataLayer: { matchingEvents: [] },
          tagFired: true,
          network: { ga4Requests: [{ url: "https://www.google-analytics.com/g/collect?en=navigation_click", observedAt: "2026-08-22T12:04:40.000Z" }] },
          consent: { analyticsStorage: "granted" },
        },
        verdict: {
          code: "browser_verified",
          browserVerification: "passed",
          platformConfirmation: "unverified",
          nextAction: "Bind this exact run.",
        },
      },
    });
    return { ...validated, status, draftVerification };
  }
  const generated = proposal();
  const plan = createTrackingChangePlan(generated.containerFile, {});
  return {
    schemaVersion: 1,
    id: "operation_navigation",
    status,
    createdAt: "2026-08-22T12:00:00.000Z",
    updatedAt: "2026-08-22T12:05:00.000Z",
    specification: generated.specification,
    generatedSetup: generated.containerFile,
    container: { publicId: "GTM-ABC123", path: "accounts/1/containers/10" },
    workspace: { path: workspace.path, fingerprint: workspace.fingerprint },
    plan,
    completedActionSignatures: plan.actions.map(({ entitySignature }) => entitySignature),
    ...(status === "validated" ? {
      validation: {
        status: "passed" as const,
        checkedAt: "2026-08-22T12:04:00.000Z",
        workspaceFingerprint: workspace.fingerprint,
        errors: [],
        workspaceChanges: [{ entity: { tag: { notes: GTM_MANAGED_ENTITY_NOTE } } }],
        previewVersionFingerprint: "preview-8",
      },
    } : {}),
  };
}

function validationFetch(options: {
  workspaceFingerprint?: string;
  changes?: readonly unknown[];
  compilerError?: boolean;
  previewFingerprint?: string;
  createCompilerError?: boolean;
  createFailure?: boolean;
  entities?: Required<GtmEntitySet>;
} = {}) {
  const entities = options.entities ?? currentEntities();
  return vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(input.toString());
    if (url.pathname.endsWith("/accounts")) return Response.json({ account: [{ accountId: "1", path: "accounts/1", name: "Agency" }] });
    if (url.pathname.endsWith("/accounts/1/containers")) return Response.json({ container: [{
      accountId: "1", containerId: "10", name: "Lead site", path: "accounts/1/containers/10",
      publicId: "GTM-ABC123", usageContext: ["WEB"],
    }] });
    if (url.pathname.endsWith("/workspaces")) return Response.json({ workspace: [{ ...workspace, fingerprint: options.workspaceFingerprint ?? workspace.fingerprint }] });
    if (url.pathname.endsWith("/versions:live")) return Response.json({
      path: "accounts/1/containers/10/versions/7", containerVersionId: "7", fingerprint: "live-7",
    });
    if (url.pathname.endsWith("/status")) return Response.json({
      workspaceChange: options.changes ?? [{ entity: { tag: { notes: GTM_MANAGED_ENTITY_NOTE } } }],
      mergeConflict: [],
    });
    if (url.pathname.endsWith("/tags")) return Response.json({ tag: entities.tag });
    if (url.pathname.endsWith("/triggers")) return Response.json({ trigger: entities.trigger });
    if (url.pathname.endsWith("/variables")) return Response.json({ variable: entities.variable });
    if (url.pathname.endsWith("/built_in_variables")) return Response.json({ builtInVariable: entities.builtInVariable });
    if (url.pathname.endsWith(":quick_preview")) return Response.json({
      compilerError: options.compilerError ?? false,
      syncStatus: {},
      containerVersion: { fingerprint: options.previewFingerprint ?? "preview-8" },
    });
    if (url.pathname.endsWith(":create_version") && init?.method === "POST") {
      if (options.createFailure) return Response.json({ error: "version failed" }, { status: 500 });
      return Response.json({
        compilerError: options.createCompilerError ?? false,
        syncStatus: {},
        containerVersion: {
          path: "accounts/1/containers/10/versions/8", containerVersionId: "8", fingerprint: "version-8",
        },
        newWorkspacePath: "accounts/1/containers/10/workspaces/3",
      });
    }
    return Response.json({
      accountId: "1", containerId: "10", name: "Lead site", path: "accounts/1/containers/10",
      publicId: "GTM-ABC123", usageContext: ["WEB"],
    });
  });
}

describe("managed workspace validation and version creation", () => {
  it("returns exact clean workspace and compiler-preview evidence without creating a version", async () => {
    const fetcher = validationFetch();
    const result = await new GtmDiscoveryClient(async () => "token", fetcher, true)
      .validateManagedWorkspace(operation());

    expect(result).toMatchObject({
      status: "passed",
      workspaceFingerprint: "workspace-final",
      previewVersionFingerprint: "preview-8",
      errors: [],
    });
    expect(result.workspaceChanges).toHaveLength(1);
    expect(fetcher.mock.calls.some(([input]) => input.toString().includes(":create_version"))).toBe(false);
    expect(fetcher.mock.calls.some(([input]) => input.toString().includes(":publish"))).toBe(false);
  });

  it.each([
    ["compiler errors", { compilerError: true }, "compiler errors"],
    ["stale workspace", { workspaceFingerprint: "workspace-changed" }, "fingerprint changed"],
    ["unexpected changes", { changes: [{ entity: { tag: { notes: "Practitioner work" } } }] }, "unexpected changes"],
  ] as const)("fails validation for %s", async (_name, options, message) => {
    const fetcher = validationFetch(options);
    const result = await new GtmDiscoveryClient(async () => "token", fetcher, true)
      .validateManagedWorkspace(operation());
    expect(result.status).toBe("failed");
    expect(result.errors.join(" ")).toContain(message);
    expect(fetcher.mock.calls.some(([input]) => input.toString().includes(":create_version"))).toBe(false);
  });

  it("creates an immutable version only after fresh validation and preserves prior-live evidence", async () => {
    const fetcher = validationFetch();
    const result = await new GtmDiscoveryClient(async () => "token", fetcher, true)
      .createValidatedVersion(operation("validated"));

    expect(result).toMatchObject({
      status: "versioned",
      version: {
        path: "accounts/1/containers/10/versions/8",
        fingerprint: "version-8",
        priorLiveVersionPath: "accounts/1/containers/10/versions/7",
        priorLiveVersionFingerprint: "live-7",
      },
    });
    const create = fetcher.mock.calls.find(([input]) => input.toString().includes(":create_version"));
    expect(JSON.parse(String(create?.[1]?.body))).toEqual({
      name: `GTM Observability - ${operation("validated").specification.id}`,
      notes: "Tracking setup operation operation_navigation",
    });
    expect(fetcher.mock.calls.some(([input]) => input.toString().includes(":publish"))).toBe(false);
  });

  it("creates an exact-policy version only from a current browser-verified preview fingerprint", async () => {
    const fetcher = validationFetch();
    expect(await new GtmDiscoveryClient(async () => "token", fetcher, true)
      .createValidatedVersion(operation("draft_verified"))).toMatchObject({
        status: "versioned",
        version: { fingerprint: "version-8" },
      });

    const changed = validationFetch({ previewFingerprint: "preview-9" });
    expect(await new GtmDiscoveryClient(async () => "token", changed, true)
      .createValidatedVersion(operation("draft_verified"))).toMatchObject({
        status: "blocked",
        validation: {
          status: "failed",
          errors: ["The GTM preview fingerprint changed after browser verification."],
        },
      });
    expect(changed.mock.calls.some(([input]) => input.toString().includes(":create_version"))).toBe(false);
  });

  it("refuses version creation when GTM returns compiler errors or the request fails", async () => {
    const compiler = validationFetch({ createCompilerError: true });
    expect(await new GtmDiscoveryClient(async () => "token", compiler, true)
      .createValidatedVersion(operation("validated"))).toMatchObject({ status: "blocked" });

    const failure = validationFetch({ createFailure: true });
    await expect(new GtmDiscoveryClient(async () => "token", failure, true)
      .createValidatedVersion(operation("validated"))).rejects.toThrow("version failed");
  });
});
