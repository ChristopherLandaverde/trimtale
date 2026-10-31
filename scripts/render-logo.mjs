#!/usr/bin/env node
// Renders the Trimtale logo SVGs to the committed PNGs with headless Chromium.
//
//   docs/media/logo.svg                 -> docs/media/logo.png (README, 256 px)
//                                       -> apps/extension/src/icons/icon-{32,48,128}.png
//   apps/extension/src/icons/icon-16.svg -> apps/extension/src/icons/icon-16.png
//
// The 16 px icon has its own SVG drawn on a 16 px grid: the full mark's tapered ribbons blur
// into grey at that size. Run `node scripts/render-logo.mjs` after editing either SVG.
// Needs Playwright's Chromium (`npx playwright install chromium`).

import { chromium } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const mark = "docs/media/logo.svg";
const small = "apps/extension/src/icons/icon-16.svg";

const outputs = [
  { svg: mark, size: 256, out: "docs/media/logo.png" },
  { svg: small, size: 16, out: "apps/extension/src/icons/icon-16.png" },
  { svg: mark, size: 32, out: "apps/extension/src/icons/icon-32.png" },
  { svg: mark, size: 48, out: "apps/extension/src/icons/icon-48.png" },
  { svg: mark, size: 128, out: "apps/extension/src/icons/icon-128.png" },
];

const browser = await chromium.launch();
try {
  for (const { svg, size, out } of outputs) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    const source = await readFile(resolve(root, svg), "utf8");
    await page.setContent(
      `<!doctype html><style>html,body{margin:0;background:transparent}` +
      `svg{display:block;width:${size}px;height:${size}px}</style>${source}`,
    );
    await page.screenshot({ path: resolve(root, out), omitBackground: true });
    await page.close();
    console.log(`${out} (${size} px) from ${svg}`);
  }
} finally {
  await browser.close();
}
