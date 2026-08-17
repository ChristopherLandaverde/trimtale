import { describe, expect, it } from "vitest";
import {
  discoverGtmContainers,
  GoogleIntegrationDisabledError,
  googleIntegrationStatus,
  loadGoogleIntegrationConfig,
} from "./google.js";

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Google integration gate", () => {
  it("stays disabled until an OAuth access token is configured", () => {
    const config = loadGoogleIntegrationConfig({});
    expect(config.enabled).toBe(false);
    expect(googleIntegrationStatus(config)).toEqual({
      enabled: false,
      baseUrl: "https://tagmanager.googleapis.com",
      requiredEnv: ["GOOGLE_OAUTH_ACCESS_TOKEN"],
    });
  });

  it("does not run GTM discovery without explicit credentials", async () => {
    await expect(discoverGtmContainers(loadGoogleIntegrationConfig({}))).rejects.toBeInstanceOf(
      GoogleIntegrationDisabledError,
    );
  });
});

describe("GTM discovery", () => {
  it("lists accounts and their containers with a bearer token", async () => {
    const requested: Array<{ url: string; authorization: string | null }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = input.toString();
      const headers = new Headers(init?.headers);
      requested.push({ url, authorization: headers.get("Authorization") });

      if (url.endsWith("/tagmanager/v2/accounts")) {
        return jsonResponse({
          account: [{ accountId: "123", name: "Agency", path: "accounts/123" }],
        });
      }
      if (url.endsWith("/tagmanager/v2/accounts/123/containers")) {
        return jsonResponse({
          container: [
            {
              accountId: "123",
              containerId: "456",
              publicId: "GTM-TEST123",
              name: "Client Web",
              path: "accounts/123/containers/456",
              usageContext: ["WEB"],
            },
          ],
        });
      }
      return new Response("not found", { status: 404 });
    };

    const result = await discoverGtmContainers(
      loadGoogleIntegrationConfig({
        GOOGLE_OAUTH_ACCESS_TOKEN: "ya29.test-token",
        GOOGLE_TAG_MANAGER_API_BASE_URL: "https://tagmanager.googleapis.test",
      }),
      fetchImpl,
    );

    expect(result.accounts).toEqual([{ accountId: "123", name: "Agency", path: "accounts/123" }]);
    expect(result.containers).toEqual([
      {
        accountId: "123",
        containerId: "456",
        publicId: "GTM-TEST123",
        name: "Client Web",
        path: "accounts/123/containers/456",
        usageContext: ["WEB"],
      },
    ]);
    expect(requested).toEqual([
      {
        url: "https://tagmanager.googleapis.test/tagmanager/v2/accounts",
        authorization: "Bearer ya29.test-token",
      },
      {
        url: "https://tagmanager.googleapis.test/tagmanager/v2/accounts/123/containers",
        authorization: "Bearer ya29.test-token",
      },
    ]);
  });
});
