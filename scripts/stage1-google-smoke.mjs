import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { chmod, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  GoogleSessionMode,
  loadGoogleEnvironment,
} from "./google-session.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const extensionPath = resolve(repositoryRoot, "apps/extension/dist");
const profilePath = resolve(repositoryRoot, ".data/stage1-google-smoke-profile");
const operationStore = resolve(repositoryRoot, ".data/stage1-google-smoke-operations.json");
const healthUrl = "http://127.0.0.1:8787/health";
const healthAttempts = 40;
const healthDelayMs = 250;
const publicContainerIdPattern = /^GTM-[A-Z0-9]+$/i;

export const STAGE1_GOOGLE_TARGET = Object.freeze({
  url: "https://consentflow-psi.vercel.app/",
  publicId: "GTM-PCJ3Q5RK",
  measurementId: "G-YV879ECLRV",
});
const recognitionUrl = `http://127.0.0.1:8787/api/google/containers/recognize?publicId=${STAGE1_GOOGLE_TARGET.publicId}`;

export function stage1SmokeEnvironment(baseEnvironment) {
  return {
    ...baseEnvironment,
    GOOGLE_GTM_CONTAINER_WRITES_ENABLED: "true",
    GOOGLE_GTM_PUBLICATION_SCOPE_REQUESTED: "true",
    GOOGLE_GTM_PUBLICATION_ENABLED: "true",
    GOOGLE_GTM_WRITE_TARGET_PUBLIC_ID: STAGE1_GOOGLE_TARGET.publicId,
    GOOGLE_ANALYTICS_WRITES_ENABLED: "false",
    TRACKING_OPERATION_STORE: operationStore,
  };
}

export function assertSmokeExtension(configuredOrigin, serviceWorkerUrl) {
  const serviceWorker = new URL(serviceWorkerUrl);
  const actualOrigin = `${serviceWorker.protocol}//${serviceWorker.host}`;
  if (actualOrigin !== configuredOrigin) {
    throw new Error("The loaded extension origin does not match the credentialed session extension origin.");
  }
}

export function assertSmokePage(pageUrl, observedPublicIds) {
  const expectedUrl = new URL(STAGE1_GOOGLE_TARGET.url);
  const actualUrl = new URL(pageUrl);
  if (actualUrl.origin !== expectedUrl.origin
    || actualUrl.pathname !== expectedUrl.pathname
    || actualUrl.search !== expectedUrl.search) {
    throw new Error("The browser did not load the exact Stage 1 website target.");
  }

  const normalized = [...new Set(observedPublicIds.map((publicId) => publicId.trim().toUpperCase()))];
  if (normalized.length !== 1
    || !publicContainerIdPattern.test(normalized[0] ?? "")
    || normalized[0] !== STAGE1_GOOGLE_TARGET.publicId) {
    throw new Error("The website does not expose the exact Stage 1 container target.");
  }
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function verifySmokeRecognition(fetcher = fetch) {
  let response;
  try {
    response = await fetcher(recognitionUrl);
  } catch {
    throw new Error("The Stage 1 container recognition request failed.");
  }
  if (!response.ok) {
    throw new Error("The Stage 1 container recognition request failed.");
  }

  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error("The Stage 1 container recognition response is invalid.");
  }
  const result = isRecord(body) && isRecord(body.result) ? body.result : undefined;
  const container = result && isRecord(result.container) ? result.container : undefined;
  if (!isRecord(body)
    || body.containerWritesEnabled !== true
    || result?.status !== "recognized"
    || String(result.publicId).toUpperCase() !== STAGE1_GOOGLE_TARGET.publicId
    || String(container?.publicId).toUpperCase() !== STAGE1_GOOGLE_TARGET.publicId) {
    throw new Error("The Stage 1 container recognition does not match the write target.");
  }
  if (!Array.isArray(result.measurementIds)
    || result.measurementIds.length !== 1
    || result.measurementIds[0] !== STAGE1_GOOGLE_TARGET.measurementId) {
    throw new Error("The Stage 1 GA4 destination does not match the declared target.");
  }
}

async function waitForApi(fetcher = fetch) {
  for (let attempt = 0; attempt < healthAttempts; attempt += 1) {
    try {
      const response = await fetcher(healthUrl);
      if (response.ok) {
        return;
      }
    } catch {
      // The local API may still be starting.
    }

    await new Promise((resolveWait) => setTimeout(resolveWait, healthDelayMs));
  }

  throw new Error("The credentialed Google API did not become ready.");
}

async function observedContainerIds(page) {
  return page.locator("script[src*='googletagmanager.com/gtm.js']").evaluateAll((scripts) =>
    scripts.flatMap((script) => {
      const source = script.getAttribute("src");
      if (!source) {
        return [];
      }
      const publicId = new URL(source, window.location.href).searchParams.get("id");
      return publicId ? [publicId] : [];
    }));
}

async function stopProcess(child) {
  if (child.exitCode !== null) {
    return;
  }

  child.kill("SIGTERM");
  await new Promise((resolveExit) => {
    child.once("exit", resolveExit);
    setTimeout(resolveExit, 2_000);
  });
}

export async function runStage1GoogleSmoke(baseEnvironment = process.env) {
  const configDirectory = baseEnvironment.GTM_OBSERVABILITY_CONFIG_DIR?.trim()
    || join(homedir(), ".config", "gtm-observability");
  const googleEnvironment = await loadGoogleEnvironment(
    configDirectory,
    baseEnvironment,
    GoogleSessionMode.Stage1,
    STAGE1_GOOGLE_TARGET.publicId,
  );
  const environment = stage1SmokeEnvironment(googleEnvironment);
  const api = spawn("npm", ["run", "start", "--workspace", "@gtm-observability/api"], {
    cwd: repositoryRoot,
    env: environment,
    stdio: "inherit",
  });
  let context;

  try {
    await waitForApi();
    await mkdir(profilePath, { recursive: true, mode: 0o700 });
    await chmod(profilePath, 0o700);
    context = await chromium.launchPersistentContext(profilePath, {
      channel: "chromium",
      headless: false,
      viewport: null,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        "--start-maximized",
      ],
    });
    const serviceWorker = context.serviceWorkers()[0]
      ?? await context.waitForEvent("serviceworker", { timeout: 10_000 });
    assertSmokeExtension(environment.EXTENSION_ORIGIN, serviceWorker.url());

    const page = context.pages()[0] ?? await context.newPage();
    await page.goto(STAGE1_GOOGLE_TARGET.url);
    assertSmokePage(page.url(), await observedContainerIds(page));
    await verifySmokeRecognition();
    await page.bringToFront();

    console.log(`Stage 1 Google workflow ready for ${STAGE1_GOOGLE_TARGET.publicId}.`);
    console.log("Use the website agent to complete setup, exact preview, version review, publication, and live verification.");
    console.log("Close Chromium to end the credentialed session.");
    await new Promise((resolveClose) => context.once("close", resolveClose));
  } finally {
    if (context) {
      await context.close().catch(() => undefined);
    }
    await stopProcess(api);
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : undefined;
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    await runStage1GoogleSmoke();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
