import { chromium, expect, type BrowserContext, type Page } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

export interface ExtensionJourney {
  context: BrowserContext;
  page: Page;
  root: ReturnType<Page["locator"]>;
  send(message: string): Promise<void>;
  close(): Promise<void>;
}

export async function openExtensionJourney(
  fixtureState: string,
  gtmContainerId?: string,
  prepare?: (context: BrowserContext) => Promise<void>,
): Promise<ExtensionJourney> {
  const profile = await mkdtemp(join(tmpdir(), "gtm-observability-journey-"));
  const extensionPath = resolve("apps/extension/dist");
  const context = await chromium.launchPersistentContext(profile, {
    channel: "chromium",
    headless: true,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  if (prepare) await prepare(context);
  const page = await context.newPage();
  const url = new URL("http://127.0.0.1:14173/");
  url.searchParams.set("formScenario", fixtureState);
  if (gtmContainerId) url.searchParams.set("gtm", gtmContainerId);
  await page.goto(url.toString());
  const root = page.locator("#trimtale-root");
  await expect(root).toBeAttached();
  await root.getByRole("button", { name: "Open tracking assistant" }).click();

  return {
    context,
    page,
    root,
    async send(message: string) {
      await root.getByLabel("Tracking request").fill(message);
      await root.getByRole("button", { name: "Send request" }).click();
      await expect(root.getByText(message, { exact: true })).toBeVisible();
    },
    async close() {
      await context.close();
      await rm(profile, { recursive: true, force: true });
    },
  };
}
