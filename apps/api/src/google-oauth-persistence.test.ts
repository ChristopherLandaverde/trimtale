import { chmodSync, existsSync, readFileSync, statSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FileGoogleOAuthTokenStore, GoogleOAuthSession } from "./google.js";

const config = {
  clientId: "client-id",
  clientSecret: "client-secret",
  redirectUri: "http://127.0.0.1:8787/api/google/oauth/callback",
};
const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function tokenStore() {
  const directory = await mkdtemp(join(tmpdir(), "google-oauth-store-"));
  directories.push(directory);
  return new FileGoogleOAuthTokenStore(join(directory, "google-oauth.json"), config.clientId);
}

describe("persistent Google OAuth refresh tokens", () => {
  it("persists only the refresh credential atomically with owner-only permissions", async () => {
    const store = await tokenStore();
    store.save("refresh-sentinel");

    expect(store.load()).toBe("refresh-sentinel");
    expect(statSync(store.filePath).mode & 0o777).toBe(0o600);
    expect(readFileSync(store.filePath, "utf8")).not.toContain("access-sentinel");
    expect(() => new FileGoogleOAuthTokenStore(store.filePath, "different-client").load())
      .toThrow("invalid for this OAuth client");

    chmodSync(store.filePath, 0o644);
    expect(() => store.load()).toThrow("must not be readable by group or other users");
  });

  it("restores a session after restart and exchanges the saved refresh token", async () => {
    const store = await tokenStore();
    const authorizeFetch = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
      access_token: "access-sentinel",
      expires_in: 3600,
      refresh_token: "refresh-sentinel",
      token_type: "Bearer",
    }));
    const first = new GoogleOAuthSession(config, authorizeFetch, () => 1_000, true, true, store);
    const authorization = new URL(first.authorizationUrl());
    await first.authorize("authorization-code", authorization.searchParams.get("state") ?? "");

    const refreshFetch = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
      access_token: "renewed-access",
      expires_in: 3600,
      token_type: "Bearer",
    }));
    const restored = new GoogleOAuthSession(config, refreshFetch, () => 2_000, true, true, store);
    expect(restored.isConnected()).toBe(true);
    expect(await restored.accessToken()).toBe("renewed-access");
    const refreshBody = new URLSearchParams(String(refreshFetch.mock.calls[0]?.[1]?.body));
    expect(refreshBody.get("refresh_token")).toBe("refresh-sentinel");
    expect(store.load()).toBe("refresh-sentinel");
  });

  it("fails closed and removes a refresh token rejected by Google", async () => {
    const store = await tokenStore();
    store.save("revoked-refresh");
    const session = new GoogleOAuthSession(
      config,
      vi.fn<typeof fetch>().mockResolvedValue(Response.json({ error: "invalid_grant" }, { status: 400 })),
      Date.now,
      true,
      true,
      store,
    );

    await expect(session.accessToken()).rejects.toThrow("invalid_grant");
    expect(session.isConnected()).toBe(false);
    expect(existsSync(store.filePath)).toBe(false);
  });
});
