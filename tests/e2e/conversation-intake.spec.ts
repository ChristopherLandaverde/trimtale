import { type Locator } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "./helpers/extension-test.js";

interface IntakeCase {
  id: string;
  message: string;
}

const visualStabilityStylePath = resolve("tests/e2e/visual-stability.css");
const visualStabilityCss = readFileSync(visualStabilityStylePath, "utf8");

const screenshotOptions = {
  animations: "disabled" as const,
  stylePath: visualStabilityStylePath,
};

async function stabilizeShadowRoot(host: Locator): Promise<void> {
  await host.evaluate((element, css) => {
    const shadow = element.shadowRoot;
    if (!shadow) {
      throw new Error("Expected an open shadow root for visual normalization");
    }
    const style = document.createElement("style");
    style.dataset.visualStability = "true";
    style.textContent = css;
    shadow.append(style);
  }, visualStabilityCss);
}

function acceptanceCase(id: string): IntakeCase {
  const contract = JSON.parse(readFileSync(
    resolve("tests/acceptance/conversation-intake.json"),
    "utf8",
  )) as { cases: IntakeCase[] };
  const item = contract.cases.find((candidate) => candidate.id === id);
  if (!item) {
    throw new Error(`Missing conversation acceptance case: ${id}`);
  }
  return item;
}

test("clarifies a form intent and requires explicit specification confirmation", async ({ page: site }) => {
  await site.goto("http://127.0.0.1:4173/");
  await site.addStyleTag({ content: visualStabilityCss });
  const root = site.locator("#gtm-observability-root");
  await root.getByRole("button", { name: "Open tracking agent" }).click();

  const ambiguous = acceptanceCase("ambiguous-form-requires-target");
  await root.getByLabel("Tracking request").fill(ambiguous.message);
  await root.getByRole("button", { name: "Send request" }).click();
  const task = root.getByRole("region", { name: "Agent task" });
  await expect(task).toHaveCount(1);
  await expect(task.getByText("Set up lead-form tracking", { exact: true })).toBeVisible();
  await expect(task.getByText("I found two forms and need you to choose which one represents a qualified inquiry.", { exact: true })).toBeVisible();
  await expect(task.getByRole("list", { name: "Task plan" }).getByText("Confirm measurement scope", { exact: true })).toBeVisible();
  await expect(task.getByText("2 forms · 5 navigation links", { exact: true })).toBeVisible();
  await expect(root.getByRole("button", { name: "Contact sales" })).toBeVisible();
  await expect(root.getByRole("button", { name: "Newsletter signup" })).toBeVisible();
  const targets = site.locator("#gtm-observability-targets");
  await expect(targets.locator(".target.candidate")).toHaveCount(2);
  await expect(targets.locator(".target.candidate[data-target-id='contact']")).toHaveCount(1);
  await expect(targets.locator(".target.candidate[data-target-id='newsletter']")).toHaveCount(1);
  await stabilizeShadowRoot(targets);
  await expect(targets.locator(".target span").first()).toHaveCSS("font-family", /Arial/);
  await expect(site).toHaveScreenshot("form-candidate-highlights.png", screenshotOptions);
  await expect(root.getByRole("button", { name: "Approve setup" })).toHaveCount(0);

  await root.getByRole("button", { name: "Contact sales" }).click();
  await expect(task).toHaveCount(1);
  await expect(targets.locator(".target.candidate")).toHaveCount(0);
  await expect(targets.locator(".target.confirmed[data-target-id='contact']")).toHaveCount(1);
  await expect(site).toHaveScreenshot("form-confirmed-highlight.png", screenshotOptions);
  await expect(root.getByText(/successful Contact sales submissions as generate_lead/)).toBeVisible();
  await expect(root.getByText(/without counting submit attempts or validation errors/)).toBeVisible();
  await root.getByRole("button", { name: "Review setup" }).click();
  await expect(task).toHaveCount(1);
  await expect(task.getByText("Reviewable setup", { exact: true })).toBeVisible();
  await expect(task.getByText("Qualified inquiry", { exact: true })).toBeVisible();
  await expect(task.getByText("Success message", { exact: true })).toBeVisible();
  await root.getByRole("button", { name: "Approve setup" }).click();
  await expect(root.getByText(/Setup approved and generated/)).toBeVisible();
});

