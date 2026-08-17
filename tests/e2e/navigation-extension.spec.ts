import { expect, test, chromium, type BrowserContext, type Page, type TestInfo } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
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

  try {
    const site = await context.newPage();
    pages.push(site);
    await site.goto("http://127.0.0.1:14173/");

    await extensionId(context);
    await context.serviceWorkers()[0]!.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ url: "http://127.0.0.1:14173/*" });
      if (!tab?.id) throw new Error("Fixture tab not found.");
      try {
        await chrome.tabs.sendMessage(tab.id, { type: "GET_EVIDENCE" });
      } catch {
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content-script.js"] });
      }
      await chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_WORKBENCH", tabId: tab.id });
    });
    await expect(site.locator("#gtm-observability-workbench-host")).toBeAttached();
    await expect.poll(() => site.frames().some((frame) => frame.url().includes("workbench.html"))).toBe(true);
    let panel = site.frames().find((frame) => frame.url().includes("workbench.html"));
    if (!panel) throw new Error("Workbench frame not found.");

    await panel.getByRole("button", { name: "Discover navigation" }).click();
    await expect(panel.locator("#navigation-list .navigation-item")).toHaveCount(5);
    await expect(panel.locator("#status")).toContainText("Found 5 candidate");

    await panel.getByLabel("GA4 measurement ID").fill("G-TEST123456");
    await panel.getByLabel("GTM container ID").fill("GTM-TEST123");
    await panel.getByRole("button", { name: "Generate GTM file" }).click();
    await expect(panel.getByRole("heading", { name: "Preflight passed" })).toBeVisible();
    await expect
      .poll(async () => panel.evaluate(() => chrome.storage.local.get("siteConfig:127.0.0.1")))
      .toEqual({
        "siteConfig:127.0.0.1": {
          measurementId: "G-TEST123456",
          containerId: "GTM-TEST123",
        },
      });
    await expect(panel.locator("#preflight-list li")).toHaveCount(4);
    await expect(panel.getByRole("heading", { name: "GTM import and Preview" })).toBeVisible();
    await expect(panel.locator("#import-card")).toContainText("Merge");
    await expect(panel.locator("#import-card")).toContainText("Do not select Overwrite");

    await panel.getByRole("button", { name: "Download container JSON" }).click();
    const containerPayload = await panel.evaluate(() => (
      window as Window & { __gtmObservabilityLastDownload?: { filename: string; content: string } }
    ).__gtmObservabilityLastDownload);
    expect(containerPayload?.filename).toBe("gtm-navigation-127.0.0.1.json");
    const file = JSON.parse(containerPayload!.content) as {
      exportFormatVersion: number;
      containerVersion: { tag: unknown[]; trigger: unknown[]; builtInVariable: unknown[] };
    };
    expect(file.exportFormatVersion).toBe(2);
    expect(file.containerVersion.tag).toHaveLength(1);
    expect(file.containerVersion.trigger).toHaveLength(1);
    expect(file.containerVersion.builtInVariable).toHaveLength(2);

    await panel.evaluate(() => {
      document.getElementById("verify")?.click();
    });
    await expect
      .poll(async () => panel.locator("#verification-card").evaluate((element) => !element.classList.contains("hidden")))
      .toBe(true);
    await expect(site.locator("#gtm-observability-workbench-host")).toBeHidden();

    await site.bringToFront();
    await site.getByRole("link", { name: "Services" }).click({ noWaitAfter: true });
    await expect(site).toHaveURL("http://127.0.0.1:14173/services");

    await context.serviceWorkers()[0]!.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ url: "http://127.0.0.1:14173/*" });
      if (!tab?.id) throw new Error("Fixture tab not found.");
      try {
        await chrome.tabs.sendMessage(tab.id, { type: "GET_EVIDENCE" });
      } catch {
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content-script.js"] });
      }
      await chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_WORKBENCH", tabId: tab.id });
    });
    await expect(site.locator("#gtm-observability-workbench-host")).toBeVisible();
    await expect.poll(() => site.frames().some((frame) => frame.url().includes("workbench.html"))).toBe(true);
    panel = site.frames().find((frame) => frame.url().includes("workbench.html"));
    if (!panel) throw new Error("Restored workbench frame not found.");

    const servicesResult = panel
      .locator("#verification-list .navigation-item")
      .filter({ hasText: "Services" });
    await expect(servicesResult.locator(".area")).toHaveText("passed");
    await expect(servicesResult).toContainText("Observed 1 matching GA4 request");
    await expect(panel.locator("#summary-passed")).toHaveText("1");
    await expect(panel.locator("#summary-pending")).toHaveText("4");
    await expect(panel.locator(".boundary")).toContainText("Not independently confirmed");

    await panel.getByRole("button", { name: "Download evidence report" }).click();
    const reportPayload = await panel.evaluate(() => (
      window as Window & { __gtmObservabilityLastDownload?: { filename: string; content: string } }
    ).__gtmObservabilityLastDownload);
    expect(reportPayload?.filename).toBe("gtm-verification-127.0.0.1.json");
    const evidenceReport = JSON.parse(reportPayload!.content) as {
      reportType: string;
      summary: { passed: number; incomplete: number };
      platformConfirmation: string;
    };
    expect(evidenceReport.reportType).toBe("gtm-observability-browser-verification");
    expect(evidenceReport.summary.passed).toBe(1);
    expect(evidenceReport.summary.incomplete).toBe(4);
    expect(evidenceReport.platformConfirmation).toBe("unverified");

  } catch (error) {
    await saveFailureScreenshots(testInfo, pages);
    throw error;
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});
