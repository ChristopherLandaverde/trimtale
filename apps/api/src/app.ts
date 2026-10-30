import { createSetupProposal, type SetupRequest } from "@trimtale/core";

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

export async function routeApiRequest(request: ApiRouteRequest): Promise<ApiRouteResult> {
  const method = request.method ?? "GET";
  const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;

  if (method === "OPTIONS") {
    return { status: 204 };
  }

  if (method === "GET" && (pathname === "/health" || pathname === "/api/health")) {
    return { status: 200, body: { status: "ok", service: "gtm-observability-api" } };
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
