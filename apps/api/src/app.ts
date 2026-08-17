import { createSetupProposal, type SetupRequest } from "@gtm-observability/core";
import {
  discoverGtmContainers,
  GoogleIntegrationDisabledError,
  googleIntegrationStatus,
  loadGoogleIntegrationConfig,
  resolveGtmSite,
  type GtmSiteResolutionRequest,
} from "./google.js";

export interface ApiRouteRequest {
  method?: string | undefined;
  url?: string | undefined;
  headers?: Headers | undefined;
  readJson: () => Promise<unknown>;
}

export interface ApiRouteResult {
  status: number;
  body?: unknown;
}

function authorizeGoogleRead(headers?: Headers, options: { allowExtensionToken?: boolean } = {}): ApiRouteResult | undefined {
  const adminToken = process.env.GTM_OBSERVABILITY_ADMIN_TOKEN?.trim();
  const extensionToken = process.env.GTM_OBSERVABILITY_EXTENSION_TOKEN?.trim();
  const allowedTokens = [adminToken, options.allowExtensionToken ? extensionToken : undefined].filter(Boolean);
  const authorization = headers?.get("Authorization") ?? "";
  if (allowedTokens.length === 0 || !allowedTokens.some((token) => authorization === `Bearer ${token}`)) {
    return { status: 401, body: { error: "Authorization is required for GTM access." } };
  }
  return undefined;
}

export async function routeApiRequest(request: ApiRouteRequest): Promise<ApiRouteResult> {
  const method = request.method ?? "GET";
  const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;

  if (method === "OPTIONS") {
    return { status: 204 };
  }

  if (method === "GET" && (pathname === "/health" || pathname === "/api/health")) {
    return { status: 200, body: { status: "ok", service: "gtm-observability-api" } };
  }

  if (method === "GET" && pathname === "/api/google/status") {
    return { status: 200, body: googleIntegrationStatus(loadGoogleIntegrationConfig()) };
  }

  if (method === "GET" && pathname === "/api/google/gtm/accounts") {
    const unauthorized = authorizeGoogleRead(request.headers);
    if (unauthorized) return unauthorized;

    try {
      return { status: 200, body: await discoverGtmContainers(loadGoogleIntegrationConfig()) };
    } catch (error) {
      if (error instanceof GoogleIntegrationDisabledError) {
        return { status: 503, body: { error: error.message } };
      }
      const message = error instanceof Error ? error.message : "Unable to discover GTM containers.";
      return { status: 502, body: { error: message } };
    }
  }

  if (method === "POST" && pathname === "/api/google/gtm/resolve-site") {
    const unauthorized = authorizeGoogleRead(request.headers, { allowExtensionToken: true });
    if (unauthorized) return unauthorized;

    try {
      const body = (await request.readJson()) as GtmSiteResolutionRequest;
      return { status: 200, body: await resolveGtmSite(loadGoogleIntegrationConfig(), body) };
    } catch (error) {
      if (error instanceof GoogleIntegrationDisabledError) {
        return { status: 503, body: { error: error.message } };
      }
      const message = error instanceof Error ? error.message : "Unable to resolve GTM site configuration.";
      return { status: 502, body: { error: message } };
    }
  }

  if (method === "POST" && pathname === "/api/setups") {
    try {
      const body = (await request.readJson()) as SetupRequest;
      return { status: 201, body: createSetupProposal(body) };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create setup.";
      return { status: 400, body: { error: message } };
    }
  }

  return { status: 404, body: { error: "Not found." } };
}
