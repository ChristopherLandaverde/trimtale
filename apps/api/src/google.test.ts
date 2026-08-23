import { describe, expect, it, vi } from "vitest";
import {
  GoogleOAuthSession,
  GtmDiscoveryClient,
  GTM_EDIT_CONTAINER_VERSIONS_SCOPE,
  GTM_EDIT_CONTAINERS_SCOPE,
  GTM_READONLY_SCOPE,
  googleGtmWritesEnabled,
  googleOAuthConfig,
} from "./google.js";
import {
  createSetupProposal,
  GTM_MANAGED_WORKSPACE_DESCRIPTION,
  GTM_MANAGED_WORKSPACE_NAME,
} from "@gtm-observability/core";

const config = {
  clientId: "client-id",
  clientSecret: "client-secret",
  redirectUri: "http://127.0.0.1:8787/api/google/oauth/callback",
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

  it("requests container-edit access only when writes are explicitly enabled", () => {
    expect(googleGtmWritesEnabled({})).toBe(false);
    expect(googleGtmWritesEnabled({ GOOGLE_GTM_CONTAINER_WRITES_ENABLED: "true" })).toBe(true);
    expect(googleGtmWritesEnabled({ GOOGLE_GTM_CONTAINER_WRITES_ENABLED: "TRUE" })).toBe(false);

    const session = new GoogleOAuthSession(config, vi.fn<typeof fetch>(), Date.now, true);
    const scopes = new URL(session.authorizationUrl()).searchParams.get("scope")?.split(" ");
    expect(scopes).toEqual([
      GTM_READONLY_SCOPE,
      GTM_EDIT_CONTAINERS_SCOPE,
      GTM_EDIT_CONTAINER_VERSIONS_SCOPE,
    ]);
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
});

function googleFixtureFetch(options: {
  workspaces: Array<Record<string, unknown>>;
  sync?: Record<string, unknown>;
  createdWorkspace?: Record<string, unknown>;
  entities?: {
    tag?: unknown[];
    trigger?: unknown[];
    variable?: unknown[];
    builtInVariable?: unknown[];
  };
}) {
  return vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(input.toString());
    if (url.pathname.endsWith("/accounts")) {
      return Response.json({ account: [{ accountId: "1", name: "Agency", path: "accounts/1" }] });
    }
    if (url.pathname.endsWith("/accounts/1/containers")) {
      return Response.json({ container: [{
        accountId: "1",
        containerId: "10",
        name: "Lead site",
        path: "accounts/1/containers/10",
        publicId: "GTM-ABC123",
        usageContext: ["WEB"],
      }] });
    }
    if (url.pathname.endsWith("/workspaces") && init?.method === "POST") {
      return Response.json(options.createdWorkspace ?? {
        path: "accounts/1/containers/10/workspaces/99",
        accountId: "1",
        containerId: "10",
        workspaceId: "99",
        name: GTM_MANAGED_WORKSPACE_NAME,
        description: GTM_MANAGED_WORKSPACE_DESCRIPTION,
      });
    }
    if (url.pathname.endsWith("/workspaces")) return Response.json({ workspace: options.workspaces });
    if (url.pathname.endsWith("/tags")) return Response.json({ tag: options.entities?.tag ?? [] });
    if (url.pathname.endsWith("/triggers")) return Response.json({ trigger: options.entities?.trigger ?? [] });
    if (url.pathname.endsWith("/variables")) return Response.json({ variable: options.entities?.variable ?? [] });
    if (url.pathname.endsWith("/built_in_variables")) {
      return Response.json({ builtInVariable: options.entities?.builtInVariable ?? [] });
    }
    if (url.pathname.endsWith(":sync")) return Response.json(options.sync ?? { syncStatus: {} });
    if (url.pathname.endsWith("/status")) return Response.json({ workspaceChange: [], mergeConflict: [] });
    if (url.pathname.endsWith("/versions:live")) {
      return Response.json({ containerVersionId: "7", fingerprint: "live-7" });
    }
    return Response.json({
      accountId: "1",
      containerId: "10",
      name: "Lead site",
      path: "accounts/1/containers/10",
      publicId: "GTM-ABC123",
      usageContext: ["WEB"],
    });
  });
}

