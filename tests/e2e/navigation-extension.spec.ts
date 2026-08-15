import { expect, test, chromium, type BrowserContext, type Page, type TestInfo } from "@playwright/test";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

async function extensionId(context: BrowserContext): Promise<string> {
  let [worker] = context.serviceWorkers();
  worker ??= await context.waitForEvent("serviceworker");
  return new URL(worker.url()).host;
}

async function saveFailureScreenshots(testInfo: TestInfo, pages: Page[]): Promise<void> {
  if (testInfo.status === testInfo.expectedStatus) return;
  await Promise.all(
    pages.map(async (page, index) => {
      if (page.isClosed()) return;
      await page.screenshot({ path: testInfo.outputPath(`page-${index}.png`), fullPage: true });
    }),
  );
}

test("discovers, generates, downloads, and verifies navigation tracking", async ({}, testInfo) => {
  const profile = await mkdtemp(join(tmpdir(), "gtm-observability-"));
  const extensionPath = resolve("apps/extension/dist");
  const context = await chromium.launchPersistentContext(profile, {
    channel: "chromium",
    headless: true,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    acceptDownloads: true,
  });
  const pages: Page[] = [];
  let approvedSetup: Record<string, unknown> | undefined;
  let approvedAnalyticsSetup: Record<string, unknown> | undefined;

  try {
    await context.route("http://127.0.0.1:8787/api/google/status", (route) => route.fulfill({
      json: {
        configured: true,
        connected: true,
        trackingSetupWritesEnabled: true,
        analyticsAccountProvisioningEnabled: true,
        analyticsSetupWritesEnabled: true,
      },
    }));
    await context.route("http://127.0.0.1:8787/api/google/accounts", (route) => route.fulfill({
      json: {
        accounts: [{
          accountId: "1",
          name: "Demo account",
          containers: [{ accountId: "1", containerId: "10", publicId: "GTM-TEST123", name: "Demo container" }],
        }],
      },
    }));
    await context.route("http://127.0.0.1:8787/api/google/analytics/destinations", (route) => route.fulfill({
      json: {
        accounts: [{
          account: "accounts/2",
          displayName: "Demo Analytics",
          properties: [{
            property: "properties/20",
            displayName: "Demo property",
            webStreams: [{
              name: "properties/20/dataStreams/200",
              displayName: "Demo web",
              measurementId: "G-DEMO123456",
              defaultUri: "http://127.0.0.1:4173",
            }],
          }],
        }],
      },
    }));
    await context.route("http://127.0.0.1:8787/api/google/analytics/setups", async (route) => {
      approvedAnalyticsSetup = await route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 201,
        json: {
          setup: {
            property: {
              name: "properties/21",
              displayName: "ConsentFlow Verification",
              timeZone: "America/New_York",
              currencyCode: "USD",
            },
            webStream: {
              name: "properties/21/dataStreams/201",
              displayName: "ConsentFlow web",
              measurementId: "G-CONSENT123",
              defaultUri: "https://consentflow-psi.vercel.app/",
            },
          },
        },
      });
    });
    await context.route("http://127.0.0.1:8787/api/google/accounts/1/containers/10/tracking-setups", async (route) => {
      approvedSetup = await route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 201,
        json: { workspace: { name: "GTM Observability - Navigation - test" }, publishStatus: "not-published" },
      });
    });
    const site = await context.newPage();
    pages.push(site);
    await site.goto("http://127.0.0.1:4173/");

    const id = await extensionId(context);
    const worker = context.serviceWorkers()[0]!;
    await worker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ url: "http://127.0.0.1:4173/*" });
      await chrome.scripting.executeScript({ target: { tabId: tab.id! }, files: ["content-script.js"] });
      await chrome.tabs.sendMessage(tab.id!, { type: "TOGGLE_OVERLAY" });
    });
    await expect(site.locator("#gtm-observability-overlay .intent")).toBeVisible();
    await site.locator("#gtm-observability-overlay .go").click();
    await expect(site.locator("#gtm-observability-overlay .panel.open")).toBeVisible();
    await expect(site.locator("[data-gtmo-selected=true]")).toHaveCount(5);
    await expect(site.locator("#gtm-observability-overlay .analytics-destination")).toContainText("Demo web");
    await expect(site.locator("#gtm-observability-overlay .provision")).toBeVisible();
    await expect(site.locator("#gtm-observability-overlay .create-analytics")).toBeVisible();
    await site.locator("#gtm-observability-overlay .create-analytics").click();
    await expect(site.locator("#gtm-observability-overlay .measurement")).toHaveValue("G-CONSENT123");
    expect(approvedAnalyticsSetup).toMatchObject({
      approval: "create-analytics-property-and-web-stream",
      account: "accounts/2",
      propertyDisplayName: "ConsentFlow Verification",
      streamDisplayName: "ConsentFlow web",
    });
    await site.locator("#gtm-observability-overlay .measurement").fill("G-REMEMBER123");
    await site.locator("#gtm-observability-overlay .measurement").press("Tab");
    await worker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ url: "http://127.0.0.1:4173/*" });
      await chrome.tabs.sendMessage(tab.id!, { type: "TOGGLE_OVERLAY" });
    });
    await worker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ url: "http://127.0.0.1:4173/*" });
      await chrome.tabs.sendMessage(tab.id!, { type: "TOGGLE_OVERLAY" });
    });
    await expect(site.locator("#gtm-observability-overlay .measurement")).toHaveValue("G-REMEMBER123");
    await worker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ url: "http://127.0.0.1:4173/*" });
      await chrome.tabs.sendMessage(tab.id!, { type: "TOGGLE_OVERLAY" });
    });

    const panel = await context.newPage();
    pages.push(panel);
    await panel.goto(`chrome-extension://${id}/sidepanel.html`);
    await expect(panel.getByLabel("Destination container")).toContainText("Demo container");

    await panel.getByRole("button", { name: "Discover navigation" }).click();
    await expect(panel.locator("#navigation-list .navigation-item")).toHaveCount(5);
    await expect(panel.locator("#status")).toContainText("Found 5 candidate");

    await panel.getByLabel("GA4 measurement ID").fill("G-TEST123456");
    await panel.getByLabel("GTM container ID").fill("GTM-TEST123");
    await panel.getByRole("button", { name: "Generate GTM file" }).click();
    await expect(panel.getByRole("heading", { name: "Preflight passed" })).toBeVisible();
    await expect(panel.locator("#preflight-list li")).toHaveCount(4);

    await panel.getByRole("button", { name: "Create in GTM" }).click();
    await expect(panel.locator("#creation-result")).toContainText("Created in unpublished workspace");
    expect(approvedSetup).toMatchObject({
      approval: "create-isolated-tracking-setup",
      measurementId: "G-TEST123456",
    });

    const downloadPromise = panel.waitForEvent("download");
    await panel.getByRole("button", { name: "Download container JSON" }).click();
    const download = await downloadPromise;
    const downloadPath = await download.path();
    expect(downloadPath).not.toBeNull();
    const file = JSON.parse(await readFile(downloadPath!, "utf8")) as {
      exportFormatVersion: number;
      containerVersion: { tag: unknown[]; trigger: unknown[]; builtInVariable: unknown[] };
    };
    expect(file.exportFormatVersion).toBe(2);
    expect(file.containerVersion.tag).toHaveLength(1);
    expect(file.containerVersion.trigger).toHaveLength(1);
    expect(file.containerVersion.builtInVariable).toHaveLength(2);

    await panel.getByRole("button", { name: "I imported it — start verification" }).click();
    await expect(panel.getByRole("heading", { name: "Guided verification" })).toBeVisible();

    await site.bringToFront();
    await site.getByRole("link", { name: "Services" }).click({ noWaitAfter: true });

    const servicesResult = panel
      .locator("#verification-list .navigation-item")
      .filter({ hasText: "Services" });
    await expect(servicesResult.locator(".area")).toHaveText("passed");
    await expect(servicesResult).toContainText("Observed 1 matching GA4 request");
    await expect(panel.locator(".boundary")).toContainText("Not independently confirmed");

  } catch (error) {
    await saveFailureScreenshots(testInfo, pages);
    throw error;
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});
