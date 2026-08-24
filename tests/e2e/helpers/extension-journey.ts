import { expect, type BrowserContext, type Page } from "@playwright/test";

export interface ExtensionJourney {
  context: BrowserContext;
  page: Page;
  root: ReturnType<Page["locator"]>;
  send(message: string): Promise<void>;
}

export async function openExtensionJourney(
  context: BrowserContext,
  page: Page,
  fixtureState: string,
  gtmContainerId?: string,
): Promise<ExtensionJourney> {
  const url = new URL("http://127.0.0.1:4173/");
  url.searchParams.set("formScenario", fixtureState);
  if (gtmContainerId) {
    url.searchParams.set("gtm", gtmContainerId);
  }
  await page.goto(url.toString());
  const root = page.locator("#gtm-observability-root");
  await expect(root).toBeAttached();
  await root.getByRole("button", { name: "Open tracking agent" }).click();

  return {
    context,
    page,
    root,
    async send(message: string) {
      await root.getByLabel("Tracking request").fill(message);
      await root.getByRole("button", { name: "Send request" }).click();
      await expect(root.getByText(message, { exact: true })).toBeVisible();
    },
  };
}
