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

  try {
    const site = await context.newPage();
    pages.push(site);
    await site.goto("http://127.0.0.1:14173/");

    const id = await extensionId(context);
    const workbenchPromise = context.waitForEvent("page");
    await context.serviceWorkers()[0]!.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ url: "http://127.0.0.1:14173/*" });
      if (!tab?.id) throw new Error("Fixture tab not found.");
      await chrome.tabs.create({ url: chrome.runtime.getURL(`workbench.html?tabId=${tab.id}`) });
    });
    const panel = await workbenchPromise;
    pages.push(panel);
    await panel.waitForLoadState("domcontentloaded");
    const workbenchUrl = new URL(panel.url());
    expect(workbenchUrl.protocol).toBe("chrome-extension:");
    expect(workbenchUrl.host).toBe(id);
    expect(workbenchUrl.pathname).toBe("/workbench.html");
    expect(Number.parseInt(workbenchUrl.searchParams.get("tabId") ?? "", 10)).toBeGreaterThan(0);

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

    await panel.getByRole("button", { name: "GTM Preview is connected — start verification" }).click();
    await expect(panel.getByRole("heading", { name: "Guided verification" })).toBeVisible();

    await site.bringToFront();
    await site.getByRole("link", { name: "Services" }).click({ noWaitAfter: true });

    const servicesResult = panel
      .locator("#verification-list .navigation-item")
      .filter({ hasText: "Services" });
    await expect(servicesResult.locator(".area")).toHaveText("passed");
    await expect(servicesResult).toContainText("Observed 1 matching GA4 request");
    await expect(panel.locator("#summary-passed")).toHaveText("1");
    await expect(panel.locator("#summary-pending")).toHaveText("4");
    await expect(panel.locator(".boundary")).toContainText("Not independently confirmed");

    const reportPromise = panel.waitForEvent("download");
    await panel.getByRole("button", { name: "Download evidence report" }).click();
    const report = await reportPromise;
    const reportPath = await report.path();
    expect(reportPath).not.toBeNull();
    const evidenceReport = JSON.parse(await readFile(reportPath!, "utf8")) as {
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
