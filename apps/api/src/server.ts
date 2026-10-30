import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createSetupProposal, type SetupRequest } from "@trimtale/core";
import { resolve } from "node:path";
import { corsDecision } from "./cors.js";
import { intakeEvaluationApiResponse } from "./intake-evaluation-api.js";
import {
  GoogleIntegrationError,
  GoogleOAuthSession,
  GtmDiscoveryClient,
  FileGoogleOAuthTokenStore,
  googleGtmPublicationEnabled,
  googleGtmPublicationScopeRequested,
  googleGtmWritesEnabled,
  googleOAuthConfig,
} from "./google.js";
import { TrackingOperationRepository } from "./tracking-operations.js";
import { TrackingWorkflowRunner } from "./workflow-runner.js";
import { handleGoogleWorkflowRoute } from "./workflow-routes.js";

const port = Number.parseInt(process.env.PORT ?? "18787", 10);
const configuredExtensionOrigin = process.env.EXTENSION_ORIGIN;
const maximumBodyBytes = 256_000;
const oauthConfig = googleOAuthConfig();
const containerWritesEnabled = googleGtmWritesEnabled();
const publicationEnabled = googleGtmPublicationEnabled();
const publicationScopeRequested = googleGtmPublicationScopeRequested();
const oauthTokenStorePath = process.env.GOOGLE_OAUTH_TOKEN_STORE?.trim();
const oauthTokenStore = oauthConfig && oauthTokenStorePath
  ? new FileGoogleOAuthTokenStore(resolve(oauthTokenStorePath), oauthConfig.clientId)
  : undefined;
const oauthSession = oauthConfig
  ? new GoogleOAuthSession(
      oauthConfig,
      fetch,
      Date.now,
      containerWritesEnabled,
      publicationScopeRequested,
      oauthTokenStore,
    )
  : undefined;
const discoveryClient = oauthSession
  ? new GtmDiscoveryClient(() => oauthSession.accessToken(), fetch, containerWritesEnabled, publicationEnabled)
  : undefined;
const workflowRunner = discoveryClient
  ? new TrackingWorkflowRunner(
      new TrackingOperationRepository(
        process.env.TRACKING_OPERATION_STORE?.trim()
          || resolve(process.cwd(), ".data/tracking-operations.json"),
      ),
      discoveryClient,
    )
  : undefined;
const intakeEvaluationReportStorePath = resolve(
  process.env.INTAKE_EVALUATION_REPORT_STORE?.trim()
    || ".data/intake-evaluations.json",
);

function applyCors(request: IncomingMessage, response: ServerResponse, pathname: string): boolean {
  const decision = corsDecision(pathname, request.headers.origin, configuredExtensionOrigin);
  if (decision.allowOrigin) {
    response.setHeader("Access-Control-Allow-Origin", decision.allowOrigin);
  }
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader("Vary", "Origin");
  return decision.allowed;
}

function sendJson(response: ServerResponse, status: number, value: unknown): void {
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
  const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);
  if (!applyCors(request, response, requestUrl.pathname)) {
    sendJson(response, 403, { error: "Request origin is not allowed." });
    return;
  }

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.method === "GET" && request.url === "/health") {
    sendJson(response, 200, { status: "ok", service: "gtm-observability-api" });
    return;
  }

  const intakeEvaluationResponse = intakeEvaluationApiResponse(
    request.method ?? "",
    requestUrl.pathname,
    intakeEvaluationReportStorePath,
  );
  if (intakeEvaluationResponse) {
    sendJson(response, intakeEvaluationResponse.status, intakeEvaluationResponse.body);
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/google/status") {
    sendJson(response, 200, {
      configured: oauthSession !== undefined,
      connected: oauthSession?.isConnected() ?? false,
      scope: containerWritesEnabled ? "container-edit" : "read-only",
      containerWritesEnabled,
      publicationScopeRequested,
      publicationEnabled,
      tokenPersistenceEnabled: oauthTokenStore !== undefined,
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

  if (await handleGoogleWorkflowRoute({
    request,
    response,
    requestUrl,
    workflowRunner,
    publicationEnabled,
    ...(oauthSession ? { approverIdentity: () => oauthSession.verifiedAccountEmail() } : {}),
    readJson,
    sendJson,
  })) {
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
  console.log(`Trimtale API listening on http://127.0.0.1:${port}`);
});
