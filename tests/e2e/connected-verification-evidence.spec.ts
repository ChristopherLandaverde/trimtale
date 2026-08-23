import { chromium, expect, test } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

test("carries exact GTM context through generation, browser evidence, and GA4 confirmation", async () => {
  const profile = await mkdtemp(join(tmpdir(), "gtm-connected-evidence-"));
  const extensionPath = resolve("apps/extension/dist");
  const context = await chromium.launchPersistentContext(profile, {
    channel: "chromium",
    headless: true,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  let analyticsStarts = 0;
  let analyticsConfirms = 0;
  try {
    await context.route("http://127.0.0.1:8787/api/google/status", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        configured: true,
        connected: true,
        scope: "read-only",
        containerWritesEnabled: false,
        publicationScopeRequested: false,
        publicationEnabled: false,
        tokenPersistenceEnabled: true,
        analyticsReadEnabled: true,
      }),
    }));
    await context.route("http://127.0.0.1:8787/api/google/containers/recognize?*", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        containerWritesEnabled: false,
        result: {
          status: "recognized",
          publicId: "GTM-TEST123",
          account: { accountId: "1", name: "Agency" },
          container: {
            accountId: "1",
            containerId: "10",
            name: "Lead site",
            publicId: "GTM-TEST123",
          },
          measurementIds: ["G-EXACT123"],
          workspace: { status: "available", action: "create", workspaceCount: 1, remainingSlots: 2 },
        },
      }),
    }));
    await context.route("http://127.0.0.1:8787/api/google/analytics/verifications/start", async (route) => {
      analyticsStarts += 1;
      expect(route.request().postDataJSON()).toEqual({ measurementId: "G-EXACT123", eventName: "generate_lead" });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "started",
          verificationId: "verification-123",
          measurementId: "G-EXACT123",
          eventName: "generate_lead",
          baselineEventCount: 4,
          startedAt: "2026-08-23T18:00:00.000Z",
          expiresAt: "2026-08-23T18:10:00.000Z",
          property: { propertyId: "550074997", name: "ConsentFlow Verification" },
          stream: { streamId: "15443100029", name: "ConsentFlow web" },
        }),
      });
    });
    await context.route("http://127.0.0.1:8787/api/google/analytics/verifications/confirm", async (route) => {
      analyticsConfirms += 1;
      expect(route.request().postDataJSON()).toEqual({ verificationId: "verification-123" });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "confirmed",
          verificationId: "verification-123",
          measurementId: "G-EXACT123",
          eventName: "generate_lead",
          baselineEventCount: 4,
          currentEventCount: 5,
          startedAt: "2026-08-23T18:00:00.000Z",
          checkedAt: "2026-08-23T18:01:00.000Z",
          property: { propertyId: "550074997", name: "ConsentFlow Verification" },
          stream: { streamId: "15443100029", name: "ConsentFlow web" },
          correlation: "aggregate_realtime_count_increase",
        }),
      });
    });

    const page = await context.newPage();
    await page.goto("http://127.0.0.1:4173/?formScenario=ajax_success&gtm=GTM-TEST123");
    await page.locator('meta[name="gtm-observability-measurement-id"], meta[name="gtm-observability-container-id"]').evaluateAll(
      (elements) => elements.forEach((element) => element.remove()),
    );
    const root = page.locator("#gtm-observability-root");
    await root.getByRole("button", { name: "Open tracking assistant" }).click();
    await expect(root.getByRole("region", { name: "GTM connection" }).getByText("G-EXACT123", { exact: true }))
      .toBeVisible();

    await root.getByLabel("Tracking request").fill("Track leads from the contact form");
    await root.getByRole("button", { name: "Send request" }).click();
    await root.getByRole("button", { name: "Contact sales" }).click();
    await root.getByRole("button", { name: "Review setup" }).click();
    await root.getByRole("button", { name: "Confirm setup" }).click();
    const evidence = root.getByRole("region", { name: "Tracking evidence path" });
    await expect(evidence.getByText("Reviewable generate_lead setup generated", { exact: true })).toBeVisible();
    await expect(evidence.getByText(/Agency.*Lead site.*G-EXACT123/)).toBeVisible();

    await root.getByRole("button", { name: "Start verification" }).click();
    await expect(evidence.getByText(/Waiting for one successful browser run/)).toBeVisible();
    expect(analyticsStarts).toBe(1);
    await page.evaluate(() => {
      const sendBeacon = navigator.sendBeacon.bind(navigator);
      navigator.sendBeacon = (url, data) => {
        if (String(url).includes("en=generate_lead")) {
          window.setTimeout(() => sendBeacon(url, data), 1_800);
          return true;
        }
        return sendBeacon(url, data);
      };
      document.querySelector("form#contact")?.addEventListener("submit", () => {
        window.setTimeout(() => {
          delete document.documentElement.dataset.submissionResult;
          delete document.documentElement.dataset.tagFired;
        });
      });
    });
    await page.locator("form#contact input[name='email']").fill("private@example.test");
    await page.locator("form#contact button[type='submit']").click();

    await expect(evidence.getByText(/Browser request verified/)).toBeVisible();
    await expect(evidence.getByText(/GA4 Realtime count increased from 4 to 5/)).toBeVisible();
    await expect(evidence.getByText(/Aggregate correlation; no user or event-level identity/)).toBeVisible();
    await expect(root.getByText("Platform confirmation: passed", { exact: false }).first()).toBeVisible();
    expect(analyticsConfirms).toBe(1);
    await expect(root.getByText("private@example.test", { exact: true })).toHaveCount(0);
    await evidence.evaluate((element) => element.scrollIntoView({ block: "start" }));
    const messageWidths = await root.locator(".messages").evaluate((element) => ({
      client: element.clientWidth,
      scroll: element.scrollWidth,
    }));
    expect(messageWidths.scroll).toBe(messageWidths.client);
    await expect(root.locator("section.assistant")).toHaveScreenshot("connected-verification-evidence.png", {
      animations: "disabled",
      stylePath: resolve("tests/e2e/visual-stability.css"),
    });
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});

