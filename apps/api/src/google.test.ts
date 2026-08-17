import { describe, expect, it } from "vitest";
import {
  discoverGtmContainers,
  GoogleIntegrationDisabledError,
  googleIntegrationStatus,
  loadGoogleIntegrationConfig,
} from "./google.js";
import { routeApiRequest } from "./app.js";

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
          nextPageToken: "accounts-page-2",
        });
      }
      if (url.endsWith("/tagmanager/v2/accounts?pageToken=accounts-page-2")) {
        return jsonResponse({
          account: [{ accountId: "789", name: "Second Agency", path: "accounts/789" }],
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
          nextPageToken: "containers-page-2",
        });
      }
      if (url.endsWith("/tagmanager/v2/accounts/123/containers?pageToken=containers-page-2")) {
        return jsonResponse({
          container: [
            {
              accountId: "123",
              containerId: "457",
              publicId: "GTM-SECOND",
              name: "Client Server",
              path: "accounts/123/containers/457",
              usageContext: ["SERVER"],
            },
          ],
        });
      }
      if (url.endsWith("/tagmanager/v2/accounts/789/containers")) {
        return jsonResponse({ container: [] });
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

    expect(result.accounts).toEqual([
      { accountId: "123", name: "Agency", path: "accounts/123" },
      { accountId: "789", name: "Second Agency", path: "accounts/789" },
    ]);
    expect(result.containers).toEqual([
      {
        accountId: "123",
        containerId: "456",
        publicId: "GTM-TEST123",
        name: "Client Web",
        path: "accounts/123/containers/456",
        usageContext: ["WEB"],
      },
      {
        accountId: "123",
        containerId: "457",
        publicId: "GTM-SECOND",
        name: "Client Server",
        path: "accounts/123/containers/457",
        usageContext: ["SERVER"],
      },
    ]);
    expect(requested).toEqual([
      {
        url: "https://tagmanager.googleapis.test/tagmanager/v2/accounts",
        authorization: "Bearer ya29.test-token",
      },
      {
        url: "https://tagmanager.googleapis.test/tagmanager/v2/accounts?pageToken=accounts-page-2",
        authorization: "Bearer ya29.test-token",
      },
      {
        url: "https://tagmanager.googleapis.test/tagmanager/v2/accounts/123/containers",
        authorization: "Bearer ya29.test-token",
      },
      {
        url: "https://tagmanager.googleapis.test/tagmanager/v2/accounts/789/containers",
        authorization: "Bearer ya29.test-token",
      },
      {
        url: "https://tagmanager.googleapis.test/tagmanager/v2/accounts/123/containers?pageToken=containers-page-2",
        authorization: "Bearer ya29.test-token",
      },
    ]);
  });
});

describe("GTM discovery API authorization", () => {
  it("requires an admin bearer token before exposing GTM discovery", async () => {
    const previous = process.env.GTM_OBSERVABILITY_ADMIN_TOKEN;
    process.env.GTM_OBSERVABILITY_ADMIN_TOKEN = "admin-secret";
    try {
      await expect(
        routeApiRequest({
          method: "GET",
          url: "/api/google/gtm/accounts",
          headers: new Headers(),
          readJson: async () => ({}),
        }),
      ).resolves.toEqual({
        status: 401,
        body: { error: "Admin authorization is required for GTM discovery." },
      });
    } finally {
      if (previous === undefined) {
        delete process.env.GTM_OBSERVABILITY_ADMIN_TOKEN;
      } else {
        process.env.GTM_OBSERVABILITY_ADMIN_TOKEN = previous;
      }
    }
  });
});