describe("recognized container workspace workflow", () => {
  const defaultWorkspace = {
    path: "accounts/1/containers/10/workspaces/1",
    accountId: "1",
    containerId: "10",
    workspaceId: "1",
    name: "Default Workspace",
  };
  const managedWorkspace = {
    path: "accounts/1/containers/10/workspaces/2",
    accountId: "1",
    containerId: "10",
    workspaceId: "2",
    name: GTM_MANAGED_WORKSPACE_NAME,
    description: GTM_MANAGED_WORKSPACE_DESCRIPTION,
    fingerprint: "managed-2",
  };

  it("inspects an observed ID without mutating GTM", async () => {
    const fetcher = googleFixtureFetch({ workspaces: [defaultWorkspace] });
    const client = new GtmDiscoveryClient(async () => "token", fetcher, false);

    const result = await client.inspectObservedContainer("gtm-abc123");

    expect(result).toMatchObject({
      status: "recognized",
      publicId: "GTM-ABC123",
      container: { name: "Lead site" },
      workspace: { status: "available", action: "create", workspaceCount: 1 },
    });
    expect(fetcher.mock.calls.every(([, init]) => !init?.method || init.method === "GET")).toBe(true);
  });

  it("reuses and synchronizes the existing managed workspace", async () => {
    const fetcher = googleFixtureFetch({ workspaces: [defaultWorkspace, managedWorkspace] });
    const client = new GtmDiscoveryClient(async () => "token", fetcher, true);

    const result = await client.prepareManagedWorkspace("GTM-ABC123");

    expect(result).toMatchObject({ status: "recognized", workspace: { status: "reused", workspace: managedWorkspace } });
    expect(fetcher.mock.calls.filter(([input]) => input.toString().endsWith(":sync"))).toHaveLength(1);
    expect(fetcher.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
  });

  it("plans against freshly read managed-workspace entities without mutation", async () => {
    const setup = createSetupProposal({
      intent: "Track navigation clicks",
      pageUrl: "https://example.test/",
      measurementId: "G-TEST123456",
      container: {
        accountId: "1",
        containerId: "10",
        publicId: "GTM-ABC123",
        name: "Lead site",
      },
      navigation: [{
        id: "pricing",
        text: "Pricing",
        href: "https://example.test/pricing",
        area: "nav",
        selector: "nav a[href='/pricing']",
      }],
    }).containerFile;
    const entities = structuredClone(setup.containerVersion);
    const trigger = entities.trigger[0] as Record<string, unknown>;
    const tag = entities.tag[0] as Record<string, unknown>;
    trigger.triggerId = "42";
    tag.tagId = "43";
    tag.firingTriggerId = ["42"];
    const fetcher = googleFixtureFetch({
      workspaces: [defaultWorkspace, managedWorkspace],
      entities,
    });
    const client = new GtmDiscoveryClient(async () => "token", fetcher, false);

    const result = await client.planManagedWorkspace("GTM-ABC123", setup);

    expect(result).toMatchObject({
      status: "planned",
      workspaceFingerprint: "managed-2",
      plan: { status: "ready" },
    });
    expect(result.status === "planned" && result.plan.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "trigger", action: "reuse", existingId: "42" }),
      expect.objectContaining({ kind: "tag", action: "reuse", existingId: "43" }),
    ]));
    expect(fetcher.mock.calls.every(([, init]) => !init?.method || init.method === "GET")).toBe(true);
  });

  it("requires workspace preparation before reading entities", async () => {
    const setup = createSetupProposal({
      intent: "Track navigation clicks",
      pageUrl: "https://example.test/",
      measurementId: "G-TEST123456",
      container: {
        accountId: "1",
        containerId: "10",
        publicId: "GTM-ABC123",
        name: "Lead site",
      },
      navigation: [{
        id: "pricing",
        text: "Pricing",
        href: "https://example.test/pricing",
        area: "nav",
        selector: "nav a[href='/pricing']",
      }],
    }).containerFile;
    const fetcher = googleFixtureFetch({ workspaces: [defaultWorkspace] });
    const client = new GtmDiscoveryClient(async () => "token", fetcher, false);

    const result = await client.planManagedWorkspace("GTM-ABC123", setup);

    expect(result).toMatchObject({ status: "workspace_required" });
    expect(fetcher.mock.calls.some(([input]) => input.toString().endsWith("/tags"))).toBe(false);
  });

  it("creates once for concurrent repeated preparation", async () => {
    const fetcher = googleFixtureFetch({ workspaces: [defaultWorkspace] });
    const client = new GtmDiscoveryClient(async () => "token", fetcher, true);

    const [first, second] = await Promise.all([
      client.prepareManagedWorkspace("GTM-ABC123"),
      client.prepareManagedWorkspace("gtm-abc123"),
    ]);

    expect(first).toMatchObject({ status: "recognized", workspace: { status: "created" } });
    expect(second).toEqual(first);
    expect(fetcher.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
  });

  it("creates nothing when all three workspace slots are occupied", async () => {
    const fetcher = googleFixtureFetch({ workspaces: [defaultWorkspace, {
      ...defaultWorkspace,
      path: "accounts/1/containers/10/workspaces/2",
      workspaceId: "2",
      name: "Agency",
    }, {
      ...defaultWorkspace,
      path: "accounts/1/containers/10/workspaces/3",
      workspaceId: "3",
      name: "Experiment",
    }] });
    const client = new GtmDiscoveryClient(async () => "token", fetcher, true);

    const result = await client.prepareManagedWorkspace("GTM-ABC123");

    expect(result).toMatchObject({ status: "recognized", workspace: { status: "capacity_blocked", workspaceCount: 3 } });
    expect(fetcher.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(0);
  });

  it("preserves a managed workspace when synchronization reports conflicts", async () => {
    const fetcher = googleFixtureFetch({
      workspaces: [defaultWorkspace, managedWorkspace],
      sync: { syncStatus: { mergeConflict: true }, mergeConflict: [{ entityInWorkspace: {} }] },
    });
    const client = new GtmDiscoveryClient(async () => "token", fetcher, true);

    const result = await client.prepareManagedWorkspace("GTM-ABC123");

    expect(result).toMatchObject({ status: "recognized", workspace: { status: "sync_conflict", workspace: managedWorkspace } });
  });

  it("refuses preparation before any Google calls when writes are disabled", async () => {
    const fetcher = googleFixtureFetch({ workspaces: [defaultWorkspace] });
    const client = new GtmDiscoveryClient(async () => "token", fetcher, false);

    await expect(client.prepareManagedWorkspace("GTM-ABC123")).rejects.toMatchObject({ status: 403 });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
