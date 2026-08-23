import { describe, expect, it } from "vitest";
import {
  evaluateGoogleReadiness,
  evaluateLocalReadiness,
  evaluatePublicationReadiness,
  formatPreflightReport,
  resolveNpmVersion,
} from "./workflow-preflight.mjs";

const requiredScripts = ["agent", "build", "check", "test", "test:e2e", "verify"];

describe("workflow preflight", () => {
  it("prefers npm version subprocess output when it is available", () => {
    expect(resolveNpmVersion(
      { status: 0, stdout: "10.9.8\n" },
      { npm_config_user_agent: "npm/11.2.0 node/v22.23.1 linux x64" },
    )).toBe("10.9.8");
  });

  it("uses npm lifecycle metadata when a managed sandbox suppresses subprocess output", () => {
    expect(resolveNpmVersion(
      { status: 0, stdout: "", error: { code: "EPERM" } },
      { npm_config_user_agent: "npm/10.9.8 node/v22.23.1 linux x64" },
    )).toBe("10.9.8");
  });

  it.each([
    [{ status: 1, stdout: "" }, {}],
    [{ status: 0, stdout: "" }, { npm_config_user_agent: "node/v22.23.1 linux x64" }],
    [{ status: 0, stdout: "not-a-version" }, { npm_config_user_agent: "npm/not-a-version node/v22.23.1" }],
  ])("fails closed when npm version evidence is unavailable or malformed", (result, environment) => {
    expect(resolveNpmVersion(result, environment)).toBe("0");
  });

  it("accepts a complete local workflow environment", () => {
    const checks = evaluateLocalReadiness({
      nodeVersion: "22.23.1",
      npmVersion: "10.9.2",
      lockfilePresent: true,
      dependenciesPresent: true,
      chromiumPresent: true,
      packageScripts: Object.fromEntries(requiredScripts.map((name) => [name, "command"])),
    });

    expect(checks.every((check) => check.ok)).toBe(true);
  });

  it("reports every missing local prerequisite", () => {
    const checks = evaluateLocalReadiness({
      nodeVersion: "20.0.0",
      npmVersion: "9.0.0",
      lockfilePresent: false,
      dependenciesPresent: false,
      chromiumPresent: false,
      packageScripts: {},
    });

    expect(checks.filter((check) => !check.ok).map((check) => check.name)).toEqual([
      "Node.js 22+",
      "npm 10+",
      "package lock",
      "installed dependencies",
      "managed Chromium",
      "required package scripts",
    ]);
  });

  it("accepts exact Google integration configuration without exposing values", () => {
    const environment = {
      GOOGLE_OAUTH_CLIENT_ID: "client-id-sensitive",
      GOOGLE_OAUTH_CLIENT_SECRET: "client-secret-sensitive",
      GOOGLE_OAUTH_REDIRECT_URI: "http://127.0.0.1:8787/api/google/oauth/callback",
      EXTENSION_ORIGIN: `chrome-extension://${"a".repeat(32)}`,
      GOOGLE_GTM_CONTAINER_WRITES_ENABLED: "true",
      GOOGLE_OAUTH_TOKEN_STORE: "/var/lib/gtm-observability/google-oauth.json",
    };
    const checks = evaluateGoogleReadiness(environment);
    const report = formatPreflightReport("Google integration preflight", checks);

    expect(checks.every((check) => check.ok)).toBe(true);
    expect(report).not.toContain(environment.GOOGLE_OAUTH_CLIENT_ID);
    expect(report).not.toContain(environment.GOOGLE_OAUTH_CLIENT_SECRET);
  });

  it("fails closed for incomplete or permissive Google configuration", () => {
    const checks = evaluateGoogleReadiness({
      GOOGLE_OAUTH_CLIENT_ID: "client-id",
      GOOGLE_OAUTH_CLIENT_SECRET: "",
      GOOGLE_OAUTH_REDIRECT_URI: "https://attacker.example/callback",
      EXTENSION_ORIGIN: "*",
      GOOGLE_GTM_CONTAINER_WRITES_ENABLED: "TRUE",
    });

    expect(checks.filter((check) => !check.ok).map((check) => check.name)).toEqual([
      "OAuth client secret",
      "OAuth callback",
      "extension origin",
      "container writes",
      "OAuth token persistence",
    ]);
  });

  it("keeps production publication behind a separate exact readiness switch", () => {
    const base = {
      GOOGLE_OAUTH_CLIENT_ID: "client-id",
      GOOGLE_OAUTH_CLIENT_SECRET: "client-secret",
      GOOGLE_OAUTH_REDIRECT_URI: "http://127.0.0.1:8787/api/google/oauth/callback",
      EXTENSION_ORIGIN: `chrome-extension://${"a".repeat(32)}`,
      GOOGLE_GTM_CONTAINER_WRITES_ENABLED: "true",
      GOOGLE_OAUTH_TOKEN_STORE: "/var/lib/gtm-observability/google-oauth.json",
    };
    expect(evaluatePublicationReadiness(base).filter(({ ok }) => !ok).map(({ name }) => name)).toEqual([
      "publication OAuth scope",
      "production publication",
    ]);
    expect(evaluatePublicationReadiness({
      ...base,
      GOOGLE_GTM_PUBLICATION_SCOPE_REQUESTED: "true",
      GOOGLE_GTM_PUBLICATION_ENABLED: "true",
    }).every(({ ok }) => ok)).toBe(true);
  });
});
