import type { BrowserContext } from "@playwright/test";
import { expect, test } from "./helpers/extension-test.js";

const status = {
  configured: true,
  connected: true,
  scope: "container-edit",
  containerWritesEnabled: true,
  publicationScopeRequested: false,
  publicationEnabled: false,
  tokenPersistenceEnabled: true,
  analyticsReadEnabled: true,
};

const recognition = {
  containerWritesEnabled: true,
  result: {
    status: "recognized",
    publicId: "GTM-TEST123",
    account: { accountId: "1", name: "Agency" },
    container: {
      accountId: "1",
      containerId: "10",
      name: "Resource site",
      publicId: "GTM-TEST123",
    },
    measurementIds: ["G-TEST123456"],
  },
};

const coverage = {
  measurementId: "G-TEST123456",
  property: { propertyId: "2", name: "GA4 property" },
  stream: { streamId: "20", name: "Web stream" },
  settings: {
    stream: true,
    pageViews: true,
    scrolls: true,
    outboundClicks: false,
    siteSearch: true,
    videoEngagement: true,
    fileDownloads: false,
    formInteractions: true,
  },
};

async function routeGoogleContext(
  context: BrowserContext,
  settings = coverage.settings,
): Promise<void> {
  await context.route("https://www.googletagmanager.com/**", (route) => route.fulfill({
    contentType: "application/javascript",
    body: "",
  }));
  await context.route("http://127.0.0.1:8787/api/google/status", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(status),
  }));
  await context.route("http://127.0.0.1:8787/api/google/containers/recognize?*", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(recognition),
  }));
  await context.route("http://127.0.0.1:8787/api/google/analytics/enhanced-measurement?*", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ...coverage, settings }),
  }));
}

function pageBody(): string {
  return `<!doctype html>
    <html><head>
      <meta name="gtm-observability-container-id" content="GTM-TEST123">
      <meta name="gtm-observability-measurement-id" content="G-TEST123456">
      <title>Resources</title>
      <script src="https://www.googletagmanager.com/gtm.js?id=GTM-TEST123"></script>
    </head><body><main>
      <h1>Resources</h1>
      <a id="internal" href="/pricing">Pricing</a>
      <a id="external" href="https://outside.invalid/path?private=attacker-sentinel">Partner</a>
      <a id="download" href="/files/customer-attacker-sentinel.PDF?token=private">Guide</a>
      <a id="email" href="mailto:private@example.test">Email</a>
      <a id="phone" href="tel:+15551234567">Call</a>
    </main></body></html>`;
}

