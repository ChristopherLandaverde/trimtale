#!/usr/bin/env node
// Step 1 of the README demo: drive the real extension on the bundled fixture site and save
// screenshots plus every string the frames quote. Output: test-results/readme-demo/run.json + PNGs.
//
// Uses the E2E harness services only: the built extension, the local API (127.0.0.1:18787) and
// the fixture site (127.0.0.1:14173), whose stand-in GA4 tag sends /g/collect to itself.
// Nothing contacts Google. See scripts/readme-demo/README.md.

import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const out = resolve(root, "test-results/readme-demo");
const extensionPath = resolve(root, "apps/extension/dist");
const request = "Track successful submissions of this form";
const testEmail = "jordan@example.test";
// The panel at its default 380 px width, made taller the way a practitioner would drag it.
const panelSize = { width: 380, height: 540 };

const services = [
  { name: "api", workspace: "@trimtale/api", health: "http://127.0.0.1:18787/health",
    env: { EXTENSION_ORIGIN: "chrome-extension://gtm-observability-e2e" } },
  { name: "fixture", workspace: "@trimtale/fixture-site", health: "http://127.0.0.1:14173/health", env: {} },
];

async function healthy(url) {
  try { return (await fetch(url)).ok; } catch { return false; }
}

async function startServices() {
  const started = [];
  for (const service of services) {
    if (await healthy(service.health)) continue;
    started.push(spawn("npm", ["run", "start", "--workspace", service.workspace], {
      cwd: root, env: { ...process.env, ...service.env }, stdio: "ignore",
    }));
    const deadline = Date.now() + 20_000;
    while (!(await healthy(service.health))) {
      if (Date.now() > deadline) throw new Error(`${service.name} did not become healthy at ${service.health}`);
      await new Promise((done) => setTimeout(done, 200));
    }
  }
  return started;
}

async function evidenceRows(finding) {
  return finding.locator("dl.evidence dt").evaluateAll((terms) =>
    terms.map((term) => ({ label: term.dataset.field, value: term.nextElementSibling?.textContent ?? "" })));
}

async function findingCopy(finding) {
  const step = (label) => finding.locator("dl.steps dt", { hasText: label }).locator("xpath=following-sibling::dd[1]").innerText();
  return {
    status: (await finding.locator(".tag").innerText()).replace(/\s+/g, " ").trim(),
    title: await finding.locator(".finding-title").innerText(),
    observed: await step("Observed"),
    why: await step("Why"),
    fix: await step("Fix"),
    verify: await step("Verify"),
  };
}