test("uses one adjacent stable status as form success evidence and rejects ambiguity", async ({ context }) => {
  await context.route("https://www.googletagmanager.com/**", (route) => route.fulfill({
    contentType: "application/javascript",
    body: "",
  }));
  await context.route("http://127.0.0.1:4175/ambiguous-status", (route) => route.fulfill({
    contentType: "text/html",
    body: `<!doctype html><main><section>
      <form id="ambiguous-form" aria-label="Ambiguous lead form"><button type="submit">Send</button></form>
      <p id="first-status" role="status" hidden>First outcome</p>
      <p id="second-status" aria-live="polite" hidden>Second outcome</p>
    </section></main>`,
  }));
  await context.route("http://127.0.0.1:4175/unaddressable-status", (route) => route.fulfill({
    contentType: "text/html",
    body: `<!doctype html><main><section>
      <form id="unaddressable-form" aria-label="Unaddressable lead form"><button type="submit">Send</button></form>
      <p role="status" hidden>Outcome without a stable identifier</p>
    </section></main>`,
  }));

  async function submitIntent(url: string) {
    const page = await context.newPage();
    await page.goto(url);
    const root = page.locator("#gtm-observability-root");
    const assistant = root.locator("section.assistant");
    await expect(assistant).toBeAttached();
    if (await assistant.evaluate((element) => element.classList.contains("collapsed"))) {
      await root.getByRole("button", { name: "Open tracking agent" }).click();
    }
    await root.getByLabel("Tracking request").fill("Track successful submissions of this form");
    await root.getByRole("button", { name: "Send request" }).click();
    return { page, root };
  }

  const discovered = await submitIntent("http://127.0.0.1:4175/");
  await expect(discovered.root.getByText(
    /successful Disposable workflow smoke form submissions as generate_lead/,
  )).toBeVisible();
  await expect(discovered.root.getByRole("button", { name: "Review setup" })).toBeVisible();
  await expect(discovered.root.getByText(/diagnostic handoff/i)).toHaveCount(0);

  const ambiguous = await submitIntent("http://127.0.0.1:4175/ambiguous-status");
  await expect(ambiguous.root.getByText(/not a safe observable signal that proves it succeeded/i)).toBeVisible();
  await expect(ambiguous.root.getByRole("button", { name: "Review setup" })).toHaveCount(0);

  const unaddressable = await submitIntent("http://127.0.0.1:4175/unaddressable-status");
  await expect(unaddressable.root.getByText(/not a safe observable signal that proves it succeeded/i)).toBeVisible();
  await expect(unaddressable.root.getByRole("button", { name: "Review setup" })).toHaveCount(0);
});

test("keeps an unsupported request honest and leaves the agent usable", async ({ page: site }) => {
  await site.goto("http://127.0.0.1:4173/");
  const root = site.locator("#gtm-observability-root");
  await root.getByRole("button", { name: "Open tracking agent" }).click();
  await root.getByLabel("Tracking request").fill("Track phone calls");
  await root.getByRole("button", { name: "Send request" }).click();

  const task = root.getByRole("region", { name: "Agent task" });
  await expect(task).toHaveCount(1);
  await expect(task.getByLabel("Task status: Not supported")).toBeVisible();
  await expect(task.getByText(/phone click tracking, which is not supported/i)).toBeVisible();
  await expect(root.getByRole("button", { name: "Approve setup" })).toHaveCount(0);
  await expect(root.getByLabel("Tracking request")).toBeEnabled();
});