test("visibly grounds known-link requests without exposing their values", async ({ context }) => {
  await routeGoogleContext(context);
  await context.route("http://127.0.0.1:4175/link-interactions", (route) => route.fulfill({
    contentType: "text/html",
    body: pageBody(),
  }));

  const site = await context.newPage();
  await site.goto("http://127.0.0.1:4175/link-interactions");
  const root = site.locator("#gtm-observability-root");
  await root.getByRole("button", { name: "Open tracking agent" }).click();
  await expect(root.getByText("5 of 7 automatic features on", { exact: true })).toBeVisible();

  const cases = [
    { prompt: "Track outbound links", id: "known_outbound_click_1", label: "outbound link" },
    { prompt: "Track downloads", id: "known_file_download_1", label: "downloadable file link" },
    { prompt: "Track email links", id: "known_email_click_1", label: "email link" },
    { prompt: "Track phone calls", id: "known_phone_click_1", label: "phone link" },
  ];
  const targets = site.locator("#gtm-observability-targets");
  for (const item of cases) {
    await root.getByLabel("Tracking request").fill(item.prompt);
    await root.getByRole("button", { name: "Send request" }).click();

    await expect(targets.locator(`.target.candidate[data-target-id='${item.id}']`)).toHaveCount(1);
    await expect(targets.locator(".target.candidate")).toHaveCount(1);
    await expect(targets.locator(".target.candidate span")).toHaveText(`1 ${item.label}`);
    const task = root.getByRole("region", { name: "Agent task" }).last();
    await expect(task).not.toContainText("private@example.test");
    await expect(task).not.toContainText("+15551234567");
    await expect(task).not.toContainText("attacker-sentinel");
  }

  const phoneTask = root.getByRole("region", { name: "Agent task" }).last();
  const pageReceipt = phoneTask.locator(".agent-receipt").filter({ hasText: "Page inspected" });
  const receiptLayout = await pageReceipt.evaluate((row) => {
    const label = row.querySelector<HTMLElement>(".agent-receipt-label")!;
    const detail = row.querySelector<HTMLElement>(".agent-receipt-detail")!;
    const rowBounds = row.getBoundingClientRect();
    const detailBounds = detail.getBoundingClientRect();
    return {
      labelWidth: label.getBoundingClientRect().width,
      detailRight: detailBounds.right,
      rowRight: rowBounds.right,
      rowClientWidth: row.clientWidth,
      rowScrollWidth: row.scrollWidth,
      taskClientWidth: row.closest<HTMLElement>(".agent-turn")!.clientWidth,
      taskScrollWidth: row.closest<HTMLElement>(".agent-turn")!.scrollWidth,
    };
  });
  expect(receiptLayout.labelWidth).toBeGreaterThanOrEqual(72);
  expect(receiptLayout.detailRight).toBeLessThanOrEqual(receiptLayout.rowRight);
  expect(receiptLayout.rowScrollWidth).toBe(receiptLayout.rowClientWidth);
  expect(receiptLayout.taskScrollWidth).toBe(receiptLayout.taskClientWidth);
  await phoneTask.getByRole("button", { name: "Only on this page" }).click();
  await expect(targets.locator(".target.confirmed[data-target-id='known_phone_click_1']"))
    .toHaveCount(1);
});

test("authors a privacy-safe outbound-link setup through the shared workflow", async ({ context }) => {
  await routeGoogleContext(context);
  let workflowRequest: unknown;
  await context.route("http://127.0.0.1:8787/api/google/workflows/plan", async (route) => {
    workflowRequest = route.request().postDataJSON();
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        result: {
          status: "planned",
          operation: {
            id: "operation_setup_outbound_click_sitewide",
            status: "planned",
            plan: {
              status: "ready",
              fingerprint: "plan_outbound_click",
              actions: [
                { kind: "builtInVariable", action: "create", generatedName: "Click URL" },
                { kind: "trigger", action: "create", generatedName: "GO - outbound_click" },
                { kind: "tag", action: "create", generatedName: "GA4 Event - outbound_click" },
              ],
            },
          },
        },
      }),
    });
  });
  await context.route("http://127.0.0.1:4175/link-interactions", (route) => route.fulfill({
    contentType: "text/html",
    body: pageBody(),
  }));

  const site = await context.newPage();
  await site.goto("http://127.0.0.1:4175/link-interactions");
  const root = site.locator("#gtm-observability-root");
  await root.getByRole("button", { name: "Open tracking agent" }).click();
  await expect(root.getByText("5 of 7 automatic features on", { exact: true })).toBeVisible();
  await root.getByLabel("Tracking request").fill("Track external links");
  await root.getByRole("button", { name: "Send request" }).click();

  const task = root.getByRole("region", { name: "Agent task" });
  await expect(task.getByText(/1 outbound link/).first()).toBeVisible();
  await expect(task.getByText(/automatic outbound-click measurement is off/i)).toBeVisible();
  await root.getByRole("button", { name: "All outbound links sitewide" }).click();
  await root.getByRole("button", { name: "Review setup" }).click();
  await expect(task.getByText(/Excluded: link_url/i)).toBeVisible();
  await expect(task).not.toContainText("attacker-sentinel");
  await expect(task).not.toContainText("outside.invalid");
  await root.getByRole("button", { name: "Approve setup" }).click();

  const download = task.getByRole("button", { name: "Download GTM setup" });
  await expect(download).toHaveAttribute("download", "gtm-observability-outbound-click.json");
  const href = decodeURIComponent(await download.getAttribute("href") ?? "");
  expect(href).not.toContain("attacker-sentinel");
  expect(href).not.toContain("outside.invalid");

  await task.getByRole("button", { name: "Prepare workspace & plan" }).click();
  await expect(task.getByRole("region", { name: "Tracking change plan" })).toBeVisible();
  expect(workflowRequest).toMatchObject({
    setup: {
      id: "setup_outbound_click_sitewide",
      tagActions: [{ event: { name: "outbound_click", parameters: [] } }],
    },
    container: { publicId: "GTM-TEST123" },
  });
  expect(JSON.stringify(workflowRequest)).not.toContain("attacker-sentinel");
});

