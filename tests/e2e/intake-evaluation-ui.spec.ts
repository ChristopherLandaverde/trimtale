import { chromium, expect, test, type BrowserContext, type Page } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  intakeEvaluationDetailFixture,
  intakeEvaluationListFixture,
} from "./helpers/intake-evaluation-fixture.js";

const screenshotOptions = {
  animations: "disabled" as const,
  stylePath: resolve("tests/e2e/visual-stability.css"),
};

async function extensionContext(prefix: string): Promise<{
  context: BrowserContext;
  page: Page;
  profile: string;
}> {
  const profile = await mkdtemp(join(tmpdir(), prefix));
  const extensionPath = resolve("apps/extension/dist");
  const context = await chromium.launchPersistentContext(profile, {
    channel: "chromium",
    headless: true,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  const page = await context.newPage();
  return { context, page, profile };
}

async function openEvaluationPanel(page: Page) {
  await page.goto("http://127.0.0.1:4173/");
  const root = page.locator("#gtm-observability-root");
  await root.getByRole("button", { name: "Open tracking assistant" }).click();
  const toggle = root.getByRole("button", { name: "Open model evaluation reports" });
  await toggle.focus();
  await page.keyboard.press("Enter");
  const panel = root.getByRole("region", { name: "Model evaluation reports" });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("heading", { name: "Model evaluations", exact: true })).toBeFocused();
  return { root, panel };
}

test("renders a safe empty evaluation state without a run action", async () => {
  const { context, page, profile } = await extensionContext("gtm-observability-evaluation-empty-");
  await context.route("http://127.0.0.1:8787/api/intake-evaluations**", async (route) => {
    expect(route.request().method()).toBe("GET");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ schemaVersion: 1, reports: [] }),
    });
  });
  try {
    const { root, panel } = await openEvaluationPanel(page);
    await expect(panel.getByRole("heading", { name: "No model evaluations yet" })).toBeVisible();
    await expect(panel.getByText(/cannot start a model call/i)).toBeVisible();
    await expect(panel.getByRole("button", { name: /run/i })).toHaveCount(0);
    await expect(root.locator("section.assistant")).toHaveScreenshot("evaluation-empty.png", screenshotOptions);

    await panel.getByRole("button", { name: "Close model evaluation reports" }).focus();
    await page.keyboard.press("Enter");
    await expect(panel).toBeHidden();
    await root.getByLabel("Tracking request").fill("draft request stays here");
    await root.getByRole("button", { name: "Open model evaluation reports" }).focus();
    await page.keyboard.press("Enter");
    await expect(panel.getByRole("heading", { name: "No model evaluations yet" })).toBeVisible();
    await panel.getByRole("button", { name: "Close model evaluation reports" }).click();
    await expect(root.getByLabel("Tracking request")).toHaveValue("draft request stays here");
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});

test("renders degraded and passing report evidence without authority claims", async () => {
  const { context, page, profile } = await extensionContext("gtm-observability-evaluation-report-");
  await context.route("http://127.0.0.1:8787/api/intake-evaluations**", async (route) => {
    expect(route.request().method()).toBe("GET");
    const url = new URL(route.request().url());
    const reportId = url.pathname.split("/").at(-1);
    const body = reportId === "intake-evaluations"
      ? intakeEvaluationListFixture
      : intakeEvaluationDetailFixture(reportId ?? "");
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  try {
    const { root, panel } = await openEvaluationPanel(page);
    await expect(panel.getByRole("heading", { name: "Model evaluation report" })).toBeVisible();
    await expect(panel.getByText("Safety failure", { exact: true })).toBeVisible();
    await expect(panel.getByText("Passing", { exact: true })).toBeVisible();
    await expect(panel.getByText("prompt-shaped-label", { exact: true })).toHaveCount(1);
    await expect(panel.getByText("confirmation-bypass", { exact: true })).toHaveCount(1);
    await expect(panel.getByText("private-value-redaction", { exact: true })).toHaveCount(1);
    await expect(panel.getByText(/cannot confirm specifications, change GTM, or prove platform receipt/i)).toBeVisible();
    await panel.evaluate((element) => {
      element.scrollTop = 0;
      const content = element.querySelector<HTMLElement>(".evaluation-content");
      if (content) content.scrollTop = 0;
    });
    await expect(root.locator("section.assistant")).toHaveScreenshot("evaluation-degraded.png", screenshotOptions);

    await panel.getByLabel("Evaluation report", { exact: true }).selectOption("intake_report_passing");
    await expect(panel.getByText("All 14 acceptance cases passed.")).toHaveCount(2);
    await expect(panel.getByText("Safety failure", { exact: true })).toHaveCount(0);
    await expect(panel.getByText("Passing", { exact: true })).toHaveCount(2);
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});

test("rejects unavailable and attacker-shaped report payloads as inert evidence", async () => {
  const { context, page, profile } = await extensionContext("gtm-observability-evaluation-adversarial-");
  let adversarial = false;
  await context.route("http://127.0.0.1:8787/api/intake-evaluations**", async (route) => {
    if (!adversarial) {
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "private backend detail" }) });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        schemaVersion: 1,
        reports: [{
          schemaVersion: 1,
          id: "<img-src-x-onerror-alert-1>",
          createdAt: "2026-08-23T16:00:00.000Z",
          corpusSchemaVersion: 1,
          corpusCaseCount: 14,
          providers: [],
          prompt: "private",
        }],
      }),
    });
  });
  try {
    const { root, panel } = await openEvaluationPanel(page);
    await expect(panel.getByRole("heading", { name: "Reports unavailable" })).toBeVisible();
    await expect(panel.getByText(/No model call was started/i)).toBeVisible();
    await expect(panel).not.toContainText("private backend detail");

    adversarial = true;
    await panel.getByRole("button", { name: "Try again" }).click();
    await expect(panel.getByRole("heading", { name: "Reports unavailable" })).toBeVisible();
    await expect(panel.locator("img, script, iframe, a")).toHaveCount(0);
    await expect(panel).not.toContainText("img-src-x");
    await expect(root.locator("section.assistant")).toHaveScreenshot("evaluation-unavailable.png", screenshotOptions);
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});
