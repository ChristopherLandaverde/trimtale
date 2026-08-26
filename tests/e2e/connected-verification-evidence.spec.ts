import { resolve } from "node:path";
import type { BrowserContext, Locator } from "@playwright/test";
import { expect, test } from "./helpers/extension-test.js";

const visualSurfaceWidth = 382;

async function stabilizeSurface(surface: Locator): Promise<void> {
  await surface.evaluate((element, width) => {
    const target = element as HTMLElement;
    target.style.boxSizing = "border-box";
    target.style.width = `${width}px`;
  }, visualSurfaceWidth);
  await expect(surface).toHaveCSS("width", `${visualSurfaceWidth}px`);
}

async function routeEnhanced(context: BrowserContext): Promise<void> {
  await context.route("http://127.0.0.1:8787/api/google/analytics/enhanced-measurement?*", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      measurementId: "G-EXACT123",
      property: { propertyId: "550074997", name: "ConsentFlow Verification" },
      stream: { streamId: "15443100029", name: "ConsentFlow web" },
      settings: {
        stream: true,
        pageViews: true,
        scrolls: true,
        outboundClicks: true,
        siteSearch: true,
        videoEngagement: true,
        fileDownloads: true,
        formInteractions: true,
      },
    }),
  }));
}

test("carries exact GTM context through generation, browser evidence, and GA4 confirmation", async ({ context, page }) => {
  let analyticsStarts = 0;
  let analyticsConfirms = 0;
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
  await routeEnhanced(context);
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

  await page.goto("http://127.0.0.1:4173/?formScenario=ajax_success&gtm=GTM-TEST123");
  await page.locator('meta[name="gtm-observability-measurement-id"], meta[name="gtm-observability-container-id"]').evaluateAll(
    (elements) => elements.forEach((element) => element.remove()),
  );
  const root = page.locator("#gtm-observability-root");
  await root.getByRole("button", { name: "Open tracking agent" }).click();
  await expect(root.getByRole("region", { name: "GTM connection" }).getByText("G-EXACT123", { exact: true }))
    .toBeVisible();
  await expect(root.getByText("7 of 7 automatic features on", { exact: true })).toBeVisible();

  await root.getByLabel("Tracking request").fill("Track leads from the contact form");
  await root.getByRole("button", { name: "Send request" }).click();
  const task = root.getByRole("region", { name: "Agent task" });
  await expect(task.getByText("Needs custom setup · Confirmed lead tracking", { exact: true })).toBeVisible();
  await expect(task.getByText(/GA4 measures form starts and submits, not confirmed leads/i)).toBeVisible();
  await root.getByRole("button", { name: "Contact sales" }).click();
  await root.getByRole("button", { name: "Review setup" }).click();
  await root.getByRole("button", { name: "Approve setup" }).click();
  await expect(root.getByRole("region", { name: "Tracking evidence path" })).toHaveCount(0);
  await expect(task.getByText(/Setup approved and generated/i)).toBeVisible();
  await expect(root.getByRole("region", { name: "GTM connection" })).toContainText("Agency");
  await expect(root.getByRole("region", { name: "GTM connection" })).toContainText("Lead site");

  await root.getByRole("button", { name: "Verify already-installed setup" }).click();
  await expect(task.getByText(/watching for one successful browser run/i)).toBeVisible();
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

  const result = task.locator(".agent-verification-result");
  await expect(result.locator(".agent-specification-row")
    .filter({ hasText: "Browser verification" }).getByText("passed", { exact: true })).toBeVisible();
  await expect(result.locator(".agent-specification-row")
    .filter({ hasText: "Platform confirmation" }).getByText("passed", { exact: true })).toBeVisible();
  await expect(result.getByText(/aggregate count increase against the pre-run baseline/i)).toBeVisible();
  await expect(result.getByText(/no user or event-level identity is claimed/i)).toBeVisible();
  expect(analyticsConfirms).toBe(1);
  await expect(root.getByText("private@example.test", { exact: true })).toHaveCount(0);
  await task.evaluate((element) => element.scrollIntoView({ block: "start" }));
  const messageWidths = await root.locator(".messages").evaluate((element) => ({
    client: element.clientWidth,
    scroll: element.scrollWidth,
  }));
  expect(messageWidths.scroll).toBe(messageWidths.client);
  const assistant = root.locator("section.assistant");
  await stabilizeSurface(assistant);
  await expect(assistant).toHaveScreenshot("connected-verification-result.png", {
    animations: "disabled",
    stylePath: resolve("tests/e2e/visual-stability.css"),
  });
});

test("keeps browser verification usable when the Analytics provider denies the read", async ({ context, page }) => {
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
  await routeEnhanced(context);
  await context.route("http://127.0.0.1:8787/api/google/analytics/verifications/start", (route) => route.fulfill({
    status: 502,
    contentType: "application/json",
    body: JSON.stringify({
      code: "provider_forbidden",
      error: "privateSentinel: raw provider detail must not render",
    }),
  }));

  await page.goto("http://127.0.0.1:4173/?formScenario=ajax_success&gtm=GTM-TEST123");
  await page.locator('meta[name="gtm-observability-measurement-id"], meta[name="gtm-observability-container-id"]').evaluateAll(
    (elements) => elements.forEach((element) => element.remove()),
  );
  const root = page.locator("#gtm-observability-root");
  await root.getByRole("button", { name: "Open tracking agent" }).click();
  await root.getByLabel("Tracking request").fill("Track leads from the contact form");
  await root.getByRole("button", { name: "Send request" }).click();
  await root.getByRole("button", { name: "Contact sales" }).click();
  await root.getByRole("button", { name: "Review setup" }).click();
  await root.getByRole("button", { name: "Approve setup" }).click();
  await root.getByRole("button", { name: "Verify already-installed setup" }).click();

  await expect(root.getByRole("region", { name: "Tracking evidence path" })).toHaveCount(0);
  await expect(root.getByText(/privateSentinel: raw provider detail/)).toHaveCount(0);
  await expect(root.locator("img, script")).toHaveCount(0);

  await page.locator("form#contact input[name='email']").fill("private@example.test");
  await page.locator("form#contact button[type='submit']").click();
  const task = root.getByRole("region", { name: "Agent task" });
  await expect(task.getByText(/The Analytics Data API is unavailable or the saved grant cannot read it/).first())
    .toBeVisible();
  const result = task.locator(".agent-verification-result");
  await expect(result.locator(".agent-specification-row")
    .filter({ hasText: "Browser verification" }).getByText("passed", { exact: true })).toBeVisible();
  await expect(result.locator(".agent-specification-row")
    .filter({ hasText: "Platform confirmation" }).getByText("unavailable", { exact: true })).toBeVisible();
  await expect(task.getByRole("button", { name: "Try verification again" })).toBeVisible();
  await expect(root.getByText("private@example.test", { exact: true })).toHaveCount(0);
});
