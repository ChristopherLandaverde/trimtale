import { expect, test, chromium, type Locator } from "@playwright/test";
import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

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
    if (!shadow) throw new Error("Expected an open shadow root for visual normalization");
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
    await site.goto("http://127.0.0.1:14173/");
    await site.addStyleTag({ content: visualStabilityCss });
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
    await stabilizeShadowRoot(targets);
    await expect(targets.locator(".target span").first()).toHaveCSS("font-family", /Arial/);
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

test("uses one adjacent stable status as form success evidence and rejects ambiguity", async () => {
  const profile = await mkdtemp(join(tmpdir(), "gtm-observability-adjacent-success-"));
  const context = await chromium.launchPersistentContext(profile, {
    channel: "chromium",
    headless: true,
    args: [
      `--disable-extensions-except=${resolve("apps/extension/dist")}`,
      `--load-extension=${resolve("apps/extension/dist")}`,
    ],
  });
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
      await root.getByRole("button", { name: "Open tracking assistant" }).click();
    }
    await root.getByLabel("Tracking request").fill("Track successful submissions of this form");
    await root.getByRole("button", { name: "Send request" }).click();
    return { page, root };
  }

  try {
    const discovered = await submitIntent("http://127.0.0.1:4175/");
    await expect(discovered.root.getByText(
      /successful Disposable workflow smoke form submission as generate_lead/,
    )).toBeVisible();
    await expect(discovered.root.getByRole("button", { name: "Review setup" })).toBeVisible();
    await expect(discovered.root.getByText(/diagnostic handoff/i)).toHaveCount(0);

    const ambiguous = await submitIntent("http://127.0.0.1:4175/ambiguous-status");
    await expect(ambiguous.root.getByText(/cannot safely observe what proves it succeeded/i)).toBeVisible();
    await expect(ambiguous.root.getByRole("button", { name: "Review setup" })).toHaveCount(0);

    const unaddressable = await submitIntent("http://127.0.0.1:4175/unaddressable-status");
    await expect(unaddressable.root.getByText(/cannot safely observe what proves it succeeded/i)).toBeVisible();
    await expect(unaddressable.root.getByRole("button", { name: "Review setup" })).toHaveCount(0);
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});

test("keeps the assistant fully open when a request is sent during the open transition", async () => {
  const profile = await mkdtemp(join(tmpdir(), "gtm-observability-open-race-"));
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
    await site.goto("http://127.0.0.1:14173/");
    const root = site.locator("#gtm-observability-root");
    const assistant = root.locator("section.assistant");
    await expect(assistant).toHaveClass(/collapsed/);

    // Open and submit while the 180ms width transition is still running.
    await root.evaluate(async (host) => {
      const shadow = host.shadowRoot;
      if (!shadow) throw new Error("Expected an open shadow root");
      shadow.querySelector<HTMLButtonElement>(".orb")!.click();
      await new Promise((settle) => setTimeout(settle, 60));
      const textarea = shadow.querySelector<HTMLTextAreaElement>("textarea")!;
      textarea.value = "Track leads from a form";
      shadow.querySelector<HTMLButtonElement>(".send")!.click();
    });

    await expect(root.getByText("I found 2 forms. Which one represents the outcome you want to measure?")).toBeVisible();
    await expect.poll(() => assistant.evaluate((element) => (element as HTMLElement).style.width)).toBe("380px");
    await expect.poll(() => assistant.evaluate((element) => Math.round(element.getBoundingClientRect().width)))
      .toBeGreaterThanOrEqual(380);

    // A later request re-applies the remembered size; it must not grow by the border width.
    await root.getByLabel("Tracking request").fill("navigation");
    await root.getByRole("button", { name: "Send request" }).click();
    await expect(root.getByText("I found 2 forms. Which one represents the outcome you want to measure?")).toBeVisible();
    await expect.poll(() => assistant.evaluate((element) => (element as HTMLElement).style.width)).toBe("380px");
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});
