import { expect, test, chromium, type BrowserContext } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const screenshotOptions = {
  animations: "disabled" as const,
  stylePath: resolve("tests/e2e/visual-stability.css"),
};

const navigationSpecId = "spec_e8d91c6baf9f";
const navigationOperationId = `operation_${navigationSpecId}`;

function operation(status: "planned" | "applying" | "validation_failed" | "versioned" | "published" | "completed" | "rollback_required" = "versioned") {
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
        name: "GTM Observability import",
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
    ...((status === "validation_failed" || status === "versioned" || status === "published" || status === "completed" || status === "rollback_required") ? {
      validation: {
        status: status === "validation_failed" ? "failed" : "passed",
        checkedAt: "2026-08-30T20:01:00.000Z",
        workspaceFingerprint: "workspace-final",
        errors: status === "validation_failed" ? ["The preview compiler rejected the generated trigger."] : [],
      },
    } : {}),
    ...((status === "versioned" || status === "published" || status === "completed" || status === "rollback_required") ? {
      version: {
        path: "accounts/1/containers/10/versions/8",
        fingerprint: "version-8",
        priorLiveVersionPath: "accounts/1/containers/10/versions/7",
        priorLiveVersionFingerprint: "live-7",
      },
    } : {}),
    ...((status === "published" || status === "completed" || status === "rollback_required") ? {
      approval: {
        approvedAt: "2026-08-30T20:02:00.000Z",
        approvedBy: "website assistant",
        versionFingerprint: "version-8",
      },
      publication: {
        publishedAt: "2026-08-30T20:03:00.000Z",
        versionFingerprint: "version-8",
      },
    } : {}),
    ...(status === "completed" ? {
      postPublicationEvidenceId: "run_nav_services_1798646400000",
    } : {}),
    ...(status === "rollback_required" ? {
      postPublicationEvidenceId: "run_nav_services_1798646400000",
      rollback: { targetVersionFingerprint: "live-7", status: "required" },
    } : {}),
  };
}

async function mockWritableContainerAndWorkflow(
  context: BrowserContext,
  options: {
    resumeResults?: Array<Record<string, unknown>>;
    publishResult?: Record<string, unknown>;
    publishStatus?: number;
    publishError?: string;
    browserVerificationResult?: Record<string, unknown>;
    onBrowserVerification?: (body: Record<string, unknown>) => void;
    storedOperation?: Record<string, unknown>;
    onResume?: () => void;
    onPublish?: () => void;
  } = {},
) {
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
      body: JSON.stringify({ result: { status: "planned", operation: operation("planned") } }),
    });
  });
  let resumeIndex = 0;
  await context.route("http://127.0.0.1:18787/api/google/workflows/*/resume", async (route) => {
    options.onResume?.();
    const resumeResult = options.resumeResults?.[
      Math.min(resumeIndex, Math.max(options.resumeResults.length - 1, 0))
    ] ?? { status: "versioned", nextStep: "await_approval", operation: operation("versioned") };
    resumeIndex += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ result: resumeResult }),
    });
  });
  await context.route(new RegExp(`http://127\\.0\\.0\\.1:18787/api/google/workflows/${navigationOperationId}$`), async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ operation: options.storedOperation ?? operation("versioned") }),
    });
  });
  await context.route("http://127.0.0.1:18787/api/google/workflows/*/publish", async (route) => {
    options.onPublish?.();
    if (options.publishStatus && options.publishStatus >= 400) {
      await route.fulfill({
        status: options.publishStatus,
        contentType: "application/json",
        body: JSON.stringify({ error: options.publishError ?? "Publication blocked." }),
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
          operation: operation("published"),
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
          operation: operation("completed"),
        },
      }),
    });
  });
}

