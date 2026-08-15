import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createSetupProposal, type SetupRequest } from "@gtm-observability/core";
import {
  GoogleIntegrationError,
  GoogleOAuthSession,
  GtmDiscoveryClient,
  AnalyticsDiscoveryClient,
  googleOAuthConfig,
} from "./google.js";

const port = Number.parseInt(process.env.PORT ?? "8787", 10);
const allowedOrigin = process.env.EXTENSION_ORIGIN ?? "*";
const maximumBodyBytes = 256_000;
const oauthConfig = googleOAuthConfig();
const oauthSession = oauthConfig ? new GoogleOAuthSession(oauthConfig) : undefined;
const discoveryClient = oauthSession
  ? new GtmDiscoveryClient(() => oauthSession.accessToken())
  : undefined;
const analyticsClient = oauthSession
  ? new AnalyticsDiscoveryClient(() => oauthSession.accessToken())
  : undefined;

function setCors(response: ServerResponse): void {
  response.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader("Vary", "Origin");
}

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  setCors(response);
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(value));
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.byteLength;
    if (size > maximumBodyBytes) throw new Error("Request body is too large.");
    chunks.push(buffer);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text) throw new Error("A JSON request body is required.");
  return JSON.parse(text) as unknown;
}

const server = createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    setCors(response);
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.method === "GET" && request.url === "/health") {
    sendJson(response, 200, { status: "ok", service: "gtm-observability-api" });
    return;
  }

  const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);

  if (request.method === "GET" && requestUrl.pathname === "/api/google/status") {
    sendJson(response, 200, {
      configured: oauthSession !== undefined,
      connected: oauthSession?.isConnected() ?? false,
      scope: oauthConfig?.trackingSetupWritesEnabled
        ? "tracking-setup-write"
        : oauthConfig?.workspaceWritesEnabled
          ? "workspace-write"
        : oauthConfig?.containerWritesEnabled ? "container-create" : "read-only",
      containerWritesEnabled: oauthConfig?.containerWritesEnabled ?? false,
      workspaceWritesEnabled: oauthConfig?.workspaceWritesEnabled ?? false,
      entityWritesEnabled: oauthConfig?.entityWritesEnabled ?? false,
      trackingSetupWritesEnabled: oauthConfig?.trackingSetupWritesEnabled ?? false,
      analyticsDiscoveryEnabled: oauthConfig?.analyticsDiscoveryEnabled ?? false,
      analyticsAccountProvisioningEnabled:
        oauthConfig?.analyticsAccountProvisioningEnabled ?? false,
      analyticsSetupWritesEnabled: oauthConfig?.analyticsSetupWritesEnabled ?? false,
    });
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/google/oauth/start") {
    if (!oauthSession) {
      sendJson(response, 503, { error: "Google OAuth is not configured on this backend." });
      return;
    }
    response.writeHead(302, { Location: oauthSession.authorizationUrl() });
    response.end();
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/google/oauth/callback") {
    if (!oauthSession) {
      sendJson(response, 503, { error: "Google OAuth is not configured on this backend." });
      return;
    }
    const error = requestUrl.searchParams.get("error");
    const code = requestUrl.searchParams.get("code");
    const state = requestUrl.searchParams.get("state");
    if (error || !code || !state) {
      sendJson(response, 400, { error: error ?? "OAuth callback is missing code or state." });
      return;
    }
    try {
      await oauthSession.authorize(code, state);
      sendJson(response, 200, {
        connected: true,
        message: "Google Tag Manager connected with the configured access.",
      });
    } catch (integrationError) {
      const status = integrationError instanceof GoogleIntegrationError
        ? integrationError.status
        : 502;
      const message = integrationError instanceof Error
        ? integrationError.message
        : "Unable to complete Google authorization.";
      sendJson(response, status, { error: message });
    }
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/google/accounts") {
    if (!discoveryClient) {
      sendJson(response, 503, { error: "Google OAuth is not configured on this backend." });
      return;
    }
    try {
      sendJson(response, 200, { accounts: await discoveryClient.discover() });
    } catch (integrationError) {
      const status = integrationError instanceof GoogleIntegrationError
        ? integrationError.status
        : 502;
      const message = integrationError instanceof Error
        ? integrationError.message
        : "Unable to discover Google Tag Manager containers.";
      sendJson(response, status, { error: message });
    }
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/google/analytics/destinations") {
    if (!analyticsClient || !oauthConfig?.analyticsDiscoveryEnabled) {
      sendJson(response, 403, { error: "Google Analytics discovery is disabled on this backend." });
      return;
    }
    try {
      sendJson(response, 200, { accounts: await analyticsClient.discover() });
    } catch (integrationError) {
      const status = integrationError instanceof GoogleIntegrationError
        ? integrationError.status
        : 502;
      const message = integrationError instanceof Error
        ? integrationError.message
        : "Unable to discover Google Analytics web streams.";
      sendJson(response, status, { error: message });
    }
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/google/analytics/account-provisioning-tickets") {
    if (
      !analyticsClient ||
      !oauthConfig?.analyticsAccountProvisioningEnabled ||
      !oauthConfig.analyticsProvisioningRedirectUri
    ) {
      sendJson(response, 403, { error: "Google Analytics account provisioning is disabled on this backend." });
      return;
    }
    try {
      const body = (await readJson(request)) as {
        approval?: unknown;
        displayName?: unknown;
        regionCode?: unknown;
      };
      if (
        body.approval !== "request-analytics-account-terms" ||
        typeof body.displayName !== "string" ||
        typeof body.regionCode !== "string"
      ) {
        throw new GoogleIntegrationError(
          "Provisioning requires explicit approval, displayName, and regionCode.",
          400,
        );
      }
      sendJson(response, 201, {
        ticket: await analyticsClient.provisionAccountTicket(
          body.displayName,
          body.regionCode,
          oauthConfig.analyticsProvisioningRedirectUri,
        ),
        accountStatus: "pending-terms-acceptance",
      });
    } catch (integrationError) {
      const status = integrationError instanceof GoogleIntegrationError
        ? integrationError.status
        : 502;
      const message = integrationError instanceof Error
        ? integrationError.message
        : "Unable to request an Analytics account provisioning ticket.";
      sendJson(response, status, { error: message });
    }
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/google/analytics/setups") {
    if (!analyticsClient || !oauthConfig?.analyticsSetupWritesEnabled) {
      sendJson(response, 403, { error: "Google Analytics setup creation is disabled on this backend." });
      return;
    }
    try {
      const body = (await readJson(request)) as {
        approval?: unknown;
        account?: unknown;
        propertyDisplayName?: unknown;
        timeZone?: unknown;
        currencyCode?: unknown;
        streamDisplayName?: unknown;
        defaultUri?: unknown;
      };
      if (
        body.approval !== "create-analytics-property-and-web-stream" ||
        typeof body.account !== "string" ||
        typeof body.propertyDisplayName !== "string" ||
        typeof body.timeZone !== "string" ||
        typeof body.currencyCode !== "string" ||
        typeof body.streamDisplayName !== "string" ||
        typeof body.defaultUri !== "string"
      ) {
        throw new GoogleIntegrationError(
          "Analytics setup creation requires explicit approval, account, property settings, and web stream settings.",
          400,
        );
      }
      sendJson(response, 201, {
        setup: await analyticsClient.createPropertyWithWebStream(
          body.account,
          body.propertyDisplayName,
          body.timeZone,
          body.currencyCode,
          body.streamDisplayName,
          body.defaultUri,
        ),
      });
    } catch (integrationError) {
      const status = integrationError instanceof GoogleIntegrationError
        ? integrationError.status
        : 502;
      const message = integrationError instanceof Error
        ? integrationError.message
        : "Unable to create the Analytics property and web data stream.";
      sendJson(response, status, { error: message });
    }
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/google/analytics/provisioning/callback") {
    sendJson(response, 200, {
      message: "Google Analytics terms completed. Return to the GTM Observability overlay and refresh Google.",
    });
    return;
  }

  const createContainerMatch = requestUrl.pathname.match(
    /^\/api\/google\/accounts\/(\d+)\/containers$/,
  );
  if (request.method === "POST" && createContainerMatch) {
    if (!discoveryClient || !oauthConfig?.containerWritesEnabled) {
      sendJson(response, 403, {
        error: "GTM container creation is disabled on this backend.",
      });
      return;
    }
    try {
      const body = (await readJson(request)) as {
        name?: unknown;
        verificationTarget?: unknown;
        purpose?: unknown;
      };
      if (body.purpose !== "verification-target") {
        throw new GoogleIntegrationError(
          "Container creation requires purpose=verification-target.",
          400,
        );
      }
      if (typeof body.name !== "string" || typeof body.verificationTarget !== "string") {
        throw new GoogleIntegrationError(
          "Container name and verificationTarget are required.",
          400,
        );
      }
      const [, accountId = ""] = createContainerMatch;
      sendJson(response, 201, {
        container: await discoveryClient.createVerificationContainer(
          accountId,
          body.name,
          body.verificationTarget,
        ),
      });
    } catch (integrationError) {
      const status = integrationError instanceof GoogleIntegrationError
        ? integrationError.status
        : 502;
      const message = integrationError instanceof Error
        ? integrationError.message
        : "Unable to create the GTM verification container.";
      sendJson(response, status, { error: message });
    }
    return;
  }

  const contextMatch = requestUrl.pathname.match(
    /^\/api\/google\/accounts\/(\d+)\/containers\/(\d+)\/context$/,
  );
  if (request.method === "GET" && contextMatch) {
    if (!discoveryClient) {
      sendJson(response, 503, { error: "Google OAuth is not configured on this backend." });
      return;
    }
    try {
      const [, accountId = "", containerId = ""] = contextMatch;
      sendJson(response, 200, {
        context: await discoveryClient.containerEntityContext(accountId, containerId),
      });
    } catch (integrationError) {
      const status = integrationError instanceof GoogleIntegrationError
        ? integrationError.status
        : 502;
      const message = integrationError instanceof Error
        ? integrationError.message
        : "Unable to retrieve the GTM container entity context.";
      sendJson(response, status, { error: message });
    }
    return;
  }

  const workspaceCollectionMatch = requestUrl.pathname.match(
    /^\/api\/google\/accounts\/(\d+)\/containers\/(\d+)\/workspaces$/,
  );
  if (request.method === "POST" && workspaceCollectionMatch) {
    if (!discoveryClient || !oauthConfig?.workspaceWritesEnabled) {
      sendJson(response, 403, { error: "GTM workspace creation is disabled on this backend." });
      return;
    }
    const [, accountId = "", containerId = ""] = workspaceCollectionMatch;
    const requestedPath = `accounts/${accountId}/containers/${containerId}`;
    if (requestedPath !== oauthConfig.workspaceContainerPath) {
      sendJson(response, 403, { error: "This container is not allowlisted for workspace writes." });
      return;
    }
    try {
      const body = (await readJson(request)) as { name?: unknown; purpose?: unknown };
      if (body.purpose !== "isolated-verification-workspace" || typeof body.name !== "string") {
        throw new GoogleIntegrationError(
          "Workspace creation requires a name and purpose=isolated-verification-workspace.",
          400,
        );
      }
      sendJson(response, 201, {
        workspace: await discoveryClient.createIsolatedWorkspace(accountId, containerId, body.name),
        retention: "retain-for-evidence",
      });
    } catch (integrationError) {
      const status = integrationError instanceof GoogleIntegrationError
        ? integrationError.status
        : 502;
      const message = integrationError instanceof Error
        ? integrationError.message
        : "Unable to create the isolated GTM workspace.";
      sendJson(response, status, { error: message });
    }
    return;
  }

  const workspaceStatusMatch = requestUrl.pathname.match(
    /^\/api\/google\/accounts\/(\d+)\/containers\/(\d+)\/workspaces\/(\d+)\/status$/,
  );
  if (request.method === "GET" && workspaceStatusMatch) {
    if (!discoveryClient || !oauthConfig?.workspaceWritesEnabled) {
      sendJson(response, 403, { error: "GTM workspace inspection is disabled on this backend." });
      return;
    }
    const [, accountId = "", containerId = "", workspaceId = ""] = workspaceStatusMatch;
    const requestedPath = `accounts/${accountId}/containers/${containerId}`;
    if (requestedPath !== oauthConfig.workspaceContainerPath) {
      sendJson(response, 403, { error: "This container is not allowlisted for workspace writes." });
      return;
    }
    try {
      sendJson(response, 200, {
        status: await discoveryClient.workspaceStatus(accountId, containerId, workspaceId),
      });
    } catch (integrationError) {
      const status = integrationError instanceof GoogleIntegrationError
        ? integrationError.status
        : 502;
      const message = integrationError instanceof Error
        ? integrationError.message
        : "Unable to inspect the GTM workspace.";
      sendJson(response, status, { error: message });
    }
    return;
  }

  const navigationValidationMatch = requestUrl.pathname.match(
    /^\/api\/google\/accounts\/(\d+)\/containers\/(\d+)\/workspaces\/(\d+)\/navigation-trigger-validation$/,
  );
  if (request.method === "POST" && navigationValidationMatch) {
    if (!discoveryClient || !oauthConfig?.entityWritesEnabled) {
      sendJson(response, 403, { error: "GTM entity writes are disabled on this backend." });
      return;
    }
    const [, accountId = "", containerId = "", workspaceId = ""] = navigationValidationMatch;
    const requestedPath = `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`;
    if (requestedPath !== oauthConfig.entityWorkspacePath) {
      sendJson(response, 403, { error: "This workspace is not allowlisted for entity writes." });
      return;
    }
    try {
      const body = (await readJson(request)) as { purpose?: unknown; triggerId?: unknown };
      if (body.purpose !== "capture-confirmed-link-clicks" || typeof body.triggerId !== "string") {
        throw new GoogleIntegrationError(
          "Navigation validation update requires purpose=capture-confirmed-link-clicks and triggerId.",
          400,
        );
      }
      sendJson(response, 200, {
        trigger: await discoveryClient.disableNavigationTriggerValidation(
          accountId,
          containerId,
          workspaceId,
          body.triggerId,
        ),
        publishStatus: "not-published",
      });
    } catch (integrationError) {
      const status = integrationError instanceof GoogleIntegrationError ? integrationError.status : 502;
      const message = integrationError instanceof Error ? integrationError.message : "Unable to update navigation validation.";
      sendJson(response, status, { error: message, retention: "retain-for-evidence" });
    }
    return;
  }

  const googleTagMatch = requestUrl.pathname.match(
    /^\/api\/google\/accounts\/(\d+)\/containers\/(\d+)\/workspaces\/(\d+)\/google-tag$/,
  );
  if (request.method === "POST" && googleTagMatch) {
    if (!discoveryClient || !oauthConfig?.entityWritesEnabled) {
      sendJson(response, 403, { error: "GTM entity writes are disabled on this backend." });
      return;
    }
    const [, accountId = "", containerId = "", workspaceId = ""] = googleTagMatch;
    const requestedPath = `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`;
    if (requestedPath !== oauthConfig.entityWorkspacePath) {
      sendJson(response, 403, { error: "This workspace is not allowlisted for entity writes." });
      return;
    }
    try {
      const body = (await readJson(request)) as { purpose?: unknown; measurementId?: unknown };
      if (body.purpose !== "initialize-analytics-web-stream" || typeof body.measurementId !== "string") {
        throw new GoogleIntegrationError(
          "Google tag creation requires purpose=initialize-analytics-web-stream and measurementId.",
          400,
        );
      }
      sendJson(response, 201, {
        tag: await discoveryClient.createGoogleTag(accountId, containerId, workspaceId, body.measurementId),
        publishStatus: "not-published",
      });
    } catch (integrationError) {
      const status = integrationError instanceof GoogleIntegrationError ? integrationError.status : 502;
      const message = integrationError instanceof Error ? integrationError.message : "Unable to create the Google tag.";
      sendJson(response, status, { error: message, retention: "retain-for-evidence" });
    }
    return;
  }

  const navigationTagMatch = requestUrl.pathname.match(
    /^\/api\/google\/accounts\/(\d+)\/containers\/(\d+)\/workspaces\/(\d+)\/navigation-tag$/,
  );
  if (request.method === "POST" && navigationTagMatch) {
    if (!discoveryClient || !oauthConfig?.entityWritesEnabled) {
      sendJson(response, 403, { error: "GTM entity writes are disabled on this backend." });
      return;
    }
    const [, accountId = "", containerId = "", workspaceId = ""] = navigationTagMatch;
    const requestedPath = `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`;
    if (requestedPath !== oauthConfig.entityWorkspacePath) {
      sendJson(response, 403, { error: "This workspace is not allowlisted for entity writes." });
      return;
    }
    try {
      const body = (await readJson(request)) as {
        purpose?: unknown;
        measurementId?: unknown;
        triggerId?: unknown;
      };
      if (
        body.purpose !== "complete-retained-navigation-setup" ||
        typeof body.measurementId !== "string" ||
        typeof body.triggerId !== "string"
      ) {
        throw new GoogleIntegrationError(
          "Retained setup completion requires purpose, measurementId, and triggerId.",
          400,
        );
      }
      sendJson(response, 201, {
        tag: await discoveryClient.createNavigationEventTag(
          accountId,
          containerId,
          workspaceId,
          body.measurementId,
          body.triggerId,
        ),
        publishStatus: "not-published",
      });
    } catch (integrationError) {
      const status = integrationError instanceof GoogleIntegrationError ? integrationError.status : 502;
      const message = integrationError instanceof Error ? integrationError.message : "Unable to complete retained GTM setup.";
      sendJson(response, status, { error: message, retention: "retain-for-evidence" });
    }
    return;
  }

  const navigationSetupMatch = requestUrl.pathname.match(
    /^\/api\/google\/accounts\/(\d+)\/containers\/(\d+)\/workspaces\/(\d+)\/navigation-setup$/,
  );
  if (request.method === "POST" && navigationSetupMatch) {
    if (!discoveryClient || !oauthConfig?.entityWritesEnabled) {
      sendJson(response, 403, { error: "GTM entity writes are disabled on this backend." });
      return;
    }
    const [, accountId = "", containerId = "", workspaceId = ""] = navigationSetupMatch;
    const requestedPath = `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`;
    if (requestedPath !== oauthConfig.entityWorkspacePath) {
      sendJson(response, 403, { error: "This workspace is not allowlisted for entity writes." });
      return;
    }
    try {
      const body = (await readJson(request)) as {
        measurementId?: unknown;
        linkUrls?: unknown;
        purpose?: unknown;
      };
      if (
        body.purpose !== "navigation-tracking-setup" ||
        typeof body.measurementId !== "string" ||
        !Array.isArray(body.linkUrls) ||
        !body.linkUrls.every((url) => typeof url === "string")
      ) {
        throw new GoogleIntegrationError(
          "Entity creation requires measurementId, string linkUrls, and purpose=navigation-tracking-setup.",
          400,
        );
      }
      sendJson(response, 201, {
        setup: await discoveryClient.applyNavigationSetup(
          accountId,
          containerId,
          workspaceId,
          body.measurementId,
          body.linkUrls,
        ),
        retention: "retain-for-evidence",
        publishStatus: "not-published",
      });
    } catch (integrationError) {
      const status = integrationError instanceof GoogleIntegrationError
        ? integrationError.status
        : 502;
      const message = integrationError instanceof Error
        ? integrationError.message
        : "Unable to apply the navigation tracking setup.";
      sendJson(response, status, { error: message, retention: "retain-for-evidence" });
    }
    return;
  }

  const trackingSetupMatch = requestUrl.pathname.match(
    /^\/api\/google\/accounts\/(\d+)\/containers\/(\d+)\/tracking-setups$/,
  );
  if (request.method === "POST" && trackingSetupMatch) {
    if (!discoveryClient || !oauthConfig?.trackingSetupWritesEnabled) {
      sendJson(response, 403, { error: "Practitioner-initiated GTM setup creation is disabled on this backend." });
      return;
    }
    const [, accountId = "", containerId = ""] = trackingSetupMatch;
    const requestedPath = `accounts/${accountId}/containers/${containerId}`;
    if (requestedPath !== oauthConfig.trackingSetupContainerPath) {
      sendJson(response, 403, { error: "This container is not allowlisted for tracking setup creation." });
      return;
    }
    let workspace: Awaited<ReturnType<GtmDiscoveryClient["createIsolatedWorkspace"]>> | undefined;
    let workspaceSelection: Awaited<ReturnType<GtmDiscoveryClient["selectTrackingSetupWorkspace"]>>["selection"] | undefined;
    try {
      const body = (await readJson(request)) as {
        approval?: unknown;
        measurementId?: unknown;
        linkUrls?: unknown;
        workspaceName?: unknown;
      };
      if (
        body.approval !== "create-isolated-tracking-setup" ||
        typeof body.measurementId !== "string" ||
        typeof body.workspaceName !== "string" ||
        !Array.isArray(body.linkUrls) ||
        !body.linkUrls.every((url) => typeof url === "string")
      ) {
        throw new GoogleIntegrationError(
          "Setup creation requires explicit approval, workspaceName, measurementId, and string linkUrls.",
          400,
        );
      }
      const selectedWorkspace = await discoveryClient.selectTrackingSetupWorkspace(
        accountId,
        containerId,
        body.workspaceName,
      );
      workspace = selectedWorkspace.workspace;
      workspaceSelection = selectedWorkspace.selection;
      const setup = await discoveryClient.applyNavigationSetup(
        accountId,
        containerId,
        workspace.workspaceId,
        body.measurementId,
        body.linkUrls,
      );
      sendJson(response, 201, {
        workspace,
        workspaceSelection,
        setup,
        retention: "retain-for-evidence",
        publishStatus: "not-published",
      });
    } catch (integrationError) {
      const status = integrationError instanceof GoogleIntegrationError
        ? integrationError.status
        : 502;
      const message = integrationError instanceof Error
        ? integrationError.message
        : "Unable to create the GTM tracking setup.";
      sendJson(response, status, {
        error: message,
        ...(workspace ? { workspace, workspaceSelection } : {}),
        retention: "retain-for-evidence",
        publishStatus: "not-published",
      });
    }
    return;
  }

  if (request.method === "POST" && request.url === "/api/setups") {
    try {
      const body = (await readJson(request)) as SetupRequest;
      const proposal = createSetupProposal(body);
      sendJson(response, 201, proposal);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create setup.";
      sendJson(response, 400, { error: message });
    }
    return;
  }

  sendJson(response, 404, { error: "Not found." });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`GTM Observability API listening on http://127.0.0.1:${port}`);
});