test("keeps browser verification usable when the Analytics provider denies the read", async () => {
  const profile = await mkdtemp(join(tmpdir(), "gtm-provider-denied-"));
  const extensionPath = resolve("apps/extension/dist");
  const context = await chromium.launchPersistentContext(profile, {
    channel: "chromium",
    headless: true,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  try {
    await context.route("http://127.0.0.1:8787/api/google/status", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        configured: true,
        connected: true,
        scope: "read-only",
        containerWritesEnabled: false,
        publicationScopeRequested: false,
        publicationEnabled: false,
        tokenPersistenceEnabled: true,
        analyticsReadEnabled: true,
      }),
    }));
    await context.route("http://127.0.0.1:8787/api/google/containers/recognize?*", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        containerWritesEnabled: false,
        result: {
          status: "recognized",
          publicId: "GTM-TEST123",
          account: { accountId: "1", name: "Agency <img src=x onerror=privateSentinel>" },
          container: {
            accountId: "1",
            containerId: "10",
            name: "Lead site <script>privateSentinel</script>",
            publicId: "GTM-TEST123",
          },
          measurementIds: ["G-EXACT123"],
          workspace: { status: "available", action: "create", workspaceCount: 1, remainingSlots: 2 },
        },
      }),
    }));
    await context.route("http://127.0.0.1:8787/api/google/analytics/verifications/start", (route) => route.fulfill({
      status: 502,
      contentType: "application/json",
      body: JSON.stringify({
        code: "provider_forbidden",
        error: "privateSentinel: raw provider detail must not render",
      }),
    }));

    const page = await context.newPage();
    await page.goto("http://127.0.0.1:4173/?formScenario=ajax_success&gtm=GTM-TEST123");
    await page.locator('meta[name="gtm-observability-measurement-id"], meta[name="gtm-observability-container-id"]').evaluateAll(
      (elements) => elements.forEach((element) => element.remove()),
    );
    const root = page.locator("#gtm-observability-root");
    await root.getByRole("button", { name: "Open tracking assistant" }).click();
    await root.getByLabel("Tracking request").fill("Track leads from the contact form");
    await root.getByRole("button", { name: "Send request" }).click();
    await root.getByRole("button", { name: "Contact sales" }).click();
    await root.getByRole("button", { name: "Review setup" }).click();
    await root.getByRole("button", { name: "Confirm setup" }).click();
    await root.getByRole("button", { name: "Start verification" }).click();

    const evidence = root.getByRole("region", { name: "Tracking evidence path" });
    await expect(evidence.getByText("The Analytics Data API is unavailable or the saved grant cannot read it", { exact: true }))
      .toBeVisible();
    await expect(root.getByText(/privateSentinel: raw provider detail/)).toHaveCount(0);
    await expect(root.locator("img, script")).toHaveCount(0);

    await page.locator("form#contact input[name='email']").fill("private@example.test");
    await page.locator("form#contact button[type='submit']").click();
    await expect(evidence.getByText(/Browser request verified/)).toBeVisible();
    await expect(evidence.getByText("The Analytics Data API is unavailable or the saved grant cannot read it", { exact: true }))
      .toBeVisible();
    await expect(root.getByText("private@example.test", { exact: true })).toHaveCount(0);
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});
