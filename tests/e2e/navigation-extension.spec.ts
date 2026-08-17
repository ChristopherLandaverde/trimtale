import { expect, test, chromium } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

test("mounts and streams through the floating tracking assistant", async () => {
  const profile = await mkdtemp(join(tmpdir(), "gtm-observability-"));
  const extensionPath = resolve("apps/extension/dist");
  const context = await chromium.launchPersistentContext(profile, {
    channel: "chromium",
    headless: true,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });

  try {
    const site = await context.newPage();
    await site.goto("http://127.0.0.1:4173/");

    const root = site.locator("#gtm-observability-root");
    const assistant = root.locator("section.assistant");
    await expect(root).toBeAttached();
    await expect(assistant).toHaveClass(/collapsed/);

    await root.getByRole("button", { name: "Open tracking assistant" }).click();
    await expect(assistant).not.toHaveClass(/collapsed/);
    await expect(root.getByText("What do you want to track on this page?")).toBeVisible();

    await root.getByLabel("Tracking request").fill("Track clicks on the primary navigation");
    await root.getByRole("button", { name: "Send request" }).click();
    await expect(root.getByText("Track clicks on the primary navigation")).toBeVisible();
    await expect(root.getByText(/I found 5 navigation candidate/)).toBeVisible();

    await root.getByRole("button", { name: "Collapse assistant" }).click();
    await expect(assistant).toHaveClass(/collapsed/);
    await site.reload();
    await expect(site.locator("#gtm-observability-root section.assistant")).toHaveClass(/collapsed/);
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});
