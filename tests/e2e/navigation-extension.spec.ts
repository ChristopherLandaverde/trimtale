import { expect, test, chromium, type BrowserContext } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const screenshotOptions = {
  animations: "disabled" as const,
  stylePath: resolve("tests/e2e/visual-stability.css"),
};

function operation(status: "planned" | "versioned" = "versioned") {
  return {
    schemaVersion: 1,
    id: "operation_spec_navigation_test",
    status,
    createdAt: "2026-08-30T20:00:00.000Z",
    updatedAt: "2026-08-30T20:01:00.000Z",
    specification: {
      schemaVersion: 1,
      id: "spec_navigation_test",
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
      }],
    },
    completedActionSignatures: status === "versioned" ? ["tag:navigation_click"] : [],
    ...(status === "versioned" ? {
      validation: {
        status: "passed",
        checkedAt: "2026-08-30T20:01:00.000Z",
        workspaceFingerprint: "workspace-final",
        errors: [],
      },
      version: {
        path: "accounts/1/containers/10/versions/8",
        fingerprint: "version-8",
        priorLiveVersionPath: "accounts/1/containers/10/versions/7",
        priorLiveVersionFingerprint: "live-7",
      },
    } : {}),
  };
}

async function mockWritableContainerAndWorkflow(context: BrowserContext) {
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
  await context.route("http://127.0.0.1:18787/api/google/workflows/*/resume", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        result: { status: "versioned", nextStep: "await_approval", operation: operation("versioned") },
      }),
    });
  });
  await context.route(/http:\/\/127\.0\.0\.1:18787\/api\/google\/workflows\/operation_spec_navigation_test$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ operation: operation("versioned") }),
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
