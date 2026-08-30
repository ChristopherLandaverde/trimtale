import { chromium, expect, test, type BrowserContext, type Page } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const screenshotOptions = {
  animations: "disabled" as const,
  maxDiffPixels: 50,
  stylePath: resolve("tests/e2e/visual-stability.css"),
};

const connectedReadOnlyStatus = {
  configured: true,
  connected: true,
  scope: "read-only",
  containerWritesEnabled: false,
  publicationScopeRequested: false,
  publicationEnabled: false,
  tokenPersistenceEnabled: true,
};

async function withExtension(
  name: string,
  run: (context: BrowserContext, page: Page) => Promise<void>,
): Promise<void> {
  const profile = await mkdtemp(join(tmpdir(), `gtm-context-${name}-`));
  const extensionPath = resolve("apps/extension/dist");
  const context = await chromium.launchPersistentContext(profile, {
    channel: "chromium",
    headless: true,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  try {
    await run(context, await context.newPage());
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
}

test("shows authenticated account, container, and read-only access before chat", async () => {
  await withExtension("matched", async (context, page) => {
    let statusRequests = 0;
    let recognitionRequests = 0;
    await context.route("http://127.0.0.1:18787/api/google/status", async (route) => {
      statusRequests += 1;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(connectedReadOnlyStatus) });
    });
    await context.route("http://127.0.0.1:18787/api/google/containers/recognize?*", async (route) => {
      recognitionRequests += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          containerWritesEnabled: false,
          result: {
            status: "recognized",
            publicId: "GTM-TEST123",
            account: { accountId: "1", name: "Agency" },
            container: { accountId: "1", containerId: "10", name: "Lead site", publicId: "GTM-TEST123" },
            workspace: { status: "available", action: "create", workspaceCount: 1, remainingSlots: 2 },
          },
        }),
      });
    });

    await page.goto("http://127.0.0.1:14173/?gtm=GTM-TEST123");
    const root = page.locator("#gtm-observability-root");
    await expect(root).toBeAttached();
    await page.waitForTimeout(150);
    expect(statusRequests).toBe(0);
    expect(recognitionRequests).toBe(0);

    await root.getByRole("button", { name: "Open tracking assistant" }).click();
    const card = root.getByRole("region", { name: "GTM connection" });
    await expect(card.getByText("Read-only", { exact: true })).toBeVisible();
    await expect(card.getByText("GTM-TEST123", { exact: true })).toBeVisible();
    await expect(card.getByText("Agency", { exact: true })).toBeVisible();
    await expect(card.getByText("Lead site", { exact: true })).toBeVisible();
    await expect(card.getByText(/GTM API authorization connected/i)).toBeVisible();
    await expect(root.getByLabel("Tracking request")).toBeFocused();
    expect(statusRequests).toBe(1);
    expect(recognitionRequests).toBe(1);
    await card.getByRole("button", { name: "Refresh GTM connection" }).click();
    await expect.poll(() => statusRequests).toBe(2);
    await expect.poll(() => recognitionRequests).toBe(2);
    await expect(card.getByText("Lead site", { exact: true })).toBeVisible();
    await expect(root.locator("section.assistant")).toHaveScreenshot("gtm-context-matched.png", screenshotOptions);
  });
});

test("shows a local-service diagnostic without disabling chat", async () => {
  await withExtension("offline", async (context, page) => {
    await context.route("http://127.0.0.1:18787/api/google/status", (route) => route.abort("connectionrefused"));
    await page.goto("http://127.0.0.1:14173/?gtm=GTM-TEST123");
    const root = page.locator("#gtm-observability-root");
    await root.getByRole("button", { name: "Open tracking assistant" }).click();
    const card = root.getByRole("region", { name: "GTM connection" });
    await expect(card.getByText("Service offline", { exact: true })).toBeVisible();
    await expect(card.getByText(/local GTM service is offline/i)).toBeVisible();
    await expect(root.getByLabel("Tracking request")).toBeEnabled();
    await expect(root.locator("section.assistant")).toHaveScreenshot("gtm-context-offline.png", screenshotOptions);
  });
});

