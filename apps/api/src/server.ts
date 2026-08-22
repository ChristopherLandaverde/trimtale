import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createSetupProposal, type SetupRequest } from "@gtm-observability/core";
import {
  GoogleIntegrationError,
  GoogleOAuthSession,
  GtmDiscoveryClient,
  googleGtmWritesEnabled,
  googleOAuthConfig,
} from "./google.js";

const port = Number.parseInt(process.env.PORT ?? "8787", 10);
const allowedOrigin = process.env.EXTENSION_ORIGIN ?? "*";
const maximumBodyBytes = 256_000;
const oauthConfig = googleOAuthConfig();
const containerWritesEnabled = googleGtmWritesEnabled();
const oauthSession = oauthConfig
  ? new GoogleOAuthSession(oauthConfig, fetch, Date.now, containerWritesEnabled)
  : undefined;
const discoveryClient = oauthSession
  ? new GtmDiscoveryClient(() => oauthSession.accessToken(), fetch, containerWritesEnabled)
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
      scope: containerWritesEnabled ? "container-edit" : "read-only",
      containerWritesEnabled,
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
        message: containerWritesEnabled
          ? "Google Tag Manager connected with container-edit access."
          : "Google Tag Manager connected with read-only access.",
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

  if (request.method === "GET" && requestUrl.pathname === "/api/google/containers/recognize") {
    if (!discoveryClient) {
      sendJson(response, 503, { error: "Google OAuth is not configured on this backend." });
      return;
    }
    const publicId = requestUrl.searchParams.get("publicId") ?? "";
    try {
      sendJson(response, 200, {
        result: await discoveryClient.inspectObservedContainer(publicId),
        containerWritesEnabled,
      });
    } catch (integrationError) {
      const status = integrationError instanceof GoogleIntegrationError
        ? integrationError.status
        : integrationError instanceof Error && integrationError.message.includes("GTM public container ID")
          ? 400
          : 502;
      const message = integrationError instanceof Error
        ? integrationError.message
        : "Unable to recognize the observed GTM container.";
      sendJson(response, status, { error: message });
    }
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/google/containers/prepare-workspace") {
    if (!discoveryClient) {
      sendJson(response, 503, { error: "Google OAuth is not configured on this backend." });
      return;
    }
    try {
      const body = (await readJson(request)) as { publicId?: unknown };
      if (typeof body.publicId !== "string") {
        sendJson(response, 400, { error: "A GTM public container ID is required." });
        return;
      }
      sendJson(response, 200, {
        result: await discoveryClient.prepareManagedWorkspace(body.publicId),
      });
    } catch (integrationError) {
      const status = integrationError instanceof GoogleIntegrationError
        ? integrationError.status
        : integrationError instanceof SyntaxError
          ? 400
          : 502;
      const message = integrationError instanceof Error
        ? integrationError.message
        : "Unable to prepare the managed GTM workspace.";
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
