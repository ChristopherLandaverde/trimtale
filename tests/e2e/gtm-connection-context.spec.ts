import { resolve } from "node:path";
import { expect, test } from "./helpers/extension-test.js";

const screenshotOptions = {
  animations: "disabled" as const,
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
  analyticsReadEnabled: false,
};

test("shows authenticated account, container, and read-only access before chat", async ({ context, page }) => {
  let statusRequests = 0;
  let recognitionRequests = 0;
  await context.route("http://127.0.0.1:8787/api/google/status", async (route) => {
    statusRequests += 1;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(connectedReadOnlyStatus) });
  });
  await context.route("http://127.0.0.1:8787/api/google/containers/recognize?*", async (route) => {
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
          measurementIds: ["G-TEST123456"],
          workspace: { status: "available", action: "create", workspaceCount: 1, remainingSlots: 2 },
        },
      }),
    });
  });

  await page.goto("http://127.0.0.1:4173/?gtm=GTM-TEST123");
  const root = page.locator("#gtm-observability-root");
  await expect(root).toBeAttached();
  await page.waitForLoadState("networkidle");
  expect(statusRequests).toBe(0);
  expect(recognitionRequests).toBe(0);

  await root.getByRole("button", { name: "Open tracking agent" }).click();
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
  await expect(root.locator("section.assistant")).toHaveScreenshot("gtm-context-matched.png", {
    ...screenshotOptions,
    maxDiffPixels: 50,
  });
});

const enhancedMeasurementScenarios = [
  {
    name: "complete automatic coverage",
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
    summary: "7 of 7 automatic features on",
    detail: "No automatic coverage gaps",
    snapshot: undefined,
  },
  {
    name: "automatic coverage gaps",
    settings: {
      stream: true,
      pageViews: true,
      scrolls: true,
      outboundClicks: true,
      siteSearch: false,
      videoEngagement: true,
      fileDownloads: true,
      formInteractions: false,
    },
    summary: "5 of 7 automatic features on",
    detail: "Site search · Form interactions",
    snapshot: undefined,
  },
  {
    name: "a disabled master switch",
    settings: {
      stream: false,
      pageViews: true,
      scrolls: true,
      outboundClicks: true,
      siteSearch: true,
      videoEngagement: true,
      fileDownloads: true,
      formInteractions: true,
    },
    summary: "Master switch off · 0 of 7 active",
    detail: "SPA page views · Scrolls · Outbound clicks · Site search · Video engagement · File downloads · Form interactions",
    snapshot: "enhanced-measurement-master-off.png",
  },
];

for (const scenario of enhancedMeasurementScenarios) {
  test(`shows ${scenario.name} for one exact GA4 stream`, async ({ context, page }) => {
    await context.route("http://127.0.0.1:8787/api/google/status", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ...connectedReadOnlyStatus, analyticsReadEnabled: true }),
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
          container: { accountId: "1", containerId: "10", name: "Lead site", publicId: "GTM-TEST123" },
          measurementIds: ["G-TEST123456"],
        },
      }),
    }));
    await context.route("http://127.0.0.1:8787/api/google/analytics/enhanced-measurement?*", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        measurementId: "G-TEST123456",
        property: { propertyId: "2", name: "GA4 property" },
        stream: { streamId: "20", name: "Web stream" },
        settings: scenario.settings,
      }),
    }));

    await page.goto("http://127.0.0.1:4173/?gtm=GTM-TEST123");
    const root = page.locator("#gtm-observability-root");
    await root.getByRole("button", { name: "Open tracking agent" }).click();
    const card = root.getByRole("region", { name: "GTM connection" });

    await expect(card.getByText(scenario.summary, { exact: true })).toBeVisible();
    await expect(card.getByText(scenario.detail, { exact: true })).toBeVisible();
    await expect(card.getByText(/confirmed lead outcomes remain separate/i)).toBeVisible();
    if (scenario.snapshot) {
      await expect(card).toHaveScreenshot(scenario.snapshot, screenshotOptions);
    }
  });
}

test("bounds a malformed enhanced-measurement response", async ({ context, page }) => {
  await context.route("http://127.0.0.1:8787/api/google/status", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ...connectedReadOnlyStatus, analyticsReadEnabled: true }),
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
        container: { accountId: "1", containerId: "10", name: "Lead site", publicId: "GTM-TEST123" },
        measurementIds: ["G-TEST123456"],
      },
    }),
  }));
  await context.route("http://127.0.0.1:8787/api/google/analytics/enhanced-measurement?*", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      measurementId: "G-TEST123456",
      property: { propertyId: "2", name: "<script>provider secret</script>" },
      stream: { streamId: "20", name: "Web stream" },
      settings: { stream: "yes" },
    }),
  }));

  await page.goto("http://127.0.0.1:4173/?gtm=GTM-TEST123");
  const root = page.locator("#gtm-observability-root");
  await root.getByRole("button", { name: "Open tracking agent" }).click();
  const card = root.getByRole("region", { name: "GTM connection" });

  await expect(card.getByText("Lead site", { exact: true })).toBeVisible();
  await expect(card.getByText("Enhanced measurement check unavailable", { exact: true })).toBeVisible();
  await expect(card.getByText(/provider secret/i)).toHaveCount(0);
});

