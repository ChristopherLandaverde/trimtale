import { expect, test } from "./helpers/extension-test.js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const screenshotOptions = {
  animations: "disabled" as const,
  stylePath: resolve("tests/e2e/visual-stability.css"),
};

test("mounts the floating tracking agent", async ({ page: site }) => {
  await site.goto("http://127.0.0.1:4173/");

  const root = site.locator("#gtm-observability-root");
  const assistant = root.locator("section.assistant");
  await expect(root).toBeAttached();
  await expect(assistant).toHaveClass(/collapsed/);
  await expect(assistant).toHaveScreenshot("assistant-collapsed.png", screenshotOptions);

  await root.getByRole("button", { name: "Open tracking agent" }).click();
  await expect(assistant).not.toHaveClass(/collapsed/);
  await expect(assistant).toHaveAttribute("aria-label", "Tracking agent");
  await expect(root.getByText("What should we set up or check?", { exact: true })).toBeVisible();
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
  await expect(root.getByRole("region", { name: "Tracking evidence path" })).toHaveCount(0);
  await expect(root.getByText("Evidence path", { exact: true })).toHaveCount(0);
  await expect(root.getByText("Platform confirmation", { exact: true })).toHaveCount(0);
  await expect(root.getByRole("button", { name: "Download GTM setup" })).toBeVisible();
  await expect(site.locator("#gtm-observability-targets")).toBeAttached();
  await expect(site.locator("#gtm-observability-targets").locator(".target.confirmed")).toHaveCount(5);
  await expect(assistant).toHaveScreenshot("assistant-navigation-confirmed.png", screenshotOptions);

  const downloadPromise = site.waitForEvent("download");
  await root.getByRole("button", { name: "Download GTM setup" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("gtm-observability-navigation-click.json");
  const downloadPath = await download.path();
  if (!downloadPath) {
    throw new Error("The navigation setup download did not produce a local artifact.");
  }
  const generated = JSON.parse(readFileSync(downloadPath, "utf8")) as {
    containerVersion?: { tag?: unknown[]; trigger?: unknown[] };
  };
  expect(generated.containerVersion?.tag).toHaveLength(1);
  expect(generated.containerVersion?.trigger).toHaveLength(1);
  await expect(root.getByText(/Nothing was applied or published/).last()).toBeVisible();

  const setupResponse = await site.request.post("http://127.0.0.1:8787/api/setups", {
    data: {
      intent: "Track navigation links",
      pageUrl: "http://127.0.0.1:4173/",
      measurementId: "G-TEST123456",
      navigation: [
        {
          id: "nav_services",
          text: "Services",
          href: "http://127.0.0.1:4173/services",
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

  await root.getByRole("button", { name: "Collapse agent" }).click();
  await expect(assistant).toHaveClass(/collapsed/);
  await site.reload();
  await expect(site.locator("#gtm-observability-root section.assistant")).toHaveClass(/collapsed/);
});

test("reports an observed GTM public container ID separately from setup generation", async ({ page: site }) => {
  await site.goto("http://127.0.0.1:4173/?gtm=GTM-TEST123");
  const root = site.locator("#gtm-observability-root");
  await root.getByRole("button", { name: "Open tracking agent" }).click();
  await root.getByLabel("Tracking request").fill("navigation");
  await root.getByRole("button", { name: "Send request" }).click();
  await root.getByRole("button", { name: "Track all" }).click();
  await expect(root.getByRole("region", { name: "GTM connection" })).toContainText("GTM-TEST123");
  await expect(root.getByText("Reviewable navigation_click setup generated")).toBeVisible();
  await expect(root.getByRole("region", { name: "Tracking evidence path" })).toHaveCount(0);
});

test("does not claim setup generation without measurement context", async ({ page: site }) => {
  await site.goto("http://127.0.0.1:4173/?gtm=GTM-TEST123");
  await site.locator('meta[name="gtm-observability-measurement-id"]').evaluate((meta) => meta.remove());
  const root = site.locator("#gtm-observability-root");
  await root.getByRole("button", { name: "Open tracking agent" }).click();
  await root.getByLabel("Tracking request").fill("navigation");
  await root.getByRole("button", { name: "Send request" }).click();
  await root.getByRole("button", { name: "Track all" }).click();

  await expect(root.getByText("Connect a GTM container and GA4 measurement ID to generate setup")).toBeVisible();
  await expect(root.getByRole("button", { name: "Download GTM setup" })).toHaveCount(0);
});

test("keeps GTM access in the connection card after navigation confirmation", async ({ page: site }) => {
  await site.goto("http://127.0.0.1:4173/?gtm=GTM-TEST123");
  const root = site.locator("#gtm-observability-root");
  await root.getByRole("button", { name: "Open tracking agent" }).click();
  await root.getByLabel("Tracking request").fill("navigation");
  await root.getByRole("button", { name: "Send request" }).click();
  await root.getByRole("button", { name: "Track all" }).click();

  await expect(root.getByRole("region", { name: "GTM connection" })).toContainText("GTM-TEST123");
  await expect(root.getByRole("region", { name: "Tracking evidence path" })).toHaveCount(0);
  await expect(root.getByRole("button", { name: "Check GTM access" })).toHaveCount(0);
  await expect(root.getByRole("button", { name: "Prepare managed workspace" })).toHaveCount(0);
  await expect(root.getByRole("button", { name: "Download GTM setup" })).toBeVisible();
});

test("renders page-controlled target labels as inert text", async ({ page: site }) => {
  await site.goto("http://127.0.0.1:4173/");
  await site.locator("header nav a").first().evaluate((anchor) => {
    anchor.textContent = '<img src=x onerror="window.__unsafeHighlightExecuted=true">';
  });
  const root = site.locator("#gtm-observability-root");
  await root.getByRole("button", { name: "Open tracking agent" }).click();
  await root.getByLabel("Tracking request").fill("navigation");
  await root.getByRole("button", { name: "Send request" }).click();
  await root.getByRole("button", { name: "Choose links" }).click();
  const targets = site.locator("#gtm-observability-targets");
  await expect(targets.locator(".target span").filter({ hasText: "<img src=x" })).toHaveCount(1);
  await expect(targets.locator(".target img")).toHaveCount(0);
  expect(await site.evaluate(() => (window as Window & { __unsafeHighlightExecuted?: boolean }).__unsafeHighlightExecuted)).not.toBe(true);
});
