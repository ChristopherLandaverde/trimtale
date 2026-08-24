import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadGoogleEnvironment, resolveGoogleCommand } from "./google-session.mjs";

const temporaryDirectories: string[] = [];

async function configDir(options: {
  tokenClientId?: string;
  clientMode?: number;
} = {}): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "gtm-google-session-"));
  temporaryDirectories.push(directory);
  await chmod(directory, 0o700);
  const clientId = "client-id-sensitive";
  const clientPath = join(directory, "google-client.json");
  await writeFile(clientPath, JSON.stringify({
    web: {
      client_id: clientId,
      client_secret: "client-secret-sensitive",
    },
  }), { mode: options.clientMode ?? 0o600 });
  await writeFile(join(directory, "google-token.json"), JSON.stringify({
    schemaVersion: 1,
    clientId: options.tokenClientId ?? clientId,
    refreshToken: "refresh-token-sensitive",
  }), { mode: 0o600 });
  await writeFile(
    join(directory, "extension-origin"),
    `chrome-extension://${"a".repeat(32)}\n`,
    { mode: 0o600 },
  );
  return directory;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(
    (directory) => rm(directory, { recursive: true, force: true }),
  ));
});

describe("persistent Google session", () => {
  it("loads the bound owner-only client, token, and extension origin", async () => {
    const directory = await configDir();
    const environment = await loadGoogleEnvironment(directory, {
      GOOGLE_GTM_PUBLICATION_ENABLED: "true",
      GOOGLE_GTM_PUBLICATION_SCOPE_REQUESTED: "true",
    });

    expect(environment).toMatchObject({
      GOOGLE_OAUTH_CLIENT_ID: "client-id-sensitive",
      GOOGLE_OAUTH_CLIENT_SECRET: "client-secret-sensitive",
      GOOGLE_OAUTH_REDIRECT_URI: "http://127.0.0.1:8787/api/google/oauth/callback",
      EXTENSION_ORIGIN: `chrome-extension://${"a".repeat(32)}`,
      GOOGLE_GTM_CONTAINER_WRITES_ENABLED: "true",
      GOOGLE_OAUTH_TOKEN_STORE: join(directory, "google-token.json"),
      GOOGLE_ANALYTICS_READS_ENABLED: "true",
      GOOGLE_GTM_PUBLICATION_ENABLED: "false",
      GOOGLE_GTM_PUBLICATION_SCOPE_REQUESTED: "false",
    });
  });

  it("rejects a token bound to another client without exposing values", async () => {
    const directory = await configDir({ tokenClientId: "wrong-client-sensitive" });

    await expect(loadGoogleEnvironment(directory)).rejects.toThrow("OAuth token client binding does not match");
    await expect(loadGoogleEnvironment(directory)).rejects.not.toThrow(/sensitive/);
  });

  it("rejects credential files readable by other users", async () => {
    const directory = await configDir({ clientMode: 0o644 });

    await expect(loadGoogleEnvironment(directory)).rejects.toThrow("must use mode 0600");
  });

  it("allows only preflight and API commands", () => {
    expect(resolveGoogleCommand(["preflight"])).toEqual(["run", "preflight:google"]);
    expect(resolveGoogleCommand(["api"])).toEqual(["run", "dev:api"]);
    expect(() => resolveGoogleCommand(["publish"])).toThrow("Unknown Google session command");
    expect(() => resolveGoogleCommand(["api", "extra"])).toThrow("does not accept arguments");
  });
});
