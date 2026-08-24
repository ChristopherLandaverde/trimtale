import { spawnSync } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const oauthCallback = "http://127.0.0.1:8787/api/google/oauth/callback";
const commands = {
  api: ["run", "dev:api"],
  preflight: ["run", "preflight:google"],
};

async function readPrivateFile(path, label) {
  let details;
  try {
    details = await stat(path);
  } catch {
    throw new Error(`${label} is missing from the Google config directory.`);
  }
  if (!details.isFile() || (details.mode & 0o777) !== 0o600) {
    throw new Error(`${label} must use mode 0600.`);
  }
  return readFile(path, "utf8");
}

function parseJson(value, label) {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`${label} is not valid JSON.`);
  }
}

export async function loadGoogleEnvironment(
  configDirectory = join(homedir(), ".config", "gtm-observability"),
  baseEnvironment = process.env,
) {
  const clientPath = join(configDirectory, "google-client.json");
  const tokenPath = join(configDirectory, "google-token.json");
  const originPath = join(configDirectory, "extension-origin");
  const clientFile = parseJson(
    await readPrivateFile(clientPath, "Google OAuth client"),
    "Google OAuth client",
  );
  const client = clientFile.web ?? clientFile.installed;
  if (!client
    || typeof client.client_id !== "string"
    || client.client_id.length === 0
    || typeof client.client_secret !== "string"
    || client.client_secret.length === 0) {
    throw new Error("Google OAuth client is missing its ID or secret.");
  }
  const token = parseJson(
    await readPrivateFile(tokenPath, "Google OAuth token"),
    "Google OAuth token",
  );
  if (token.schemaVersion !== 1
    || typeof token.clientId !== "string"
    || typeof token.refreshToken !== "string"
    || token.refreshToken.length === 0) {
    throw new Error("Google OAuth token is invalid.");
  }
  if (token.clientId !== client.client_id) {
    throw new Error("OAuth token client binding does not match the configured client.");
  }
  const extensionOrigin = (await readPrivateFile(originPath, "Extension origin")).trim();
  if (!/^chrome-extension:\/\/[a-p]{32}$/.test(extensionOrigin)) {
    throw new Error("Extension origin is invalid.");
  }

  return {
    ...baseEnvironment,
    GOOGLE_OAUTH_CLIENT_ID: client.client_id,
    GOOGLE_OAUTH_CLIENT_SECRET: client.client_secret,
    GOOGLE_OAUTH_REDIRECT_URI: oauthCallback,
    EXTENSION_ORIGIN: extensionOrigin,
    GOOGLE_GTM_CONTAINER_WRITES_ENABLED: "true",
    GOOGLE_OAUTH_TOKEN_STORE: tokenPath,
    GOOGLE_ANALYTICS_READS_ENABLED: "true",
    GOOGLE_GTM_PUBLICATION_SCOPE_REQUESTED: "false",
    GOOGLE_GTM_PUBLICATION_ENABLED: "false",
  };
}

export function resolveGoogleCommand(args) {
  const [name, ...extraArgs] = args;
  if (!name || !Object.hasOwn(commands, name)) {
    throw new Error(`Unknown Google session command: ${name ?? "missing"}.`);
  }
  if (extraArgs.length > 0) {
    throw new Error(`Google session command '${name}' does not accept arguments.`);
  }
  return commands[name];
}

export async function dispatchGoogleCommand(
  args,
  baseEnvironment = process.env,
  executor = spawnSync,
) {
  const command = resolveGoogleCommand(args);
  const configDirectory = baseEnvironment.GTM_OBSERVABILITY_CONFIG_DIR?.trim()
    || join(homedir(), ".config", "gtm-observability");
  const environment = await loadGoogleEnvironment(configDirectory, baseEnvironment);
  const result = executor("npm", command, {
    cwd: repositoryRoot,
    env: environment,
    stdio: "inherit",
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status === null) {
    throw new Error("Google session command ended without an exit status.");
  }
  return result.status;
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : undefined;
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = await dispatchGoogleCommand(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  }
}
