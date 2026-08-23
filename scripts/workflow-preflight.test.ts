import { describe, expect, it } from "vitest";
import {
  evaluateGoogleReadiness,
  evaluateLocalReadiness,
  evaluatePublicationReadiness,
  formatPreflightReport,
} from "./workflow-preflight.mjs";

const requiredScripts = ["agent", "build", "check", "test", "test:e2e", "verify"];

describe("workflow preflight", () => {
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
    ]);
  });

  it("keeps production publication behind a separate exact readiness switch", () => {
    const base = {
      GOOGLE_OAUTH_CLIENT_ID: "client-id",
      GOOGLE_OAUTH_CLIENT_SECRET: "client-secret",
      GOOGLE_OAUTH_REDIRECT_URI: "http://127.0.0.1:8787/api/google/oauth/callback",
      EXTENSION_ORIGIN: `chrome-extension://${"a".repeat(32)}`,
      GOOGLE_GTM_CONTAINER_WRITES_ENABLED: "true",
    };
    expect(evaluatePublicationReadiness(base).at(-1)).toMatchObject({
      name: "production publication",
      ok: false,
    });
    expect(evaluatePublicationReadiness({
      ...base,
      GOOGLE_GTM_PUBLICATION_ENABLED: "true",
    }).every(({ ok }) => ok)).toBe(true);
  });
});