test("distinguishes unconfigured and disconnected Google authorization", async () => {
  for (const scenario of [
    { name: "unconfigured", status: { ...connectedReadOnlyStatus, configured: false, connected: false }, copy: "Google OAuth is not configured" },
    { name: "disconnected", status: { ...connectedReadOnlyStatus, connected: false }, copy: "Google authorization required" },
  ]) {
    await withExtension(scenario.name, async (context, page) => {
      let recognitionRequests = 0;
      await context.route("http://127.0.0.1:18787/api/google/status", (route) => route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(scenario.status),
      }));
      await context.route("http://127.0.0.1:18787/api/google/containers/recognize?*", async (route) => {
        recognitionRequests += 1;
        await route.abort();
      });
      await page.goto("http://127.0.0.1:14173/?gtm=GTM-TEST123");
      const root = page.locator("#gtm-observability-root");
      await root.getByRole("button", { name: "Open tracking assistant" }).click();
      await expect(root.getByRole("region", { name: "GTM connection" }).getByText(scenario.copy, { exact: true })).toBeVisible();
      expect(recognitionRequests).toBe(0);
    });
  }
});

test("shows connected access even when the page has no GTM container", async () => {
  await withExtension("no-page-container", async (context, page) => {
    let recognitionRequests = 0;
    await context.route("http://127.0.0.1:18787/api/google/status", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(connectedReadOnlyStatus),
    }));
    await context.route("http://127.0.0.1:18787/api/google/containers/recognize?*", async (route) => {
      recognitionRequests += 1;
      await route.abort();
    });
    await page.goto("http://127.0.0.1:14173/");
    const root = page.locator("#gtm-observability-root");
    await root.getByRole("button", { name: "Open tracking assistant" }).click();
    const card = root.getByRole("region", { name: "GTM connection" });
    await expect(card.getByText("Read-only", { exact: true })).toBeVisible();
    await expect(card.getByText("No GTM container detected on this page", { exact: true })).toBeVisible();
    expect(recognitionRequests).toBe(0);
  });
});

test("fails closed for inaccessible, ambiguous, and multiple page containers", async () => {
  for (const scenario of [
    { name: "inaccessible", result: { status: "not_accessible", publicId: "GTM-TEST123" }, copy: "Not accessible" },
    { name: "ambiguous", result: { status: "ambiguous", publicId: "GTM-TEST123", matchCount: 2 }, copy: "Ambiguous match" },
  ]) {
    await withExtension(scenario.name, async (context, page) => {
      await context.route("http://127.0.0.1:18787/api/google/status", (route) => route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(connectedReadOnlyStatus),
      }));
      await context.route("http://127.0.0.1:18787/api/google/containers/recognize?*", (route) => route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ containerWritesEnabled: false, result: scenario.result }),
      }));
      await page.goto("http://127.0.0.1:14173/?gtm=GTM-TEST123");
      const root = page.locator("#gtm-observability-root");
      await root.getByRole("button", { name: "Open tracking assistant" }).click();
      await expect(root.getByRole("region", { name: "GTM connection" }).getByText(scenario.copy, { exact: true })).toBeVisible();
    });
  }

  await withExtension("multiple", async (context, page) => {
    let recognitionRequests = 0;
    await context.route("http://127.0.0.1:18787/api/google/status", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(connectedReadOnlyStatus),
    }));
    await context.route("http://127.0.0.1:18787/api/google/containers/recognize?*", async (route) => {
      recognitionRequests += 1;
      await route.abort();
    });
    await page.goto("http://127.0.0.1:14173/?gtm=GTM-ONE123");
    await page.evaluate(() => {
      const second = document.createElement("script");
      second.src = "https://www.googletagmanager.com/gtm.js?id=GTM-TWO456";
      document.head.append(second);
    });
    const root = page.locator("#gtm-observability-root");
    await root.getByRole("button", { name: "Open tracking assistant" }).click();
    const card = root.getByRole("region", { name: "GTM connection" });
    await expect(card.getByText("Multiple page containers", { exact: true })).toBeVisible();
    await expect(card.getByText(/GTM-ONE123.*GTM-TWO456/)).toBeVisible();
    expect(recognitionRequests).toBe(0);
  });
});
