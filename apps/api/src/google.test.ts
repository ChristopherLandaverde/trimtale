import { describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  GoogleOAuthSession,
  AnalyticsDiscoveryClient,
  GtmDiscoveryClient,
  GOOGLE_ANALYTICS_READONLY_SCOPE,
  GOOGLE_ANALYTICS_EDIT_SCOPE,
  GTM_EDIT_CONTAINERS_SCOPE,
  GTM_READONLY_SCOPE,
  googleOAuthConfig,
} from "./google.js";

const config = {
  clientId: "client-id",
  clientSecret: "client-secret",
  redirectUri: "http://127.0.0.1:8787/api/google/oauth/callback",
  containerWritesEnabled: false,
  workspaceWritesEnabled: false,
  workspaceContainerPath: undefined,
  entityWritesEnabled: false,
  entityWorkspacePath: undefined,
  trackingSetupWritesEnabled: false,
  trackingSetupContainerPath: undefined,
  analyticsDiscoveryEnabled: false,
  analyticsAccountProvisioningEnabled: false,
  analyticsProvisioningRedirectUri: undefined,
  analyticsSetupWritesEnabled: false,
  tokenFile: undefined,
};

describe("Google OAuth configuration", () => {
  it("is disabled unless every credential variable is present", () => {
    expect(googleOAuthConfig({})).toBeUndefined();
    expect(
      googleOAuthConfig({
        GOOGLE_OAUTH_CLIENT_ID: "client-id",
        GOOGLE_OAUTH_CLIENT_SECRET: "client-secret",
        GOOGLE_OAUTH_REDIRECT_URI: config.redirectUri,
      }),
    ).toEqual(config);
  });

  it("requests container edit access only when explicitly enabled", () => {
    const session = new GoogleOAuthSession({ ...config, containerWritesEnabled: true });
    const authorization = new URL(session.authorizationUrl());

    expect(authorization.searchParams.get("scope")?.split(" ")).toEqual([
      GTM_READONLY_SCOPE,
      GTM_EDIT_CONTAINERS_SCOPE,
    ]);
  });

  it("uses the same narrow edit scope for explicitly enabled workspace writes", () => {
    const session = new GoogleOAuthSession({ ...config, workspaceWritesEnabled: true });
    const authorization = new URL(session.authorizationUrl());

    expect(authorization.searchParams.get("scope")?.split(" ")).toEqual([
      GTM_READONLY_SCOPE,
      GTM_EDIT_CONTAINERS_SCOPE,
    ]);
  });

  it("uses the edit scope for explicitly enabled entity writes", () => {
    const session = new GoogleOAuthSession({ ...config, entityWritesEnabled: true });
    const authorization = new URL(session.authorizationUrl());

    expect(authorization.searchParams.get("scope")).toContain(GTM_EDIT_CONTAINERS_SCOPE);
  });

  it("uses the edit scope for practitioner-approved tracking setup writes", () => {
    const session = new GoogleOAuthSession({ ...config, trackingSetupWritesEnabled: true });
    const authorization = new URL(session.authorizationUrl());

    expect(authorization.searchParams.get("scope")).toContain(GTM_EDIT_CONTAINERS_SCOPE);
  });

  it("requests read-only Analytics access only when discovery is enabled", () => {
    const session = new GoogleOAuthSession({ ...config, analyticsDiscoveryEnabled: true });
    const authorization = new URL(session.authorizationUrl());

    expect(authorization.searchParams.get("scope")?.split(" ")).toEqual([
      GTM_READONLY_SCOPE,
      GOOGLE_ANALYTICS_READONLY_SCOPE,
    ]);
  });

  it("requests Analytics edit access only when account provisioning is enabled", () => {
    const session = new GoogleOAuthSession({
      ...config,
      analyticsDiscoveryEnabled: true,
      analyticsAccountProvisioningEnabled: true,
    });
    const authorization = new URL(session.authorizationUrl());

    expect(authorization.searchParams.get("scope")?.split(" ")).toEqual([
      GTM_READONLY_SCOPE,
      GOOGLE_ANALYTICS_EDIT_SCOPE,
    ]);
  });

  it("requests Analytics edit access when property and stream writes are enabled", () => {
    const session = new GoogleOAuthSession({
      ...config,
      analyticsDiscoveryEnabled: true,
      analyticsSetupWritesEnabled: true,
    });
    const authorization = new URL(session.authorizationUrl());

    expect(authorization.searchParams.get("scope")?.split(" ")).toEqual([
      GTM_READONLY_SCOPE,
      GOOGLE_ANALYTICS_EDIT_SCOPE,
    ]);
  });

  it("requests offline read-only access and rejects a reused state", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        access_token: "access-token",
        expires_in: 3600,
        refresh_token: "refresh-token",
        token_type: "Bearer",
      }),
    );
    const session = new GoogleOAuthSession(config, fetcher);
    const authorization = new URL(session.authorizationUrl());
    const state = authorization.searchParams.get("state") ?? "";

    expect(authorization.searchParams.get("scope")).toBe(GTM_READONLY_SCOPE);
    expect(authorization.searchParams.get("access_type")).toBe("offline");
    await session.authorize("authorization-code", state);
    await expect(session.authorize("authorization-code", state)).rejects.toThrow("already used");
    expect(await session.accessToken()).toBe("access-token");
  });

  it("persists only the refresh token and restores it after a restart", async () => {
    const directory = mkdtempSync(join(tmpdir(), "gtmo-oauth-"));
    const tokenFile = join(directory, "google-token.json");
    try {
      const authorizeFetcher = vi.fn<typeof fetch>().mockResolvedValue(
        Response.json({
          access_token: "access-token-that-must-not-be-persisted",
          expires_in: 3600,
          refresh_token: "persistent-refresh-token",
          token_type: "Bearer",
        }),
      );
      const firstSession = new GoogleOAuthSession({ ...config, tokenFile }, authorizeFetcher);
      const authorization = new URL(firstSession.authorizationUrl());
      await firstSession.authorize("authorization-code", authorization.searchParams.get("state") ?? "");

      expect(JSON.parse(readFileSync(tokenFile, "utf8"))).toEqual({
        refreshToken: "persistent-refresh-token",
      });
      expect(statSync(tokenFile).mode & 0o777).toBe(0o600);

      const refreshFetcher = vi.fn<typeof fetch>().mockResolvedValue(
        Response.json({ access_token: "refreshed-access-token", expires_in: 3600, token_type: "Bearer" }),
      );
      const restartedSession = new GoogleOAuthSession({ ...config, tokenFile }, refreshFetcher);

      expect(restartedSession.isConnected()).toBe(true);
      expect(await restartedSession.accessToken()).toBe("refreshed-access-token");
      expect(refreshFetcher).toHaveBeenCalledTimes(1);
      expect((refreshFetcher.mock.calls[0]?.[1]?.body as URLSearchParams).get("refresh_token"))
        .toBe("persistent-refresh-token");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

describe("read-only Google Analytics discovery", () => {
  it("lists accessible properties and keeps only web streams with measurement IDs", async () => {
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const url = new URL(input.toString());
      if (url.pathname.endsWith("/accountSummaries")) {
        return Response.json({
          accountSummaries: [{
            account: "accounts/1",
            displayName: "Agency",
            propertySummaries: [{ property: "properties/100", displayName: "Website" }],
          }],
        });
      }
      return Response.json({
        dataStreams: [
          {
            name: "properties/100/dataStreams/7",
            type: "WEB_DATA_STREAM",
            displayName: "Production web",
            webStreamData: { measurementId: "G-REAL123", defaultUri: "https://example.com" },
          },
          { name: "properties/100/dataStreams/8", type: "ANDROID_APP_DATA_STREAM", displayName: "Android" },
        ],
      });
    });
    const client = new AnalyticsDiscoveryClient(async () => "token", fetcher);

    const result = await client.discover();

    expect(result[0]?.properties[0]?.webStreams).toEqual([{
      name: "properties/100/dataStreams/7",
      displayName: "Production web",
      measurementId: "G-REAL123",
      defaultUri: "https://example.com",
    }]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("requests a terms ticket without creating the Analytics account", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({ accountTicketId: "ticket-123" }),
    );
    const client = new AnalyticsDiscoveryClient(async () => "token", fetcher);

    const result = await client.provisionAccountTicket(
      "ConsentFlow Verification",
      "us",
      "http://127.0.0.1:8787/api/google/analytics/provisioning/callback",
    );

    expect(result).toEqual({
      accountTicketId: "ticket-123",
      termsUrl: "https://analytics.google.com/analytics/web/?provisioningSignup=false#/termsofservice/ticket-123",
    });
    expect(JSON.parse(fetcher.mock.calls[0]?.[1]?.body as string)).toEqual({
      account: { displayName: "ConsentFlow Verification", regionCode: "US" },
      redirectUri: "http://127.0.0.1:8787/api/google/analytics/provisioning/callback",
    });
  });

  it("creates a ConsentFlow Analytics property and its web data stream", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({
        name: "properties/123",
        parent: "accounts/1",
        displayName: "ConsentFlow Verification",
        timeZone: "America/New_York",
        currencyCode: "USD",
      }))
      .mockResolvedValueOnce(Response.json({
        name: "properties/123/dataStreams/456",
        type: "WEB_DATA_STREAM",
        displayName: "ConsentFlow web",
        webStreamData: {
          measurementId: "G-CONSENT123",
          defaultUri: "https://consentflow-psi.vercel.app/",
        },
      }));
    const client = new AnalyticsDiscoveryClient(async () => "token", fetcher);

    const result = await client.createPropertyWithWebStream(
      "accounts/1",
      "ConsentFlow Verification",
      "America/New_York",
      "usd",
      "ConsentFlow web",
      "https://consentflow-psi.vercel.app",
    );

    expect(result.webStream.measurementId).toBe("G-CONSENT123");
    expect(fetcher.mock.calls.map((call) => call[0].toString())).toEqual([
      "https://analyticsadmin.googleapis.com/v1beta/properties",
      "https://analyticsadmin.googleapis.com/v1beta/properties/123/dataStreams",
    ]);
    expect(JSON.parse(fetcher.mock.calls[0]?.[1]?.body as string)).toEqual({
      parent: "accounts/1",
      displayName: "ConsentFlow Verification",
      timeZone: "America/New_York",
      currencyCode: "USD",
    });
    expect(JSON.parse(fetcher.mock.calls[1]?.[1]?.body as string)).toEqual({
      type: "WEB_DATA_STREAM",
      displayName: "ConsentFlow web",
      webStreamData: { defaultUri: "https://consentflow-psi.vercel.app/" },
    });
  });

  it("rejects an unsafe Analytics setup before calling Google", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const client = new AnalyticsDiscoveryClient(async () => "token", fetcher);

    await expect(client.createPropertyWithWebStream(
      "accounts/1",
      "ConsentFlow Verification",
      "America/New_York",
      "USD",
      "ConsentFlow web",
      "http://production.example.com",
    )).rejects.toThrow("valid HTTPS URL");
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("read-only GTM discovery", () => {
  it("lists every account and its containers across pages", async () => {
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const url = new URL(input.toString());
      if (url.pathname.endsWith("/accounts") && !url.searchParams.has("pageToken")) {
        return Response.json({
          account: [{ accountId: "1", name: "Agency", path: "accounts/1" }],
          nextPageToken: "next",
        });
      }
      if (url.pathname.endsWith("/accounts")) {
        return Response.json({ account: [{ accountId: "2", name: "Client", path: "accounts/2" }] });
      }
      const accountId = url.pathname.includes("accounts/1") ? "1" : "2";
      return Response.json({
        container: [
          {
            accountId,
            containerId: `${accountId}0`,
            name: `${accountId} container`,
            path: `accounts/${accountId}/containers/${accountId}0`,
            publicId: `GTM-${accountId}`,
            usageContext: ["WEB"],
          },
        ],
      });
    });
    const client = new GtmDiscoveryClient(async () => "token", fetcher);

    const result = await client.discover();

    expect(result).toHaveLength(2);
    expect(result.map((account) => account.containers[0]?.publicId)).toEqual(["GTM-1", "GTM-2"]);
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it("retrieves a container's workspaces and live entity context", async () => {
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const url = new URL(input.toString());
      if (url.pathname.endsWith("/workspaces")) {
        return Response.json({
          workspace: [{
            path: "accounts/1/containers/10/workspaces/100",
            accountId: "1",
            containerId: "10",
            workspaceId: "100",
            name: "Default Workspace",
          }],
        });
      }
      if (url.pathname.endsWith("/versions:live")) {
        return Response.json({
          containerVersionId: "7",
          name: "Published setup",
          tag: [{ tagId: "1" }],
          trigger: [{ triggerId: "2" }],
          variable: [],
          builtInVariable: [{ type: "CLICK_URL" }],
        });
      }
      return Response.json({
        accountId: "1",
        containerId: "10",
        name: "Disposable web container",
        path: "accounts/1/containers/10",
        publicId: "GTM-TEST123",
        usageContext: ["web"],
      });
    });
    const client = new GtmDiscoveryClient(async () => "token", fetcher);

    const result = await client.containerEntityContext("1", "10");

    expect(result.container.publicId).toBe("GTM-TEST123");
    expect(result.workspaces).toHaveLength(1);
    expect(result.liveVersion.tag).toHaveLength(1);
    expect(result.liveVersion.trigger).toHaveLength(1);
    expect(result.liveVersion.builtInVariable).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("rejects malformed container paths before calling Google", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const client = new GtmDiscoveryClient(async () => "token", fetcher);

    await expect(client.containerEntityContext("../accounts", "10")).rejects.toThrow("numeric");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("creates a web container for a validated verification target", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
      accountId: "1",
      containerId: "20",
      name: "ConsentFlow Verification",
      path: "accounts/1/containers/20",
      publicId: "GTM-NEW123",
      usageContext: ["web"],
    }));
    const client = new GtmDiscoveryClient(async () => "token", fetcher);

    const result = await client.createVerificationContainer(
      "1",
      "ConsentFlow Verification",
      "https://consentflow-psi.vercel.app/path",
    );

    expect(result.publicId).toBe("GTM-NEW123");
    const [, request] = fetcher.mock.calls[0] ?? [];
    expect(request?.method).toBe("POST");
    expect(JSON.parse(request?.body as string)).toEqual({
      name: "ConsentFlow Verification",
      usageContext: ["web"],
      domainName: ["consentflow-psi.vercel.app"],
      notes: "Disposable verification target created by GTM Observability.",
    });
  });

  it("rejects non-HTTPS verification targets before creating a container", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const client = new GtmDiscoveryClient(async () => "token", fetcher);

    await expect(
      client.createVerificationContainer("1", "ConsentFlow Verification", "http://example.test"),
    ).rejects.toThrow("valid HTTPS URL");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("creates and inspects an isolated workspace without version operations", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({
        path: "accounts/1/containers/20/workspaces/3",
        accountId: "1",
        containerId: "20",
        workspaceId: "3",
        name: "GTM Observability - Navigation - 20260815",
      }))
      .mockResolvedValueOnce(Response.json({ workspaceChange: [], mergeConflict: [] }));
    const client = new GtmDiscoveryClient(async () => "token", fetcher);

    const workspace = await client.createIsolatedWorkspace(
      "1",
      "20",
      "GTM Observability - Navigation - 20260815",
    );
    const status = await client.workspaceStatus("1", "20", workspace.workspaceId);

    expect(workspace.workspaceId).toBe("3");
    expect(status).toEqual({ workspaceChange: [], mergeConflict: [] });
    expect(fetcher.mock.calls[0]?.[1]?.method).toBe("POST");
    expect(fetcher.mock.calls[1]?.[0].toString()).toMatch(/\/workspaces\/3\/status$/);
    expect(fetcher.mock.calls.some(([input]) => input.toString().includes("create_version"))).toBe(false);
    expect(fetcher.mock.calls.some(([input]) => input.toString().includes("publish"))).toBe(false);
  });

  it("reuses a clean Default Workspace for a product-owned verification container", async () => {
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const url = new URL(input.toString());
      if (url.pathname.endsWith("/workspaces")) {
        return Response.json({ workspace: [{
          path: "accounts/1/containers/20/workspaces/2",
          accountId: "1",
          containerId: "20",
          workspaceId: "2",
          name: "Default Workspace",
        }] });
      }
      if (url.pathname.endsWith("/status")) return Response.json({});
      return Response.json({
        path: "accounts/1/containers/20",
        accountId: "1",
        containerId: "20",
        name: "ConsentFlow Verification",
        publicId: "GTM-TEST123",
        usageContext: ["web"],
        notes: "Disposable verification target created by GTM Observability.",
      });
    });
    const client = new GtmDiscoveryClient(async () => "token", fetcher);

    const result = await client.selectTrackingSetupWorkspace("1", "20", "Unused name");

    expect(result.selection).toBe("reused-default");
    expect(result.workspace.workspaceId).toBe("2");
    expect(fetcher.mock.calls.some(([, request]) => request?.method === "POST")).toBe(false);
  });

  it("reuses a clean GTM Observability workspace for a customer container", async () => {
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const url = new URL(input.toString());
      if (url.pathname.endsWith("/workspaces")) {
        return Response.json({ workspace: [
          { path: "accounts/1/containers/20/workspaces/2", accountId: "1", containerId: "20", workspaceId: "2", name: "Default Workspace" },
          { path: "accounts/1/containers/20/workspaces/3", accountId: "1", containerId: "20", workspaceId: "3", name: "GTM Observability - Setup" },
        ] });
      }
      if (url.pathname.endsWith("/workspaces/3/status")) return Response.json({});
      return Response.json({ path: "accounts/1/containers/20", accountId: "1", containerId: "20", name: "Customer", publicId: "GTM-CUSTOMER", usageContext: ["web"] });
    });
    const client = new GtmDiscoveryClient(async () => "token", fetcher);

    const result = await client.selectTrackingSetupWorkspace("1", "20", "Unused name");

    expect(result.selection).toBe("reused-isolated");
    expect(result.workspace.workspaceId).toBe("3");
  });

  it("stops before workspace creation when capacity is full and no workspace is clean", async () => {
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const url = new URL(input.toString());
      if (url.pathname.endsWith("/workspaces")) {
        return Response.json({ workspace: [
          { path: "accounts/1/containers/20/workspaces/2", accountId: "1", containerId: "20", workspaceId: "2", name: "Default Workspace" },
          { path: "accounts/1/containers/20/workspaces/3", accountId: "1", containerId: "20", workspaceId: "3", name: "GTM Observability - Existing" },
          { path: "accounts/1/containers/20/workspaces/4", accountId: "1", containerId: "20", workspaceId: "4", name: "Other work" },
        ] });
      }
      if (url.pathname.endsWith("/status")) return Response.json({ workspaceChange: [{}] });
      return Response.json({ path: "accounts/1/containers/20", accountId: "1", containerId: "20", name: "Customer", publicId: "GTM-CUSTOMER", usageContext: ["web"] });
    });
    const client = new GtmDiscoveryClient(async () => "token", fetcher);

    await expect(client.selectTrackingSetupWorkspace("1", "20", "New workspace"))
      .rejects.toThrow("safe workspace capacity");
    expect(fetcher.mock.calls.some(([, request]) => request?.method === "POST")).toBe(false);
  });

  it("applies navigation entities sequentially and links the created trigger", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ tagId: "3", name: "Google tag - ConsentFlow" }))
      .mockResolvedValueOnce(Response.json({
        builtInVariable: [{ type: "clickText" }, { type: "clickUrl" }],
      }))
      .mockResolvedValueOnce(Response.json({ triggerId: "4", name: "Navigation trigger" }))
      .mockResolvedValueOnce(Response.json({ tagId: "5", name: "Navigation tag" }));
    const client = new GtmDiscoveryClient(async () => "token", fetcher);

    const result = await client.applyNavigationSetup(
      "1",
      "20",
      "3",
      "g-test123456",
      ["https://preview.test/#features", "https://preview.test/#contact"],
    );

    expect(result.googleTag.tagId).toBe("3");
    expect(result.trigger.triggerId).toBe("4");
    expect(result.tag.tagId).toBe("5");
    expect(fetcher).toHaveBeenCalledTimes(4);
    const googleTagBody = JSON.parse(fetcher.mock.calls[0]?.[1]?.body as string);
    expect(googleTagBody).toMatchObject({
      name: "Google tag - ConsentFlow",
      type: "googtag",
      firingTriggerId: ["2147479553"],
    });
    expect(googleTagBody.parameter).toContainEqual({
      type: "template",
      key: "tagId",
      value: "G-TEST123456",
    });
    const triggerBody = JSON.parse(fetcher.mock.calls[2]?.[1]?.body as string);
    expect(triggerBody.type).toBe("linkClick");
    expect(triggerBody.autoEventFilter[0].parameter[1].value).toContain(
      "https://preview\\.test/#features",
    );
    expect(triggerBody.checkValidation).toEqual({ type: "boolean", value: "false" });
    const tagBody = JSON.parse(fetcher.mock.calls[3]?.[1]?.body as string);
    expect(tagBody.firingTriggerId).toEqual(["4"]);
    expect(tagBody.type).toBe("gaawe");
    expect(tagBody.parameter).toContainEqual({
      type: "template",
      key: "measurementIdOverride",
      value: "G-TEST123456",
    });
    expect(tagBody.parameter).toContainEqual(expect.objectContaining({
      type: "list",
      key: "eventSettingsTable",
    }));
  });

  it("creates a Google tag on the built-in All Pages trigger", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(
      Response.json({ tagId: "6", name: "Google tag - ConsentFlow" }),
    );
    const client = new GtmDiscoveryClient(async () => "token", fetcher);

    const tag = await client.createGoogleTag("1", "20", "4", "g-test123456");

    expect(tag.tagId).toBe("6");
    const body = JSON.parse(fetcher.mock.calls[0]?.[1]?.body as string);
    expect(body.type).toBe("googtag");
    expect(body.firingTriggerId).toEqual(["2147479553"]);
  });

  it("disables validation on an existing link-click trigger without replacing it", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({
        triggerId: "3",
        name: "CE - Navigation Links - Confirmed Scope",
        type: "linkClick",
        fingerprint: "before",
        checkValidation: { type: "boolean", value: "true" },
      }))
      .mockResolvedValueOnce(Response.json({
        triggerId: "3",
        name: "CE - Navigation Links - Confirmed Scope",
        type: "linkClick",
        fingerprint: "after",
        checkValidation: { type: "boolean", value: "false" },
      }));
    const client = new GtmDiscoveryClient(async () => "token", fetcher);

    const trigger = await client.disableNavigationTriggerValidation(
      "1",
      "20",
      "4",
      "3",
      ["https://preview.test/#features", "https://preview.test/#contact"],
    );

    expect(trigger.triggerId).toBe("3");
    expect(fetcher.mock.calls[1]?.[1]?.method).toBe("PUT");
    const body = JSON.parse(fetcher.mock.calls[1]?.[1]?.body as string);
    expect(body.checkValidation).toEqual({ type: "boolean", value: "false" });
    expect(body.autoEventFilter[0].parameter[1].value).toContain(
      "https://preview\\.test/#features",
    );
  });

  it("completes a retained navigation setup by creating only its missing tag", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(
      Response.json({ tagId: "5", name: "GA4 Event - navigation_click" }),
    );
    const client = new GtmDiscoveryClient(async () => "token", fetcher);

    const tag = await client.createNavigationEventTag("1", "20", "4", "g-test123456", "3");

    expect(tag.tagId).toBe("5");
    expect(fetcher).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetcher.mock.calls[0]?.[1]?.body as string);
    expect(body.firingTriggerId).toEqual(["3"]);
    expect(body.parameter).toContainEqual({
      type: "template",
      key: "measurementIdOverride",
      value: "G-TEST123456",
    });
  });
});
