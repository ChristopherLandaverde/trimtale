import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const requiredPackageScripts = ["agent", "build", "check", "test", "test:e2e", "verify"];

function majorVersion(value) {
  const major = Number.parseInt(value.split(".")[0] ?? "", 10);
  return Number.isFinite(major) ? major : 0;
}

function validVersion(value) {
  return /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(value);
}

export function resolveNpmVersion(result, environment = {}) {
  const subprocessVersion = result?.status === 0 ? result.stdout?.trim() ?? "" : "";
  if (validVersion(subprocessVersion)) return subprocessVersion;

  const lifecycleVersion = environment.npm_config_user_agent
    ?.match(/(?:^|\s)npm\/([^\s]+)/)?.[1] ?? "";
  return validVersion(lifecycleVersion) ? lifecycleVersion : "0";
}

function check(name, ok, passingDetail, failingDetail) {
  return { name, ok, detail: ok ? passingDetail : failingDetail };
}

export function evaluateLocalReadiness(input) {
  const missingScripts = requiredPackageScripts.filter((name) => !input.packageScripts[name]);
  return [
    check("Node.js 22+", majorVersion(input.nodeVersion) >= 22, "supported", "upgrade Node.js"),
    check("npm 10+", majorVersion(input.npmVersion) >= 10, "supported", "upgrade npm"),
    check("package lock", input.lockfilePresent, "present", "run the approved dependency install"),
    check("installed dependencies", input.dependenciesPresent, "present", "run the approved dependency install"),
    check("managed Chromium", input.chromiumPresent, "installed", "install Playwright Chromium"),
    check(
      "required package scripts",
      missingScripts.length === 0,
      "present",
      `missing ${missingScripts.join(", ")}`,
    ),
  ];
}

function configured(environment, name) {
  return Boolean(environment[name]?.trim());
}

function validOAuthCallback(value) {
  try {
    const url = new URL(value ?? "");
    return url.protocol === "http:"
      && url.hostname === "127.0.0.1"
      && url.port === "18787"
      && url.pathname === "/api/google/oauth/callback"
      && url.search === "";
  } catch {
    return false;
  }
}

function validExtensionOrigin(value) {
  return /^chrome-extension:\/\/[a-p]{32}$/.test(value?.trim() ?? "");
}

export function evaluateGoogleReadiness(environment) {
  return [
    check("OAuth client ID", configured(environment, "GOOGLE_OAUTH_CLIENT_ID"), "configured", "missing"),
    check("OAuth client secret", configured(environment, "GOOGLE_OAUTH_CLIENT_SECRET"), "configured", "missing"),
    check(
      "OAuth callback",
      validOAuthCallback(environment.GOOGLE_OAUTH_REDIRECT_URI),
      "exact local callback configured",
      "expected http://127.0.0.1:18787/api/google/oauth/callback",
    ),
    check(
      "extension origin",
      validExtensionOrigin(environment.EXTENSION_ORIGIN),
      "exact Chrome extension origin configured",
      "expected chrome-extension:// followed by the 32-character extension ID",
    ),
    check(
      "container writes",
      environment.GOOGLE_GTM_CONTAINER_WRITES_ENABLED === "true",
      "explicitly enabled",
      "set GOOGLE_GTM_CONTAINER_WRITES_ENABLED=true",
    ),
    check(
      "OAuth token persistence",
      configured(environment, "GOOGLE_OAUTH_TOKEN_STORE"),
      "owner-only refresh-token store configured",
      "set GOOGLE_OAUTH_TOKEN_STORE to a backend-local file path",
    ),
  ];
}

export function evaluatePublicationReadiness(environment) {
  return [
    ...evaluateGoogleReadiness(environment),
    check(
      "publication OAuth scope",
      environment.GOOGLE_GTM_PUBLICATION_SCOPE_REQUESTED === "true",
      "requested separately",
      "set GOOGLE_GTM_PUBLICATION_SCOPE_REQUESTED=true before the one-time consent",
    ),
    check(
      "production publication",
      environment.GOOGLE_GTM_PUBLICATION_ENABLED === "true",
      "separately enabled",
      "set GOOGLE_GTM_PUBLICATION_ENABLED=true only for an approved publication session",
    ),
  ];
}

export function formatPreflightReport(title, checks) {
  const lines = checks.map(
    ({ name, ok, detail }) => `${ok ? "PASS" : "FAIL"}  ${name}: ${detail}`,
  );
  return [title, "", ...lines, "", checks.every(({ ok }) => ok) ? "READY" : "NOT READY"].join("\n");
}

async function collectLocalReadiness() {
  const packageJson = JSON.parse(readFileSync(resolve(repositoryRoot, "package.json"), "utf8"));
  const npmResult = spawnSync("npm", ["--version"], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: process.env,
  });
  let chromiumPresent = false;
  try {
    const { chromium } = await import("@playwright/test");
    chromiumPresent = existsSync(chromium.executablePath());
  } catch {
    chromiumPresent = false;
  }

  return evaluateLocalReadiness({
    nodeVersion: process.versions.node,
    npmVersion: resolveNpmVersion(npmResult, process.env),
    lockfilePresent: existsSync(resolve(repositoryRoot, "package-lock.json")),
    dependenciesPresent: existsSync(resolve(repositoryRoot, "node_modules")),
    chromiumPresent,
    packageScripts: packageJson.scripts ?? {},
  });
}

export async function runWorkflowPreflight(mode, environment = process.env, writeOutput = console.log) {
  const checks = mode === "local"
    ? await collectLocalReadiness()
    : mode === "google"
      ? evaluateGoogleReadiness(environment)
      : mode === "publication"
        ? evaluatePublicationReadiness(environment)
      : undefined;
  if (!checks) {
    writeOutput("Unknown preflight mode. Expected 'local', 'google', or 'publication'.");
    return 2;
  }
  const title = mode === "local" ? "Local workflow preflight"
    : mode === "google" ? "Google integration preflight"
      : "Publication session preflight";
  writeOutput(formatPreflightReport(title, checks));
  return checks.every(({ ok }) => ok) ? 0 : 1;
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : undefined;
if (invokedPath === fileURLToPath(import.meta.url)) {
  process.exitCode = await runWorkflowPreflight(process.argv[2]);
}
