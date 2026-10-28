import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import {
  approvalMembershipRef,
  approveGa4ConfigurationPlan,
  authorTrackingSetup,
  createSetupProposal,
  type Ga4ConfigurationActionV1,
  type Ga4ConfigurationPlanV1,
  type TrackingRunEvidenceV1,
  type SetupAuthoringGroundingV1,
  type SetupAuthoringInputV1,
  type ExactDraftBrowserRunV1,
  type ManagedReplacementRefV1,
  type OrganizationAuthorityV1,
  type SetupRequest,
} from "@gtm-observability/core";
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
  googleGtmWriteTargetPublicId,
  googleGtmWritesEnabled,
  googleOAuthConfig,
} from "./google.js";
import { TrackingOperationRepository } from "./tracking-operations.js";
import {
  apiRouteAccess,
  authenticateOrganization,
  organizationAuthRuntime,
} from "./organization-auth.js";
import {
  ContainerInventoryService,
  InventorySnapshotRepository,
} from "./container-inventory-api.js";
import { TrackingWorkflowRunner, type TrackingWorkflowRequest } from "./workflow-runner.js";
import {
  AnalyticsIntegrationError,
  AnalyticsAccess,
  GoogleAnalyticsReadClient,
  GoogleAnalyticsWriteClient,
  googleAnalyticsReadsEnabled,
  googleAnalyticsWritesEnabled,
} from "./analytics.js";
import {
  OpenAIIntakeProvider,
  openAILiveIntakeConfig,
} from "./openai-intake-provider.js";
import {
  OpenAISetupAuthoringProvider,
  openAISetupAuthoringConfig,
} from "./openai-setup-authoring-provider.js";
import { LiveIntakeService } from "./live-intake-api.js";

const port = Number.parseInt(process.env.PORT ?? "8787", 10);
const configuredExtensionOrigin = process.env.EXTENSION_ORIGIN;
const stage1SmokeSessionId = process.env.STAGE1_SMOKE_SESSION_ID?.trim();
const maximumBodyBytes = 256_000;
const authRuntime = organizationAuthRuntime();
const oauthConfig = googleOAuthConfig();
const containerWritesEnabled = googleGtmWritesEnabled();
const publicationEnabled = googleGtmPublicationEnabled();
const publicationScopeRequested = googleGtmPublicationScopeRequested();
const writeTargetPublicId = googleGtmWriteTargetPublicId();
const analyticsWriteEnabled = googleAnalyticsWritesEnabled();
const analyticsReadEnabled = googleAnalyticsReadsEnabled() || analyticsWriteEnabled;
const setupAuthoringConfig = openAISetupAuthoringConfig();
const setupAuthoringProvider = setupAuthoringConfig
  ? new OpenAISetupAuthoringProvider(setupAuthoringConfig)
  : undefined;
const liveIntakeConfig = openAILiveIntakeConfig();
const liveIntakeService = liveIntakeConfig && authRuntime
  ? new LiveIntakeService(
      authRuntime.organizationId,
      new OpenAIIntakeProvider(liveIntakeConfig),
    )
  : undefined;
const analyticsAccess = analyticsWriteEnabled
  ? AnalyticsAccess.Edit
  : analyticsReadEnabled ? AnalyticsAccess.Read : AnalyticsAccess.None;
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
      analyticsAccess,
    )
  : undefined;
const discoveryClient = oauthSession
  ? new GtmDiscoveryClient(
      () => oauthSession.accessToken(),
      fetch,
      containerWritesEnabled,
      publicationEnabled,
      Date.now,
      undefined,
      writeTargetPublicId,
    )
  : undefined;
const analyticsClient = oauthSession
  ? new GoogleAnalyticsReadClient(() => oauthSession.accessToken(), fetch, analyticsReadEnabled)
  : undefined;
const analyticsWriter = oauthSession && analyticsClient
  ? new GoogleAnalyticsWriteClient(
      analyticsClient,
      () => oauthSession.accessToken(),
      fetch,
      analyticsAccess,
    )
  : undefined;