/** Runs one confirmed lead-form journey and captures it. */
async function journey(name, scenario, { exportSetup = false } = {}) {
  const profile = await mkdtemp(join(tmpdir(), "trimtale-readme-demo-"));
  const context = await chromium.launchPersistentContext(profile, {
    channel: "chromium",
    headless: true,
    // Wide enough that the panel (bottom right) never overlaps the forms in the page crop.
    viewport: { width: 1600, height: 800 },
    acceptDownloads: true,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  const result = { scenario, url: `http://127.0.0.1:14173/?formScenario=${scenario}` };
  try {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker");
    await worker.evaluate((size) => chrome.storage.local.set({ overlayPreferences: { ...size, collapsed: true } }), panelSize);
    const page = await context.newPage();
    // Playwright's own record of what left the browser, independent of the extension.
    const collected = [];
    page.on("request", (sent) => { if (new URL(sent.url()).pathname === "/g/collect") collected.push(sent.url()); });
    await page.goto(result.url);
    const assistant = page.locator("#trimtale-root");
    const panel = assistant.locator("section.assistant");
    const form = page.locator("form#contact");
    // Crop of the page around both fixture forms, the left-hand "page" card in the frames.
    const pageClip = async (file) => {
      const boxes = await page.locator("form, #contact-success:not([hidden])").evaluateAll((forms) => forms.map((item) => {
        const rect = item.getBoundingClientRect();
        return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
      }));
      const left = Math.max(0, Math.min(...boxes.map((box) => box.left)) - 24);
      const top = Math.max(0, Math.min(...boxes.map((box) => box.top)) - 36);
      // Stop short of the assistant panel; the panel is captured on its own.
      const panelBox = await panel.boundingBox();
      const right = Math.min(Math.max(...boxes.map((box) => box.right)) + 24, (panelBox?.x ?? Infinity) - 12);
      const bottom = Math.max(...boxes.map((box) => box.bottom)) + 24;
      await page.screenshot({ path: join(out, file), clip: { x: left, y: top, width: right - left, height: bottom - top }, animations: "disabled" });
    };

    await assistant.getByRole("button", { name: "Open tracking assistant" }).click();
    await assistant.getByLabel("Tracking request").fill(request);
    await assistant.getByRole("button", { name: "Send request" }).click();
    await assistant.getByRole("button", { name: "Contact sales", exact: true }).waitFor();
    result.formsFound = await page.locator("#trimtale-targets .target.candidate").count();
    result.formQuestion = await assistant.locator(".message").filter({ hasText: /I found \d+ forms?/ }).last().innerText();
    await assistant.getByRole("button", { name: "Contact sales", exact: true }).click();
    await page.locator("#trimtale-targets .target.confirmed[data-target-id='contact']").waitFor();
    result.formMarkup = await form.evaluate((element) => element.outerHTML);
    await assistant.getByRole("button", { name: "Review setup" }).click();
    await assistant.getByText(/Event: generate_lead/).waitFor();
    await page.mouse.move(0, 0);
    if (exportSetup) {
      await pageClip(`${name}-target-page.png`);
      await panel.screenshot({ path: join(out, `${name}-target-panel.png`), animations: "disabled" });
      result.draft = await assistant.locator(".message").filter({ hasText: "Draft specification" }).last().innerText();
    }
    await assistant.getByRole("button", { name: "Confirm setup" }).click();
    if (exportSetup) {
      const download = page.waitForEvent("download");
      await assistant.getByRole("button", { name: "Download GTM setup" }).click();
      const file = await download;
      result.exportName = file.suggestedFilename();
      const exported = JSON.parse(readFileSync(await file.path(), "utf8"));
      const tag = exported.containerVersion.tag[0];
      result.exportTag = {
        name: tag.name,
        eventName: tag.parameter.find((item) => item.key === "eventName")?.value,
        measurementId: tag.parameter.find((item) => item.key === "measurementId")?.value,
        eventParameters: tag.parameter.find((item) => item.key === "eventParameters")?.list.map((entry) =>
          Object.fromEntries(entry.map.map((pair) => [pair.key, pair.value]))),
      };
    }
    await assistant.getByRole("button", { name: "Start verification" }).click();
    await assistant.getByText(/Verification is ready/).waitFor();

    await form.locator("input[type='email']").fill(testEmail);
    await form.locator("button[type='submit']").click();
    const finding = assistant.locator("article.finding").last();
    await finding.waitFor({ timeout: 10_000 });
    await page.waitForTimeout(400);
    result.verdictCode = await finding.getAttribute("data-verdict-code");
    result.finding = await findingCopy(finding);
    await finding.evaluate((element) => element.scrollIntoView({ block: "start" }));
    await page.mouse.move(0, 0);
    await pageClip(`${name}-submitted-page.png`);
    await panel.screenshot({ path: join(out, `${name}-finding-panel.png`), animations: "disabled" });

    await finding.getByRole("button", { name: "Show evidence" }).click();
    result.evidence = await evidenceRows(finding);
    await finding.locator('dl.evidence dt[data-field="runId"]').evaluate((row) => row.scrollIntoView({ block: "end" }));
    await page.waitForTimeout(200);
    await panel.screenshot({ path: join(out, `${name}-evidence-panel.png`), animations: "disabled" });
    result.collected = collected;
    result.successMessage = await page.locator("#contact-success").innerText().catch(() => "");
    return result;
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
}

if (!existsSync(join(extensionPath, "manifest.json"))) throw new Error("Build first: npm run build");
await mkdir(out, { recursive: true });
const children = await startServices();
try {
  const fixed = await journey("fixed", "ajax_success", { exportSetup: true });
  const broken = await journey("broken", "missing_required_parameter");
  const run = { capturedAt: new Date().toISOString(), request, testEmail, panelSize, fixed, broken };
  await writeFile(join(out, "run.json"), `${JSON.stringify(run, null, 2)}\n`);
  console.log(`Captured ${fixed.verdictCode} and ${broken.verdictCode} runs into ${out}`);
} finally {
  for (const child of children) child.kill();
}
