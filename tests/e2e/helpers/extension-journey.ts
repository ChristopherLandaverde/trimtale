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
  query: Record<string, string> = {},
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
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
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

interface CdpExecutionContext { id: number; name: string; origin: string; auxData?: { type?: string; frameId?: string } }

/**
 * Evaluates an expression in the extension's isolated content-script world of the page's main
 * frame (via CDP), where page scripts cannot reach. Used to inspect what actually crossed from
 * the page observer into the extension.
 */
export async function evaluateInExtensionWorld<T>(page: Page, expression: string): Promise<T> {
  const cdp = await page.context().newCDPSession(page);
  try {
    const contexts: CdpExecutionContext[] = [];
    cdp.on("Runtime.executionContextCreated", (event: { context: CdpExecutionContext }) => contexts.push(event.context));
    await cdp.send("Runtime.enable");
    const { frameTree } = await cdp.send("Page.getFrameTree");
    const context = contexts.find((item) => item.auxData?.type === "isolated"
      && item.auxData.frameId === frameTree.frame.id
      && item.origin.startsWith("chrome-extension://"));
    if (!context) throw new Error(`No extension isolated world in ${JSON.stringify(contexts.map((item) => [item.name, item.origin, item.auxData]))}`);
    const result = await cdp.send("Runtime.evaluate", { contextId: context.id, expression, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value as T;
  } finally {
    await cdp.detach();
  }
}