test("authors file downloads only when automatic coverage is off", async ({ context }) => {
  await routeGoogleContext(context);
  await context.route("http://127.0.0.1:4175/link-interactions", (route) => route.fulfill({
    contentType: "text/html",
    body: pageBody(),
  }));
  const site = await context.newPage();
  await site.goto("http://127.0.0.1:4175/link-interactions");
  const root = site.locator("#gtm-observability-root");
  await root.getByRole("button", { name: "Open tracking agent" }).click();
  await expect(root.getByText("5 of 7 automatic features on", { exact: true })).toBeVisible();
  await root.getByLabel("Tracking request").fill("Track downloads");
  await root.getByRole("button", { name: "Send request" }).click();

  const task = root.getByRole("region", { name: "Agent task" });
  await expect(task.getByText(/1 downloadable file link/).first()).toBeVisible();
  await expect(task.getByText(/automatic file-download measurement is off/i)).toBeVisible();
  await root.getByRole("button", { name: "Only on this page" }).click();
  await root.getByRole("button", { name: "Review setup" }).click();
  await expect(task.getByText(/Excluded: file_name/i)).toBeVisible();
  await expect(task).not.toContainText("customer-attacker-sentinel");
  await root.getByRole("button", { name: "Approve setup" }).click();
  await expect(task.getByText(/privacy-safe file_download setup was generated/i)).toBeVisible();
  await expect(task.getByRole("button", { name: "Download GTM setup" }))
    .toHaveAttribute("download", "gtm-observability-file-download.json");
});

test("does not duplicate exact-stream automatic link coverage", async ({ context }) => {
  await routeGoogleContext(context, {
    ...coverage.settings,
    outboundClicks: true,
    fileDownloads: true,
  });
  await context.route("http://127.0.0.1:4175/link-interactions", (route) => route.fulfill({
    contentType: "text/html",
    body: pageBody(),
  }));
  const site = await context.newPage();
  await site.goto("http://127.0.0.1:4175/link-interactions");
  const root = site.locator("#gtm-observability-root");
  await root.getByRole("button", { name: "Open tracking agent" }).click();
  await expect(root.getByText("7 of 7 automatic features on", { exact: true })).toBeVisible();

  await root.getByLabel("Tracking request").fill("Track outbound links");
  await root.getByRole("button", { name: "Send request" }).click();
  const outbound = root.getByRole("region", { name: "Agent task" }).last();
  await expect(outbound.getByText("Already covered · Outbound links", { exact: true })).toBeVisible();
  await expect(outbound.getByRole("button", { name: /review|scope|prepare/i })).toHaveCount(0);

  await root.getByLabel("Tracking request").fill("Track downloads");
  await root.getByRole("button", { name: "Send request" }).click();
  const download = root.getByRole("region", { name: "Agent task" }).last();
  await expect(download.getByText("Already covered · File downloads", { exact: true })).toBeVisible();
  await expect(download.getByRole("button", { name: /review|scope|prepare/i })).toHaveCount(0);
});
