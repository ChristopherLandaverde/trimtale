import { expect, test, chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

interface IntakeCase {
  id: string;
  message: string;
}

const screenshotOptions = {
  animations: "disabled" as const,
  stylePath: resolve("tests/e2e/visual-stability.css"),
};

function acceptanceCase(id: string): IntakeCase {
  const contract = JSON.parse(readFileSync(
    resolve("tests/acceptance/conversation-intake.json"),
    "utf8",
  )) as { cases: IntakeCase[] };
  const item = contract.cases.find((candidate) => candidate.id === id);
  if (!item) throw new Error(`Missing conversation acceptance case: ${id}`);
  return item;
}

test("clarifies a form intent and requires explicit specification confirmation", async () => {
  const profile = await mkdtemp(join(tmpdir(), "gtm-observability-intake-"));
  const context = await chromium.launchPersistentContext(profile, {
    channel: "chromium",
    headless: true,
    args: [
      `--disable-extensions-except=${resolve("apps/extension/dist")}`,
      `--load-extension=${resolve("apps/extension/dist")}`,
    ],
  });

  try {
    const site = await context.newPage();
    await site.goto("http://127.0.0.1:4173/");
    await site.addStyleTag({ path: screenshotOptions.stylePath });
    const root = site.locator("#gtm-observability-root");
    await root.getByRole("button", { name: "Open tracking assistant" }).click();

    const ambiguous = acceptanceCase("ambiguous-form-requires-target");
    await root.getByLabel("Tracking request").fill(ambiguous.message);
    await root.getByRole("button", { name: "Send request" }).click();
    await expect(root.getByText("I found 2 forms. Which one represents the outcome you want to measure?")).toBeVisible();
    await expect(root.getByRole("button", { name: "Contact sales" })).toBeVisible();
    await expect(root.getByRole("button", { name: "Newsletter signup" })).toBeVisible();
    const targets = site.locator("#gtm-observability-targets");
    await expect(targets.locator(".target.candidate")).toHaveCount(2);
    await expect(targets.locator(".target.candidate[data-target-id='contact']")).toHaveCount(1);
    await expect(targets.locator(".target.candidate[data-target-id='newsletter']")).toHaveCount(1);
    await expect(site).toHaveScreenshot("form-candidate-highlights.png", screenshotOptions);
    await expect(root.getByRole("button", { name: "Confirm setup" })).toHaveCount(0);

    await root.getByRole("button", { name: "Contact sales" }).click();
    await expect(targets.locator(".target.candidate")).toHaveCount(0);
    await expect(targets.locator(".target.confirmed[data-target-id='contact']")).toHaveCount(1);
    await expect(site).toHaveScreenshot("form-confirmed-highlight.png", screenshotOptions);
    await expect(root.getByText(/successful Contact sales submission as generate_lead/)).toBeVisible();
    await expect(root.getByText(/validation error will not count/)).toBeVisible();
    await root.getByRole("button", { name: "Review setup" }).click();
    await expect(root.getByText(/Draft specification/)).toBeVisible();
    await expect(root.getByText(/Outcome: qualified inquiry/)).toBeVisible();
    await expect(root.getByText(/Success evidence: Success message/)).toBeVisible();
    await root.getByRole("button", { name: "Confirm setup" }).click();
    await expect(root.getByText(/Form tracking specification confirmed/)).toBeVisible();
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});
