import { describe, expect, it } from "vitest";
import {
  authorizationCode,
  authorizationUrl,
  pkceChallenge,
  productOAuthConfig,
} from "./product-auth.js";

describe("product OAuth boundary", () => {
  it("requires exact HTTPS public-client configuration", () => {
    expect(productOAuthConfig({
      authorizationEndpoint: "https://example.clerk.accounts.dev/oauth/authorize",
      tokenEndpoint: "https://example.clerk.accounts.dev/oauth/token",
      revocationEndpoint: "https://example.clerk.accounts.dev/oauth/revoke",
      clientId: "client_public_1",
      scope: "openid   user:org:read offline_access",
    })).toEqual({
      authorizationEndpoint: "https://example.clerk.accounts.dev/oauth/authorize",
      tokenEndpoint: "https://example.clerk.accounts.dev/oauth/token",
      revocationEndpoint: "https://example.clerk.accounts.dev/oauth/revoke",
      clientId: "client_public_1",
      scope: "openid user:org:read offline_access",
    });
    expect(productOAuthConfig({
      authorizationEndpoint: "http://example.test/authorize",
      tokenEndpoint: "https://example.test/token",
      revocationEndpoint: "",
      clientId: "client",
      scope: "openid",
    })).toBeUndefined();
  });

  it("builds a PKCE authorization request without a client secret", async () => {
    const config = productOAuthConfig({
      authorizationEndpoint: "https://example.clerk.accounts.dev/oauth/authorize",
      tokenEndpoint: "https://example.clerk.accounts.dev/oauth/token",
      revocationEndpoint: "",
      clientId: "client_public_1",
      scope: "openid user:org:read offline_access",
    })!;
    const challenge = await pkceChallenge("test-verifier");
    const url = new URL(authorizationUrl({
      config,
      redirectUri: "https://extension.chromiumapp.org/clerk",
      state: "exact-state",
      challenge,
    }));
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      client_id: "client_public_1",
      redirect_uri: "https://extension.chromiumapp.org/clerk",
      response_type: "code",
      scope: "openid user:org:read offline_access",
      state: "exact-state",
      code_challenge: challenge,
      code_challenge_method: "S256",
    });
    expect(url.searchParams.has("client_secret")).toBe(false);
  });

  it("accepts only the exact redirect and state", () => {
    const expected = "https://extension.chromiumapp.org/clerk";
    expect(authorizationCode(`${expected}?code=code_123&state=state_123`, expected, "state_123"))
      .toBe("code_123");
    expect(authorizationCode(`${expected}?code=code_123&state=wrong`, expected, "state_123"))
      .toBeUndefined();
    expect(authorizationCode("https://attacker.test/clerk?code=code_123&state=state_123", expected, "state_123"))
      .toBeUndefined();
    expect(authorizationCode(`${expected}?error=access_denied&state=state_123`, expected, "state_123"))
      .toBeUndefined();
    expect(authorizationCode(`${expected}?code=one&code=two&state=state_123`, expected, "state_123"))
      .toBeUndefined();
    expect(authorizationCode(`${expected}?code=code_123&state=state_123#token`, expected, "state_123"))
      .toBeUndefined();
  });
});