test("shows a local-service diagnostic without disabling chat", async ({ context, page }) => {
  await context.route("http://127.0.0.1:8787/api/google/status", (route) => route.abort("connectionrefused"));
  await page.goto("http://127.0.0.1:4173/?gtm=GTM-TEST123");
  const root = page.locator("#gtm-observability-root");
  await root.getByRole("button", { name: "Open tracking agent" }).click();
  const card = root.getByRole("region", { name: "GTM connection" });
  await expect(card.getByText("Service offline", { exact: true })).toBeVisible();
  await expect(card.getByText(/local GTM service is offline/i)).toBeVisible();
  await expect(root.getByLabel("Tracking request")).toBeEnabled();
  await expect(root.locator("section.assistant")).toHaveScreenshot("gtm-context-offline.png", screenshotOptions);
});

const authorizationScenarios = [
  { name: "unconfigured", status: { ...connectedReadOnlyStatus, configured: false, connected: false }, copy: "Google OAuth is not configured" },
  { name: "disconnected", status: { ...connectedReadOnlyStatus, connected: false }, copy: "Google authorization required" },
];

for (const scenario of authorizationScenarios) {
  test(`distinguishes ${scenario.name} Google authorization`, async ({ context, page }) => {
    let recognitionRequests = 0;
    await context.route("http://127.0.0.1:8787/api/google/status", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(scenario.status),
    }));
    await context.route("http://127.0.0.1:8787/api/google/containers/recognize?*", async (route) => {
      recognitionRequests += 1;
      await route.abort();
    });
    await page.goto("http://127.0.0.1:4173/?gtm=GTM-TEST123");
    const root = page.locator("#gtm-observability-root");
    await root.getByRole("button", { name: "Open tracking agent" }).click();
    await expect(root.getByRole("region", { name: "GTM connection" }).getByText(scenario.copy, { exact: true })).toBeVisible();
    expect(recognitionRequests).toBe(0);
  });
}

test("shows connected access even when the page has no GTM container", async ({ context, page }) => {
  let recognitionRequests = 0;
  await context.route("http://127.0.0.1:8787/api/google/status", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(connectedReadOnlyStatus),
  }));
  await context.route("http://127.0.0.1:8787/api/google/containers/recognize?*", async (route) => {
    recognitionRequests += 1;
    await route.abort();
  });
  await page.goto("http://127.0.0.1:4173/");
  const root = page.locator("#gtm-observability-root");
  await root.getByRole("button", { name: "Open tracking agent" }).click();
  const card = root.getByRole("region", { name: "GTM connection" });
  await expect(card.getByText("Read-only", { exact: true })).toBeVisible();
  await expect(card.getByText("No GTM container detected on this page", { exact: true })).toBeVisible();
  expect(recognitionRequests).toBe(0);
});

const recognitionScenarios = [
  { name: "an inaccessible", result: { status: "not_accessible", publicId: "GTM-TEST123" }, copy: "Not accessible" },
  { name: "an ambiguous", result: { status: "ambiguous", publicId: "GTM-TEST123", matchCount: 2 }, copy: "Ambiguous match" },
];

for (const scenario of recognitionScenarios) {
  test(`fails closed for ${scenario.name} page container`, async ({ context, page }) => {
    await context.route("http://127.0.0.1:8787/api/google/status", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(connectedReadOnlyStatus),
    }));
    await context.route("http://127.0.0.1:8787/api/google/containers/recognize?*", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ containerWritesEnabled: false, result: scenario.result }),
    }));
    await page.goto("http://127.0.0.1:4173/?gtm=GTM-TEST123");
    const root = page.locator("#gtm-observability-root");
    await root.getByRole("button", { name: "Open tracking agent" }).click();
    await expect(root.getByRole("region", { name: "GTM connection" }).getByText(scenario.copy, { exact: true })).toBeVisible();
  });
}

test("fails closed for multiple page containers", async ({ context, page }) => {
  let recognitionRequests = 0;
  await context.route("http://127.0.0.1:8787/api/google/status", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(connectedReadOnlyStatus),
  }));
  await context.route("http://127.0.0.1:8787/api/google/containers/recognize?*", async (route) => {
    recognitionRequests += 1;
    await route.abort();
  });
  await page.goto("http://127.0.0.1:4173/?gtm=GTM-ONE123");
  await page.evaluate(() => {
    const second = document.createElement("script");
    second.src = "https://www.googletagmanager.com/gtm.js?id=GTM-TWO456";
    document.head.append(second);
  });
  const root = page.locator("#gtm-observability-root");
  await root.getByRole("button", { name: "Open tracking agent" }).click();
  const card = root.getByRole("region", { name: "GTM connection" });
  await expect(card.getByText("Multiple page containers", { exact: true })).toBeVisible();
  await expect(card.getByText(/GTM-ONE123.*GTM-TWO456/)).toBeVisible();
  expect(recognitionRequests).toBe(0);
});
