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
