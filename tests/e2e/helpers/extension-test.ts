import {
  chromium,
  expect,
  test as base,
  type BrowserContext,
} from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const extensionPath = resolve("apps/extension/dist");

export const test = base.extend<{ context: BrowserContext }>({
  context: async ({}, use) => {
    const profile = await mkdtemp(join(tmpdir(), "gtm-observability-e2e-"));

    try {
      const context = await chromium.launchPersistentContext(profile, {
        channel: "chromium",
        headless: true,
        args: [
          `--disable-extensions-except=${extensionPath}`,
          `--load-extension=${extensionPath}`,
        ],
      });

      try {
        await use(context);
      } finally {
        await context.close();
      }
    } finally {
      await rm(profile, { recursive: true, force: true });
    }
  },
});

export { expect };
