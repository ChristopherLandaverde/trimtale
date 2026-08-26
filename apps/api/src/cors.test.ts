import { describe, expect, it } from "vitest";
import { corsDecision } from "./cors.js";

describe("API CORS boundary", () => {
  const googleAccountsPath = "/api/google/accounts";
  const extensionOrigin = "chrome-extension://abcdefghijklmnop";

  it("fails closed for browser origins when the extension origin is unconfigured", () => {
    for (const pathname of [
      googleAccountsPath,
      "/api/google/accounts/1/containers/2/context",
      "/api/google/containers/recognize",
      "/api/google/containers/prepare-workspace",
      "/api/google/workflows/plan",
      "/api/google/workflows/operation_spec_123/resume",
      "/api/google/workflows/operation_spec_123/verify-draft",
      "/api/google/workflows/operation_spec_123/approve-publication",
      "/api/google/workflows/operation_spec_123/publish",
      "/api/intake-evaluations",
      "/api/intake-evaluations/intake_report_123",
      "/api/setup-authoring",
    ]) {
      expect(corsDecision(pathname, "https://attacker.example", undefined)).toEqual({
        allowed: false,
      });
      expect(corsDecision(pathname, "https://attacker.example", "*")).toEqual({
        allowed: false,
      });
    }
  });

  it("allows and echoes only the exactly configured extension origin", () => {
    expect(corsDecision(googleAccountsPath, extensionOrigin, extensionOrigin)).toEqual({
      allowed: true,
      allowOrigin: extensionOrigin,
    });
    expect(corsDecision(googleAccountsPath, "https://attacker.example", extensionOrigin)).toEqual({
      allowed: false,
    });
    expect(corsDecision(googleAccountsPath, `${extensionOrigin}.attacker`, extensionOrigin)).toEqual({
      allowed: false,
    });
  });

  it("allows non-browser Google callbacks without granting cross-origin read access", () => {
    expect(corsDecision("/api/google/oauth/callback", undefined, extensionOrigin)).toEqual({
      allowed: true,
    });
  });

  it("protects model-comparison reports with the exact extension origin", () => {
    for (const pathname of [
      "/api/intake-evaluations",
      "/api/intake-evaluations/intake_report_123",
    ]) {
      expect(corsDecision(pathname, extensionOrigin, extensionOrigin)).toEqual({
        allowed: true,
        allowOrigin: extensionOrigin,
      });
      expect(corsDecision(pathname, undefined, extensionOrigin)).toEqual({ allowed: true });
      expect(corsDecision(pathname, "https://attacker.example", extensionOrigin)).toEqual({ allowed: false });
      expect(corsDecision(pathname, `${extensionOrigin}.attacker`, extensionOrigin)).toEqual({ allowed: false });
      expect(corsDecision(pathname, extensionOrigin, "*")).toEqual({ allowed: false });
      expect(corsDecision(pathname, extensionOrigin, "null")).toEqual({ allowed: false });
    }
  });

  it("protects setup authoring with the exact extension origin", () => {
    expect(corsDecision("/api/setup-authoring", extensionOrigin, extensionOrigin)).toEqual({
      allowed: true,
      allowOrigin: extensionOrigin,
    });
    expect(corsDecision("/api/setup-authoring", "https://attacker.example", extensionOrigin))
      .toEqual({ allowed: false });
  });

  it("preserves the public CORS behavior of non-Google local routes", () => {
    expect(corsDecision("/health", "https://example.test", undefined)).toEqual({
      allowed: true,
      allowOrigin: "*",
    });
    expect(corsDecision("/api/setups", extensionOrigin, undefined)).toEqual({
      allowed: true,
      allowOrigin: "*",
    });
  });
});