const workflowRunner = discoveryClient && authRuntime
  ? new TrackingWorkflowRunner(
      new TrackingOperationRepository(
        process.env.TRACKING_OPERATION_STORE?.trim()
          || resolve(process.cwd(), ".data/tracking-operations.json"),
        authRuntime.organizationId,
      ).scope(authRuntime.organizationId),
      discoveryClient,
    )
  : undefined;
const intakeEvaluationReportStorePath = resolve(
  process.env.INTAKE_EVALUATION_REPORT_STORE?.trim()
    || ".data/intake-evaluations.json",
);
const inventoryService = discoveryClient && authRuntime
  ? new ContainerInventoryService(
      authRuntime.organizationId,
      "google_primary",
      new InventorySnapshotRepository(
        resolve(process.env.CONTAINER_INVENTORY_STORE?.trim()
          || ".data/container-inventory.json"),
      ),
      (organizationId, googleConnectionId) => discoveryClient.captureContainerInventory(
        organizationId,
        googleConnectionId,
      ),
    )
  : undefined;

function applyCors(request: IncomingMessage, response: ServerResponse, pathname: string): boolean {
  const decision = corsDecision(pathname, request.headers.origin, configuredExtensionOrigin);
  if (decision.allowOrigin) {
    response.setHeader("Access-Control-Allow-Origin", decision.allowOrigin);
  }
  response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
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
    sendJson(response, 200, {
      status: "ok",
      service: "gtm-observability-api",
      sessionId: stage1SmokeSessionId,
      authenticationConfigured: authRuntime !== undefined,
    });
    return;
  }

  let organizationAuthority: OrganizationAuthorityV1 | undefined;
  const routeAccess = apiRouteAccess(request.method ?? "", requestUrl.pathname);
  if (routeAccess === "internal") {
    sendJson(response, 403, { error: "This API is unavailable to organization members." });
    return;
  }
  if (routeAccess !== "public") {
    if (!authRuntime) {
      sendJson(response, 503, { error: "Product authentication is not configured." });
      return;
    }
    const authentication = await authenticateOrganization({
      ...(request.headers.authorization ? { authorization: request.headers.authorization } : {}),
      expectedOrganizationId: authRuntime.organizationId,
      requiredPermission: routeAccess,
      verifier: authRuntime.verifier,
      membership: authRuntime.membership,
    });
    if (authentication.status !== "authorized") {
      const status = authentication.status === "unauthenticated"
        ? 401
        : authentication.status === "forbidden" ? 403 : 503;
      if (status === 401) {
        response.setHeader("WWW-Authenticate", "Bearer");
      }
      sendJson(response, status, {
        error: status === 401
          ? "Product sign-in is required."
          : status === 403
            ? "Organization permission is required."
            : "Product authentication is unavailable.",
      });
      return;
    }
    organizationAuthority = authentication.authority;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/auth/status") {
    sendJson(response, 200, {
      authenticated: true,
      role: organizationAuthority!.role,
      permissions: organizationAuthority!.permissions,
    });
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/setup-authoring") {
    if (!setupAuthoringProvider) {
      sendJson(response, 503, { error: "Setup authoring is not configured on this backend." });
      return;
    }
    try {
      const body = await readJson(request);
      const record = typeof body === "object" && body !== null && !Array.isArray(body)
        ? body as Record<string, unknown>
        : undefined;
      if (!record) {
        sendJson(response, 400, { error: "Setup authoring input and grounding are required." });
        return;
      }
      const result = await authorTrackingSetup(
        setupAuthoringProvider,
        record.input as SetupAuthoringInputV1,
        record.grounding as SetupAuthoringGroundingV1,
        { signal: AbortSignal.timeout(30_000) },
      );
      sendJson(response, 200, { result });
    } catch (authoringError) {
      const invalid = authoringError instanceof Error
        && (authoringError.message.includes("input is invalid")
          || authoringError.message.includes("output is invalid"));
      sendJson(response, invalid ? 400 : 502, {
        error: invalid
          ? "Setup authoring request is invalid."
          : "Setup authoring provider is unavailable.",
      });
    }
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/intake/interpretations") {
    if (!liveIntakeService) {
      sendJson(response, 503, { error: "Live language interpretation is not configured." });
      return;
    }
    try {
      const body = await readJson(request);
      sendJson(response, 200, {
        result: await liveIntakeService.interpret(
          organizationAuthority!,
          body,
          AbortSignal.timeout(6_000),
        ),
      });
    } catch (interpretationError) {
      const invalidInput = interpretationError instanceof Error
        && interpretationError.message === "Live intake input is invalid.";
      sendJson(response, invalidInput ? 400 : 502, {
        error: invalidInput
          ? "The language interpretation request is invalid."
          : "Language interpretation is temporarily unavailable.",
      });
    }
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
      analyticsReadEnabled,
      analyticsWriteEnabled,
    });
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/google/analytics/enhanced-measurement") {
    if (!analyticsClient) {
      sendJson(response, 503, { error: "Google OAuth is not configured on this backend." });
      return;
    }
    const measurementId = requestUrl.searchParams.get("measurementId");
    if (!measurementId) {
      sendJson(response, 400, { error: "Measurement ID is required." });
      return;
    }
    try {
      sendJson(response, 200, {
        ...await analyticsClient.enhancedMeasurement(measurementId),
        canEnable: analyticsWriteEnabled,
      });
    } catch (integrationError) {
      const status = integrationError instanceof AnalyticsIntegrationError ? integrationError.status : 502;
      const message = integrationError instanceof AnalyticsIntegrationError
        ? integrationError.message
        : "Unable to read enhanced-measurement settings.";
      const code = integrationError instanceof AnalyticsIntegrationError
        ? integrationError.code
        : "provider_unavailable";
      sendJson(response, status, { error: message, code });
    }
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/google/analytics/enhanced-measurement/enable") {
    if (!analyticsWriter) {
      sendJson(response, 503, { error: "Google OAuth is not configured on this backend." });
      return;
    }
    try {
      const body = await readJson(request);
      const measurementId = typeof body === "object" && body !== null && !Array.isArray(body)
        ? (body as Record<string, unknown>).measurementId
        : undefined;
      if (typeof measurementId !== "string") {
        sendJson(response, 400, { error: "Measurement ID is required." });
        return;
      }
      sendJson(response, 200, await analyticsWriter.enableMeasurement(measurementId));
    } catch (integrationError) {
      const status = integrationError instanceof AnalyticsIntegrationError ? integrationError.status : 502;
      const message = integrationError instanceof AnalyticsIntegrationError
        ? integrationError.message
        : "Unable to enable enhanced measurement.";
      const code = integrationError instanceof AnalyticsIntegrationError
        ? integrationError.code
        : "provider_unavailable";
      sendJson(response, status, { error: message, code });
    }
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/google/analytics/configuration/plan") {
    if (!analyticsWriter) {
      sendJson(response, 503, { error: "Google OAuth is not configured on this backend." });
      return;
    }
    try {
      const body = await readJson(request);
      const record = typeof body === "object" && body !== null && !Array.isArray(body)
        ? body as Record<string, unknown>
        : undefined;
      if (typeof record?.id !== "string"
        || typeof record.measurementId !== "string"
        || !Array.isArray(record.actions)) {
        sendJson(response, 400, { error: "A GA4 plan ID, measurement ID, and actions are required." });
        return;
      }
      sendJson(response, 200, await analyticsWriter.planConfiguration({
        id: record.id,
        measurementId: record.measurementId,
        actions: record.actions as Ga4ConfigurationActionV1[],
      }));
    } catch (integrationError) {
      const status = integrationError instanceof AnalyticsIntegrationError
        ? integrationError.status
        : 400;
      const message = integrationError instanceof AnalyticsIntegrationError
        ? integrationError.message
        : "Unable to plan GA4 configuration.";
      const code = integrationError instanceof AnalyticsIntegrationError
        ? integrationError.code
        : "invalid_request";
      sendJson(response, status, { error: message, code });
    }
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/google/analytics/configuration/apply") {
    if (!analyticsWriter) {
      sendJson(response, 503, { error: "Google OAuth is not configured on this backend." });
      return;
    }
    try {
      const body = await readJson(request);
      const plan = typeof body === "object" && body !== null && !Array.isArray(body)
        ? (body as Record<string, unknown>).plan
        : undefined;
      const approved = approveGa4ConfigurationPlan(
        plan as Ga4ConfigurationPlanV1,
        approvalMembershipRef(organizationAuthority!),
      );
      sendJson(response, 200, await analyticsWriter.applyConfiguration(approved));
    } catch (integrationError) {
      const status = integrationError instanceof AnalyticsIntegrationError
        ? integrationError.status
        : 400;
      const message = integrationError instanceof AnalyticsIntegrationError
        ? integrationError.message
        : "Unable to apply GA4 configuration.";
      const code = integrationError instanceof AnalyticsIntegrationError
        ? integrationError.code
        : "invalid_request";
      sendJson(response, status, { error: message, code });
    }
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/google/analytics/verifications/start") {
    if (!analyticsClient) {
      sendJson(response, 503, { error: "Google OAuth is not configured on this backend." });
      return;
    }
    try {
      const body = await readJson(request);
      const record = typeof body === "object" && body !== null && !Array.isArray(body)
        ? body as Record<string, unknown>
        : undefined;
      if (typeof record?.measurementId !== "string" || typeof record.eventName !== "string") {
        sendJson(response, 400, { error: "Measurement ID and event name are required." });
        return;
      }
      sendJson(response, 200, await analyticsClient.start({
        measurementId: record.measurementId,
        eventName: record.eventName,
      }));
    } catch (integrationError) {
      const status = integrationError instanceof AnalyticsIntegrationError ? integrationError.status : 502;
      const message = integrationError instanceof AnalyticsIntegrationError
        ? integrationError.message
        : "Unable to start Analytics verification.";
      const code = integrationError instanceof AnalyticsIntegrationError
        ? integrationError.code
        : "provider_unavailable";
      sendJson(response, status, { error: message, code });
    }
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/google/analytics/verifications/confirm") {
    if (!analyticsClient) {
      sendJson(response, 503, { error: "Google OAuth is not configured on this backend." });
      return;
    }
    try {
      const body = await readJson(request);
      const verificationId = typeof body === "object" && body !== null && !Array.isArray(body)
        ? (body as Record<string, unknown>).verificationId
        : undefined;
      if (typeof verificationId !== "string") {
        sendJson(response, 400, { error: "Analytics verification ID is required." });
        return;
      }
      sendJson(response, 200, await analyticsClient.confirm(verificationId));
    } catch (integrationError) {
      const status = integrationError instanceof AnalyticsIntegrationError ? integrationError.status : 502;
      const message = integrationError instanceof AnalyticsIntegrationError
        ? integrationError.message
        : "Unable to confirm Analytics verification.";
      const code = integrationError instanceof AnalyticsIntegrationError
        ? integrationError.code
        : "provider_unavailable";
      sendJson(response, status, { error: message, code });
    }
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
    if (!oauthSession || !authRuntime) {
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

  if (request.method === "GET" && requestUrl.pathname === "/api/google/inventory") {
    if (!inventoryService) {
      sendJson(response, 503, { error: "Google OAuth is not configured on this backend." });
      return;
    }
    try {
      sendJson(response, 200, {
        result: await inventoryService.capture(organizationAuthority!),
      });
    } catch (integrationError) {
      const status = integrationError instanceof GoogleIntegrationError
        ? integrationError.status
        : integrationError instanceof Error
          && integrationError.message.includes("newer than the current baseline")
          ? 409
          : integrationError instanceof Error
            && integrationError.message.includes("Provider inventory")
            ? 502
            : 500;
      sendJson(response, status, {
        error: status === 409
          ? "A newer container inventory is already recorded."
          : status === 500
            ? "Container inventory storage is unavailable."
            : "Unable to capture the Google Tag Manager inventory.",
      });
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

  if (request.method === "POST" && requestUrl.pathname === "/api/google/workflows/plan") {
    if (!workflowRunner) {
      sendJson(response, 503, { error: "Google OAuth is not configured on this backend." });
      return;
    }
    try {
      const result = await workflowRunner.plan((await readJson(request)) as TrackingWorkflowRequest);
      sendJson(response, result.status === "planned" ? 201 : result.status === "blocked" ? 409 : 200, { result });
    } catch (workflowError) {
      const status = workflowError instanceof GoogleIntegrationError
        ? workflowError.status
        : workflowError instanceof SyntaxError
          ? 400
          : 400;
      const message = workflowError instanceof Error
        ? workflowError.message
        : "Unable to plan the tracking workflow.";
      sendJson(response, status, { error: message });
    }
    return;
  }

  const workflowMatch = requestUrl.pathname.match(/^\/api\/google\/workflows\/([A-Za-z0-9_-]+)$/);
  if (request.method === "GET" && workflowMatch) {
    if (!workflowRunner) {
      sendJson(response, 503, { error: "Google OAuth is not configured on this backend." });
      return;
    }
    const operation = workflowRunner.get(workflowMatch[1] ?? "");
    sendJson(response, operation ? 200 : 404, operation ? { operation } : { error: "Tracking operation was not found." });
    return;
  }

  const workflowProgressMatch = requestUrl.pathname.match(
    /^\/api\/google\/workflows\/([A-Za-z0-9_-]+)\/progress$/,
  );
  if (request.method === "GET" && workflowProgressMatch) {
    if (!workflowRunner) {
      sendJson(response, 503, { error: "Google OAuth is not configured on this backend." });
      return;
    }
    try {
      sendJson(response, 200, {
        progress: workflowRunner.progress(workflowProgressMatch[1] ?? "", {
          displayTimedOut: requestUrl.searchParams.get("displayTimedOut") === "true",
          browserReloaded: requestUrl.searchParams.get("browserReloaded") === "true",
        }),
      });
    } catch (workflowError) {
      sendJson(response, 404, {
        error: workflowError instanceof Error
          ? workflowError.message
          : "Tracking operation was not found.",
      });
    }
    return;
  }

  const resumeMatch = requestUrl.pathname.match(
    /^\/api\/google\/workflows\/([A-Za-z0-9_-]+)\/resume$/,
  );
  const verifyDraftMatch = requestUrl.pathname.match(
    /^\/api\/google\/workflows\/([A-Za-z0-9_-]+)\/verify-draft$/,
  );
  const repairDraftMatch = requestUrl.pathname.match(
    /^\/api\/google\/workflows\/([A-Za-z0-9_-]+)\/repair-draft$/,
  );
  const applyRepairMatch = requestUrl.pathname.match(
    /^\/api\/google\/workflows\/([A-Za-z0-9_-]+)\/apply-repair$/,
  );
  const approveReplacementMatch = requestUrl.pathname.match(
    /^\/api\/google\/workflows\/([A-Za-z0-9_-]+)\/approve-replacement$/,
  );
  const approvePublicationMatch = requestUrl.pathname.match(
    /^\/api\/google\/workflows\/([A-Za-z0-9_-]+)\/approve-publication$/,
  );
  const publishMatch = requestUrl.pathname.match(
    /^\/api\/google\/workflows\/([A-Za-z0-9_-]+)\/publish$/,
  );
  const verifyPublicationMatch = requestUrl.pathname.match(
    /^\/api\/google\/workflows\/([A-Za-z0-9_-]+)\/verify-publication$/,
  );
  const rollbackMatch = requestUrl.pathname.match(
    /^\/api\/google\/workflows\/([A-Za-z0-9_-]+)\/rollback$/,
  );
  if (request.method === "POST" && verifyDraftMatch) {
    if (!workflowRunner) {
      sendJson(response, 503, { error: "Google OAuth is not configured on this backend." });
      return;
    }
    try {
      const run = (await readJson(request)) as ExactDraftBrowserRunV1;
      sendJson(response, 200, {
        result: workflowRunner.verifyDraft(verifyDraftMatch[1] ?? "", run),
      });
    } catch (workflowError) {
      const status = workflowError instanceof SyntaxError
        ? 400
        : workflowError instanceof Error && workflowError.message.includes("not found")
          ? 404
          : 409;
      const message = workflowError instanceof Error
        ? workflowError.message
        : "Unable to bind exact draft evidence.";
      sendJson(response, status, { error: message });
    }
    return;
  }
  if (request.method === "POST" && repairDraftMatch) {
    if (!workflowRunner) {
      sendJson(response, 503, { error: "Google OAuth is not configured on this backend." });
      return;
    }
    try {
      const run = (await readJson(request)) as ExactDraftBrowserRunV1;
      const result = await workflowRunner.proposeDraftRepair(repairDraftMatch[1] ?? "", run);
      sendJson(response, result.status === "repair_ready" ? 200 : 409, { result });
    } catch (workflowError) {
      const status = workflowError instanceof GoogleIntegrationError
        ? workflowError.status
        : workflowError instanceof SyntaxError
          ? 400
          : workflowError instanceof Error && workflowError.message.includes("not found")
            ? 404
            : 409;
      sendJson(response, status, {
        error: workflowError instanceof Error
          ? workflowError.message
          : "Unable to propose a bounded draft repair.",
      });
    }
    return;
  }
  if (request.method === "POST" && applyRepairMatch) {
    if (!workflowRunner) {
      sendJson(response, 503, { error: "Google OAuth is not configured on this backend." });
      return;
    }
    try {
      const body = await readJson(request);
      const planFingerprint = typeof body === "object" && body !== null && !Array.isArray(body)
        ? (body as Record<string, unknown>).planFingerprint
        : undefined;
      if (typeof planFingerprint !== "string") {
        sendJson(response, 400, { error: "The reviewed repair plan fingerprint is required." });
        return;
      }
      const result = await workflowRunner.applyDraftRepair(applyRepairMatch[1] ?? "", planFingerprint);
      sendJson(response, result.status === "awaiting_preview" ? 200 : 409, { result });
    } catch (workflowError) {
      const status = workflowError instanceof GoogleIntegrationError
        ? workflowError.status
        : workflowError instanceof SyntaxError
          ? 400
          : workflowError instanceof Error && workflowError.message.includes("not found")
            ? 404
            : 409;
      sendJson(response, status, {
        error: workflowError instanceof Error
          ? workflowError.message
          : "Unable to apply the reviewed draft repair.",
      });
    }
    return;
  }
  if (request.method === "POST" && approveReplacementMatch) {
    if (!workflowRunner) {
      sendJson(response, 503, { error: "Google OAuth is not configured on this backend." });
      return;
    }
    try {
      const body = await readJson(request);
      const record = typeof body === "object" && body !== null && !Array.isArray(body)
        ? body as Record<string, unknown>
        : undefined;
      if (typeof record?.planFingerprint !== "string" || !Array.isArray(record.entities)) {
        sendJson(response, 400, { error: "The exact managed replacement review is required." });
        return;
      }
      sendJson(response, 200, {
        result: workflowRunner.approveManagedReplacement(
          approveReplacementMatch[1] ?? "",
          record.planFingerprint,
          record.entities as ManagedReplacementRefV1[],
          approvalMembershipRef(organizationAuthority!),
        ),
      });
    } catch (workflowError) {
      const status = workflowError instanceof SyntaxError
        ? 400
        : workflowError instanceof Error && workflowError.message.includes("not found")
          ? 404
          : 409;
      sendJson(response, status, {
        error: workflowError instanceof Error
          ? workflowError.message
          : "Unable to approve managed replacement.",
      });
    }
    return;
  }
  if (request.method === "POST" && resumeMatch) {
    if (!workflowRunner) {
      sendJson(response, 503, { error: "Google OAuth is not configured on this backend." });
      return;
    }
    try {
      sendJson(response, 200, { result: await workflowRunner.resume(resumeMatch[1] ?? "") });
    } catch (workflowError) {
      const status = workflowError instanceof GoogleIntegrationError
        ? workflowError.status
        : workflowError instanceof Error && workflowError.message.includes("not found")
          ? 404
          : 409;
      const message = workflowError instanceof Error
        ? workflowError.message
        : "Unable to resume the tracking workflow.";
      sendJson(response, status, { error: message });
    }
    return;
  }
  if (request.method === "POST" && approvePublicationMatch) {
    if (!workflowRunner) {
      sendJson(response, 503, { error: "Google OAuth is not configured on this backend." });
      return;
    }
    try {
      const body = await readJson(request);
      const versionFingerprint = typeof body === "object" && body !== null && !Array.isArray(body)
        ? (body as Record<string, unknown>).versionFingerprint
        : undefined;
      if (typeof versionFingerprint !== "string") {
        sendJson(response, 400, { error: "The reviewed version fingerprint is required." });
        return;
      }
      sendJson(response, 200, {
        result: workflowRunner.approvePublication(
          approvePublicationMatch[1] ?? "",
          versionFingerprint,
          approvalMembershipRef(organizationAuthority!),
        ),
      });
    } catch (workflowError) {
      const status = workflowError instanceof Error && workflowError.message.includes("not found")
        ? 404
        : 409;
      sendJson(response, status, {
        error: workflowError instanceof Error
          ? workflowError.message
          : "Unable to approve publication.",
      });
    }
    return;
  }
  if (request.method === "POST" && publishMatch) {
    if (!workflowRunner) {
      sendJson(response, 503, { error: "Google OAuth is not configured on this backend." });
      return;
    }
    try {
      const body = await readJson(request);
      const versionFingerprint = typeof body === "object" && body !== null && !Array.isArray(body)
        ? (body as Record<string, unknown>).versionFingerprint
        : undefined;
      if (typeof versionFingerprint !== "string") {
        sendJson(response, 400, { error: "The approved version fingerprint is required." });
        return;
      }
      sendJson(response, 200, {
        result: await workflowRunner.publish(publishMatch[1] ?? "", versionFingerprint),
      });
    } catch (workflowError) {
      const status = workflowError instanceof GoogleIntegrationError
        ? workflowError.status
        : workflowError instanceof Error && workflowError.message.includes("not found")
          ? 404
          : 409;
      sendJson(response, status, {
        error: workflowError instanceof Error
          ? workflowError.message
          : "Unable to publish the approved version.",
      });
    }
    return;
  }
  if (request.method === "POST" && verifyPublicationMatch) {
    if (!workflowRunner) {
      sendJson(response, 503, { error: "Google OAuth is not configured on this backend." });
      return;
    }
    try {
      const body = await readJson(request);
      const values = typeof body === "object" && body !== null && !Array.isArray(body)
        ? body as Record<string, unknown>
        : {};
      if (typeof values.versionFingerprint !== "string" || values.evidence === undefined) {
        sendJson(response, 400, { error: "The published fingerprint and live evidence are required." });
        return;
      }
      sendJson(response, 200, {
        result: workflowRunner.verifyPublication(
          verifyPublicationMatch[1] ?? "",
          values.versionFingerprint,
          values.evidence as TrackingRunEvidenceV1,
        ),
      });
    } catch (workflowError) {
      const status = workflowError instanceof Error && workflowError.message.includes("not found")
        ? 404
        : 409;
      sendJson(response, status, {
        error: workflowError instanceof Error
          ? workflowError.message
          : "Unable to record live publication evidence.",
      });
    }
    return;
  }
  if (request.method === "POST" && rollbackMatch) {
    if (!workflowRunner) {
      sendJson(response, 503, { error: "Google OAuth is not configured on this backend." });
      return;
    }
    try {
      const body = await readJson(request);
      const values = typeof body === "object" && body !== null && !Array.isArray(body)
        ? body as Record<string, unknown>
        : {};
      if (typeof values.versionFingerprint !== "string"
        || typeof values.targetVersionFingerprint !== "string") {
        sendJson(response, 400, { error: "The failed and rollback fingerprints are required." });
        return;
      }
      sendJson(response, 200, {
        result: await workflowRunner.rollback(
          rollbackMatch[1] ?? "",
          values.versionFingerprint,
          values.targetVersionFingerprint,
        ),
      });
    } catch (workflowError) {
      const status = workflowError instanceof GoogleIntegrationError
        ? workflowError.status
        : workflowError instanceof Error && workflowError.message.includes("not found")
          ? 404
          : 409;
      sendJson(response, status, {
        error: workflowError instanceof Error
          ? workflowError.message
          : "Unable to roll back the failed publication.",
      });
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