test("mounts and streams through the floating tracking assistant", async () => {
  const profile = await mkdtemp(join(tmpdir(), "gtm-observability-"));
  const extensionPath = resolve("apps/extension/dist");
  const context = await chromium.launchPersistentContext(profile, {
    channel: "chromium",
    headless: true,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });

  try {
    const site = await context.newPage();
    await site.goto("http://127.0.0.1:14173/");

    const root = site.locator("#gtm-observability-root");
    const assistant = root.locator("section.assistant");
    await expect(root).toBeAttached();
    await expect(assistant).toHaveClass(/collapsed/);
    await expect(assistant).toHaveScreenshot("assistant-collapsed.png", screenshotOptions);

    await root.getByRole("button", { name: "Open tracking assistant" }).click();
    await expect(assistant).not.toHaveClass(/collapsed/);
    await expect(root.getByText("What do you want to track on this page?")).toBeVisible();
    await expect(root.getByRole("button", { name: /model evaluation reports/i })).toHaveCount(0);
    await expect(root.getByText("Evals", { exact: true })).toHaveCount(0);
    await expect(root.getByLabel("Tracking request")).toBeFocused();
    expect(await assistant.evaluate((element) => getComputedStyle(element).fontFamily)).toContain("Inter");
    await root.getByLabel("Tracking request").evaluate((element) => (element as HTMLElement).blur());
    await expect(assistant).toHaveScreenshot("assistant-open.png", screenshotOptions);

    await root.getByLabel("Tracking request").fill("navigation");
    await root.getByRole("button", { name: "Send request" }).click();
    await expect(root.getByText("navigation", { exact: true })).toBeVisible();
    await expect(root.getByText(/I found 5 navigation links/)).toBeVisible();
    await root.getByRole("button", { name: "Choose links" }).click();
    await expect(root.locator(".pick")).toHaveCount(5);
    await expect(assistant).toHaveScreenshot("assistant-navigation-scope.png", screenshotOptions);
    await root.getByRole("button", { name: "Confirm selection" }).click();
    await expect(root.getByText("5 navigation links selected and highlighted on the page.")).toBeVisible();
    await expect(root.getByRole("region", { name: "Tracking evidence path" })).toBeVisible();
    await expect(root.getByText("Navigation clicks → navigation_click")).toBeVisible();
    await expect(root.getByText("Reviewable navigation_click setup generated")).toBeVisible();
    await expect(root.getByText("No GTM container detected on this page")).toBeVisible();
    await expect(root.getByText("Unverified — browser evidence cannot confirm GA4 processing")).toBeVisible();
    await expect(site.locator("#gtm-observability-targets")).toBeAttached();
    await expect(site.locator("#gtm-observability-targets").locator(".target.confirmed")).toHaveCount(5);
    await expect(assistant).toHaveScreenshot("assistant-evidence-path.png", screenshotOptions);

    const downloadPromise = site.waitForEvent("download");
    await root.getByRole("button", { name: "Download GTM setup" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("gtm-observability-navigation-click.json");
    const downloadPath = await download.path();
    if (!downloadPath) throw new Error("The navigation setup download did not produce a local artifact.");
    const generated = JSON.parse(readFileSync(downloadPath, "utf8")) as {
      containerVersion?: { tag?: unknown[]; trigger?: unknown[] };
    };
    expect(generated.containerVersion?.tag).toHaveLength(1);
    expect(generated.containerVersion?.trigger).toHaveLength(1);
    await expect(root.getByText(/Nothing was applied or published/)).toBeVisible();

    const setupResponse = await site.request.post("http://127.0.0.1:18787/api/setups", {
      data: {
        intent: "Track navigation links",
        pageUrl: "http://127.0.0.1:14173/",
        measurementId: "G-TEST123456",
        navigation: [
          {
            id: "nav_services",
            text: "Services",
            href: "http://127.0.0.1:14173/services",
            area: "header",
            selector: "header a[href='/services']",
          },
        ],
        container: {
          accountId: "1",
          containerId: "2",
          publicId: "GTM-TEST123",
          name: "E2E container",
        },
      },
    });
    expect(setupResponse.status()).toBe(201);
    const setup = await setupResponse.json();
    expect(setup.specification).toMatchObject({
      schemaVersion: 1,
      status: "confirmed",
      interaction: { type: "navigation_click" },
      event: { name: "navigation_click" },
    });

    await root.getByRole("button", { name: "Collapse assistant" }).click();
    await expect(assistant).toHaveClass(/collapsed/);
    await site.reload();
    await expect(site.locator("#gtm-observability-root section.assistant")).toHaveClass(/collapsed/);
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});

test("reports an observed GTM public container ID separately from setup generation", async () => {
  const profile = await mkdtemp(join(tmpdir(), "gtm-observability-runtime-"));
  const extensionPath = resolve("apps/extension/dist");
  const context = await chromium.launchPersistentContext(profile, {
    channel: "chromium",
    headless: true,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  try {
    const site = await context.newPage();
    await site.goto("http://127.0.0.1:14173/?gtm=GTM-TEST123");
    const root = site.locator("#gtm-observability-root");
    await root.getByRole("button", { name: "Open tracking assistant" }).click();
    await root.getByLabel("Tracking request").fill("navigation");
    await root.getByRole("button", { name: "Send request" }).click();
    await root.getByRole("button", { name: "Track all" }).click();
    await expect(root.getByText("Detected GTM-TEST123")).toBeVisible();
    await expect(root.getByText("Reviewable navigation_click setup generated")).toBeVisible();
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});

test("does not claim setup generation without measurement context", async () => {
  const profile = await mkdtemp(join(tmpdir(), "gtm-observability-missing-measurement-"));
  const extensionPath = resolve("apps/extension/dist");
  const context = await chromium.launchPersistentContext(profile, {
    channel: "chromium",
    headless: true,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  try {
    const site = await context.newPage();
    await site.goto("http://127.0.0.1:14173/?gtm=GTM-TEST123");
    await site.locator('meta[name="gtm-observability-measurement-id"]').evaluate((meta) => meta.remove());
    const root = site.locator("#gtm-observability-root");
    await root.getByRole("button", { name: "Open tracking assistant" }).click();
    await root.getByLabel("Tracking request").fill("navigation");
    await root.getByRole("button", { name: "Send request" }).click();
    await root.getByRole("button", { name: "Track all" }).click();

    await expect(root.getByText("Connect a GTM container and GA4 measurement ID to generate setup")).toBeVisible();
    await expect(root.getByRole("button", { name: "Download GTM setup" })).toHaveCount(0);
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});

test("matches the observed container and explicitly prepares one managed workspace", async () => {
  const profile = await mkdtemp(join(tmpdir(), "gtm-observability-managed-workspace-"));
  const extensionPath = resolve("apps/extension/dist");
  const context = await chromium.launchPersistentContext(profile, {
    channel: "chromium",
    headless: true,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  let preparationCount = 0;
  await context.route("http://127.0.0.1:18787/api/google/containers/**", async (route) => {
    const request = route.request();
    const preparing = request.method() === "POST";
    if (preparing) preparationCount += 1;
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
  try {
    const site = await context.newPage();
    await site.goto("http://127.0.0.1:14173/?gtm=GTM-TEST123");
    const root = site.locator("#gtm-observability-root");
    await root.getByRole("button", { name: "Open tracking assistant" }).click();
    await root.getByLabel("Tracking request").fill("navigation");
    await root.getByRole("button", { name: "Send request" }).click();
    await root.getByRole("button", { name: "Track all" }).click();

    await root.getByRole("button", { name: "Check GTM access" }).click();
    await expect(root.getByText(/Recognized Lead site.*Managed workspace can be prepared/)).toBeVisible();
    expect(preparationCount).toBe(0);

    await root.getByRole("button", { name: "Prepare managed workspace" }).click();
    await expect(root.getByText(/Recognized Lead site.*GTM Observability prepared \(2\/3 slots occupied\)/)).toBeVisible();
    expect(preparationCount).toBe(1);
    await expect(root.getByText(/published/i)).toHaveCount(0);
    await expect(root.locator("section.assistant")).toHaveScreenshot(
      "assistant-managed-workspace.png",
      screenshotOptions,
    );
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});

test("does not start operations when managed workspace inspection is blocked", async () => {
  const cases = [
    {
      workspace: { status: "capacity_blocked", workspaceCount: 3 },
      expected: /All 3 workspace slots are occupied/,
    },
    {
      workspace: { status: "ownership_conflict" },
      expected: /Multiple managed ownership markers found/,
    },
    {
      workspace: { status: "sync_conflict" },
      expected: /Managed workspace has synchronization conflicts/,
    },
  ];
  for (const [index, item] of cases.entries()) {
    const profile = await mkdtemp(join(tmpdir(), `gtm-observability-workspace-block-${index}-`));
    const extensionPath = resolve("apps/extension/dist");
    const context = await chromium.launchPersistentContext(profile, {
      channel: "chromium",
      headless: true,
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    });
    await context.route("http://127.0.0.1:18787/api/google/containers/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          containerWritesEnabled: true,
          result: {
            status: "recognized",
            publicId: "GTM-TEST123",
            container: { name: "Lead site", publicId: "GTM-TEST123" },
            workspace: item.workspace,
          },
        }),
      });
    });
    try {
      const site = await context.newPage();
      await site.goto("http://127.0.0.1:14173/?gtm=GTM-TEST123");
      const root = site.locator("#gtm-observability-root");
      await root.getByRole("button", { name: "Open tracking assistant" }).click();
      await root.getByLabel("Tracking request").fill("navigation");
      await root.getByRole("button", { name: "Send request" }).click();
      await root.getByRole("button", { name: "Track all" }).click();
      await root.getByRole("button", { name: "Check GTM access" }).click();

      await expect(root.getByText(item.expected)).toBeVisible();
      await expect(root.getByRole("button", { name: "Prepare GTM version" })).toHaveCount(0);
      await expect(root.getByRole("button", { name: "Prepare managed workspace" })).toHaveCount(0);
    } finally {
      await context.close();
      await rm(profile, { recursive: true, force: true });
    }
  }
});

test("starts a navigation setup operation and stops at approval", async () => {
  const profile = await mkdtemp(join(tmpdir(), "gtm-observability-navigation-operation-"));
  const extensionPath = resolve("apps/extension/dist");
  const context = await chromium.launchPersistentContext(profile, {
    channel: "chromium",
    headless: true,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  await mockWritableContainerAndWorkflow(context);
  try {
    const site = await context.newPage();
    await site.goto("http://127.0.0.1:14173/?gtm=GTM-TEST123");
    const root = site.locator("#gtm-observability-root");
    await root.getByRole("button", { name: "Open tracking assistant" }).click();
    await root.getByLabel("Tracking request").fill("navigation");
    await root.getByRole("button", { name: "Send request" }).click();
    await root.getByRole("button", { name: "Track all" }).click();
    await root.getByRole("button", { name: "Check GTM access" }).click();
    await expect(root.getByRole("button", { name: "Prepare GTM version" })).toBeVisible();

    await root.getByRole("button", { name: "Prepare GTM version" }).click();
    await expect(root.getByRole("region", { name: "Setup operation" })).toBeVisible();
    await expect(root.getByText("Immutable version created")).toBeVisible();
    await expect(root.getByText("Version fingerprint version-8")).toBeVisible();
    await expect(root.getByText(/Separate approval is required; nothing was published/)).toBeVisible();
    await expect(root.getByText(/platform-confirmed/i)).toHaveCount(0);
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});

test("starts a lead-form setup operation and stops at approval", async () => {
  const profile = await mkdtemp(join(tmpdir(), "gtm-observability-form-operation-"));
  const extensionPath = resolve("apps/extension/dist");
  const context = await chromium.launchPersistentContext(profile, {
    channel: "chromium",
    headless: true,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  await mockWritableContainerAndWorkflow(context);
  try {
    const site = await context.newPage();
    await site.goto("http://127.0.0.1:14173/?gtm=GTM-TEST123");
    const root = site.locator("#gtm-observability-root");
    await root.getByRole("button", { name: "Open tracking assistant" }).click();
    await root.getByLabel("Tracking request").fill("Track leads from a form");
    await root.getByRole("button", { name: "Send request" }).click();
    await root.getByRole("button", { name: "Contact sales" }).click();
    await root.getByRole("button", { name: "Review setup" }).click();
    await root.getByRole("button", { name: "Confirm setup" }).click();
    await root.getByRole("button", { name: "Check GTM access" }).click();
    await expect(root.getByRole("button", { name: "Prepare GTM version" })).toBeVisible();

    await root.getByRole("button", { name: "Prepare GTM version" }).click();
    await expect(root.getByRole("region", { name: "Setup operation" })).toBeVisible();
    await expect(root.getByText("GTM setup operation reached await_approval")).toBeVisible();
    await expect(root.getByText("Prior live version: live-7")).toBeVisible();
    await expect(root.getByText(/platform-confirmed/i)).toHaveCount(0);
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});

test("reloads the latest setup operation from durable storage", async () => {
  const profile = await mkdtemp(join(tmpdir(), "gtm-observability-operation-reload-"));
  const extensionPath = resolve("apps/extension/dist");
  const context = await chromium.launchPersistentContext(profile, {
    channel: "chromium",
    headless: true,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  await mockWritableContainerAndWorkflow(context);
  try {
    const site = await context.newPage();
    await site.goto("http://127.0.0.1:14173/?gtm=GTM-TEST123");
    let root = site.locator("#gtm-observability-root");
    await root.getByRole("button", { name: "Open tracking assistant" }).click();
    await root.getByLabel("Tracking request").fill("navigation");
    await root.getByRole("button", { name: "Send request" }).click();
    await root.getByRole("button", { name: "Track all" }).click();
    await root.getByRole("button", { name: "Check GTM access" }).click();
    await root.getByRole("button", { name: "Prepare GTM version" }).click();
    await expect(root.getByText("Version fingerprint version-8")).toBeVisible();

    await site.close();
    const resumed = await context.newPage();
    await resumed.goto("http://127.0.0.1:14173/?gtm=GTM-TEST123");
    root = resumed.locator("#gtm-observability-root");
    const openButton = root.getByRole("button", { name: "Open tracking assistant" });
    if (await openButton.count()) await openButton.click();
    await root.getByLabel("Tracking request").fill("navigation");
    await root.getByRole("button", { name: "Send request" }).click();
    await root.getByRole("button", { name: "Track all" }).click();
    await root.getByRole("button", { name: "Check GTM access" }).click();
    await expect(root.getByRole("region", { name: "Setup operation" })).toBeVisible();
    await expect(root.getByText("Version fingerprint version-8")).toBeVisible();
    await expect(root.getByText(/Separate approval is required; nothing was published/)).toBeVisible();
    await expect(root.getByText(/platform-confirmed/i)).toHaveCount(0);
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});

test("resumes a partial setup operation without leaving duplicate operation controls", async () => {
  const profile = await mkdtemp(join(tmpdir(), "gtm-observability-operation-resume-"));
  const extensionPath = resolve("apps/extension/dist");
  const context = await chromium.launchPersistentContext(profile, {
    channel: "chromium",
    headless: true,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  let resumeCount = 0;
  await mockWritableContainerAndWorkflow(context, {
    onResume: () => {
      resumeCount += 1;
    },
    resumeResults: [{
      status: "paused",
      stage: "application",
      reason: "partial_failure",
      operation: operation("applying"),
      details: { completedActionSignatures: ["tag:navigation_click"] },
    }, {
      status: "versioned",
      nextStep: "await_approval",
      operation: operation("versioned"),
    }],
  });
  try {
    const site = await context.newPage();
    await site.goto("http://127.0.0.1:14173/?gtm=GTM-TEST123");
    const root = site.locator("#gtm-observability-root");
    await root.getByRole("button", { name: "Open tracking assistant" }).click();
    await root.getByLabel("Tracking request").fill("navigation");
    await root.getByRole("button", { name: "Send request" }).click();
    await root.getByRole("button", { name: "Track all" }).click();
    await root.getByRole("button", { name: "Check GTM access" }).click();

    await root.getByRole("button", { name: "Prepare GTM version" }).click();
    let operationRegion = root.getByRole("region", { name: "Setup operation" });
    await expect(operationRegion.getByText(/Interrupted after a partial application/).first()).toBeVisible();
    await expect(operationRegion.getByRole("button", { name: "Resume operation" })).toBeVisible();
    expect(resumeCount).toBe(1);

    await operationRegion.getByRole("button", { name: "Resume operation" }).click();
    operationRegion = root.getByRole("region", { name: "Setup operation" });
    await expect(operationRegion.getByText("Version fingerprint version-8")).toBeVisible();
    await expect(root.getByRole("region", { name: "Setup operation" })).toHaveCount(1);
    await expect(operationRegion.getByRole("button", { name: "Resume operation" })).toHaveCount(0);
    await expect(root.getByText(/platform-confirmed/i)).toHaveCount(0);
    expect(resumeCount).toBe(2);
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});

test("renders blocked validation state with bounded guidance and no publish claim", async () => {
  const profile = await mkdtemp(join(tmpdir(), "gtm-observability-operation-blocked-"));
  const extensionPath = resolve("apps/extension/dist");
  const context = await chromium.launchPersistentContext(profile, {
    channel: "chromium",
    headless: true,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  await mockWritableContainerAndWorkflow(context, {
    resumeResults: [{
      status: "blocked",
      stage: "validation",
      reason: "validation_failed",
      operation: operation("validation_failed"),
      details: { errors: ["compiler rejected trigger"] },
    }],
  });
  try {
    const site = await context.newPage();
    await site.goto("http://127.0.0.1:14173/?gtm=GTM-TEST123");
    const root = site.locator("#gtm-observability-root");
    await root.getByRole("button", { name: "Open tracking assistant" }).click();
    await root.getByLabel("Tracking request").fill("navigation");
    await root.getByRole("button", { name: "Send request" }).click();
    await root.getByRole("button", { name: "Track all" }).click();
    await root.getByRole("button", { name: "Check GTM access" }).click();

    await root.getByRole("button", { name: "Prepare GTM version" }).click();
    const operationRegion = root.getByRole("region", { name: "Setup operation" });
    await expect(operationRegion).toBeVisible();
    await expect(operationRegion.getByText(/Workspace validation failed/).first()).toBeVisible();
    await expect(operationRegion.getByText(/Review the validation errors before changing or publishing anything/).first()).toBeVisible();
    await expect(operationRegion.getByText(/Version fingerprint version-8/)).toHaveCount(0);
    await expect(root.getByText(/platform-confirmed/i)).toHaveCount(0);
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});

test("renders stale and conflict resume blocks with bounded guidance", async () => {
  const cases = [
    {
      reason: "stale_workspace",
      expected: /The managed workspace changed since planning/,
    },
    {
      reason: "stale_plan",
      expected: /The GTM entities no longer match the saved plan/,
    },
    {
      reason: "ownership_conflict",
      expected: /An existing GTM entity conflicts with the owned plan/,
    },
    {
      reason: "sync_conflict",
      expected: /The managed workspace has synchronization conflicts/,
    },
    {
      reason: "not_accessible",
      expected: /cannot uniquely access the observed container/,
    },
  ];
  for (const [index, item] of cases.entries()) {
    const profile = await mkdtemp(join(tmpdir(), `gtm-observability-resume-block-${index}-`));
    const extensionPath = resolve("apps/extension/dist");
    const context = await chromium.launchPersistentContext(profile, {
      channel: "chromium",
      headless: true,
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    });
    await mockWritableContainerAndWorkflow(context, {
      resumeResults: [{
        status: "blocked",
        stage: "application",
        reason: item.reason,
        operation: operation("applying"),
      }],
    });
    try {
      const site = await context.newPage();
      await site.goto("http://127.0.0.1:14173/?gtm=GTM-TEST123");
      const root = site.locator("#gtm-observability-root");
      await root.getByRole("button", { name: "Open tracking assistant" }).click();
      await root.getByLabel("Tracking request").fill("navigation");
      await root.getByRole("button", { name: "Send request" }).click();
      await root.getByRole("button", { name: "Track all" }).click();
      await root.getByRole("button", { name: "Check GTM access" }).click();

      await root.getByRole("button", { name: "Prepare GTM version" }).click();
      const operationRegion = root.getByRole("region", { name: "Setup operation" });
      await expect(operationRegion.getByText(item.expected).first()).toBeVisible();
      await expect(operationRegion.getByText(/Version fingerprint version-8/)).toHaveCount(0);
      await expect(root.getByText(/platform-confirmed/i)).toHaveCount(0);
    } finally {
      await context.close();
      await rm(profile, { recursive: true, force: true });
    }
  }
});

test("publishes only from an approved immutable version and keeps verification pending", async () => {
  const profile = await mkdtemp(join(tmpdir(), "gtm-observability-operation-publish-"));
  const extensionPath = resolve("apps/extension/dist");
  const context = await chromium.launchPersistentContext(profile, {
    channel: "chromium",
    headless: true,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  let publishCount = 0;
  await mockWritableContainerAndWorkflow(context, {
    onPublish: () => {
      publishCount += 1;
    },
  });
  try {
    const site = await context.newPage();
    await site.goto("http://127.0.0.1:14173/?gtm=GTM-TEST123");
    const root = site.locator("#gtm-observability-root");
    await root.getByRole("button", { name: "Open tracking assistant" }).click();
    await root.getByLabel("Tracking request").fill("navigation");
    await root.getByRole("button", { name: "Send request" }).click();
    await root.getByRole("button", { name: "Track all" }).click();
    await root.getByRole("button", { name: "Check GTM access" }).click();
    await root.getByRole("button", { name: "Prepare GTM version" }).click();

    let operationRegion = root.getByRole("region", { name: "Setup operation" });
    await expect(operationRegion.getByText("Version fingerprint version-8")).toBeVisible();
    await expect(operationRegion.getByRole("button", { name: "Publish version-8" })).toBeVisible();
    expect(publishCount).toBe(0);

    await operationRegion.getByRole("button", { name: "Publish version-8" }).click();
    operationRegion = root.getByRole("region", { name: "Setup operation" });
    await expect(operationRegion.getByText("Approved fingerprint version-8")).toBeVisible();
    await expect(operationRegion.getByText("Published version version-8")).toBeVisible();
    await expect(operationRegion.getByText("Run browser verification after publication")).toBeVisible();
    await expect(operationRegion.getByText(/Platform confirmation unavailable/)).toBeVisible();
    await expect(operationRegion.getByRole("button", { name: "Publish version-8" })).toHaveCount(0);
    await expect(root.getByText(/platform-confirmed/i)).toHaveCount(0);
    expect(publishCount).toBe(1);
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});

test("records post-publication navigation browser verification without platform confirmation", async () => {
  const profile = await mkdtemp(join(tmpdir(), "gtm-observability-operation-browser-verify-"));
  const extensionPath = resolve("apps/extension/dist");
  const context = await chromium.launchPersistentContext(profile, {
    channel: "chromium",
    headless: true,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  let postedEvidence: Record<string, unknown> | undefined;
  await mockWritableContainerAndWorkflow(context, {
    onBrowserVerification: (body) => {
      postedEvidence = body;
    },
  });
  try {
    const site = await context.newPage();
    await site.goto("http://127.0.0.1:14173/?gtm=GTM-TEST123");
    const root = site.locator("#gtm-observability-root");
    await root.getByRole("button", { name: "Open tracking assistant" }).click();
    await root.getByLabel("Tracking request").fill("navigation");
    await root.getByRole("button", { name: "Send request" }).click();
    await root.getByRole("button", { name: "Track all" }).click();
    await root.getByRole("button", { name: "Check GTM access" }).click();
    await root.getByRole("button", { name: "Prepare GTM version" }).click();

    let operationRegion = root.getByRole("region", { name: "Setup operation" });
    await operationRegion.getByRole("button", { name: "Publish version-8" }).click();
    operationRegion = root.getByRole("region", { name: "Setup operation" });
    await operationRegion.getByRole("button", { name: "Start browser verification" }).click();
    await site.getByRole("link", { name: "Services" }).click();

    await expect.poll(() => postedEvidence?.evidence && typeof postedEvidence.evidence === "object"
      ? (postedEvidence.evidence as Record<string, unknown>).verdict
      : undefined).toMatchObject({
      code: "browser_verified",
      browserVerification: "passed",
      platformConfirmation: "unverified",
    });
    await expect.poll(() => postedEvidence?.evidence && typeof postedEvidence.evidence === "object"
      ? (postedEvidence.evidence as Record<string, unknown>).specificationId
      : undefined).toBe(navigationSpecId);
    await expect(root.getByText(/platform-confirmed/i)).toHaveCount(0);
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});

test("keeps publication failures bounded without advancing verification", async () => {
  const profile = await mkdtemp(join(tmpdir(), "gtm-observability-publication-block-"));
  const extensionPath = resolve("apps/extension/dist");
  const context = await chromium.launchPersistentContext(profile, {
    channel: "chromium",
    headless: true,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  let publishCount = 0;
  await mockWritableContainerAndWorkflow(context, {
    onPublish: () => {
      publishCount += 1;
    },
    publishStatus: 403,
  });
  try {
    const site = await context.newPage();
    await site.goto("http://127.0.0.1:14173/?gtm=GTM-TEST123");
    const root = site.locator("#gtm-observability-root");
    await root.getByRole("button", { name: "Open tracking assistant" }).click();
    await root.getByLabel("Tracking request").fill("navigation");
    await root.getByRole("button", { name: "Send request" }).click();
    await root.getByRole("button", { name: "Track all" }).click();
    await root.getByRole("button", { name: "Check GTM access" }).click();
    await root.getByRole("button", { name: "Prepare GTM version" }).click();

    const operationRegion = root.getByRole("region", { name: "Setup operation" });
    await operationRegion.getByRole("button", { name: "Publish version-8" }).click();
    await expect(root.getByText(/GTM publication is disabled for this backend/)).toBeVisible();
    await expect(operationRegion.getByText(/Published version version-8/)).toHaveCount(0);
    await expect(operationRegion.getByText(/Run browser verification after publication/)).toBeVisible();
    await expect(root.getByText(/platform-confirmed/i)).toHaveCount(0);
    expect(publishCount).toBe(1);
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});

test("renders page-controlled target labels as inert text", async () => {
  const profile = await mkdtemp(join(tmpdir(), "gtm-observability-label-safety-"));
  const extensionPath = resolve("apps/extension/dist");
  const context = await chromium.launchPersistentContext(profile, {
    channel: "chromium",
    headless: true,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  try {
    const site = await context.newPage();
    await site.goto("http://127.0.0.1:14173/");
    await site.locator("header nav a").first().evaluate((anchor) => {
      anchor.textContent = '<img src=x onerror="window.__unsafeHighlightExecuted=true">';
    });
    const root = site.locator("#gtm-observability-root");
    await root.getByRole("button", { name: "Open tracking assistant" }).click();
    await root.getByLabel("Tracking request").fill("navigation");
    await root.getByRole("button", { name: "Send request" }).click();
    await root.getByRole("button", { name: "Choose links" }).click();
    const targets = site.locator("#gtm-observability-targets");
    await expect(targets.locator(".target span").filter({ hasText: "<img src=x" })).toHaveCount(1);
    await expect(targets.locator(".target img")).toHaveCount(0);
    expect(await site.evaluate(() => (window as Window & { __unsafeHighlightExecuted?: boolean }).__unsafeHighlightExecuted)).not.toBe(true);
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});
