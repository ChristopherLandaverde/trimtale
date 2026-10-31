import { routeApiRequest } from "./app.js";
import { corsDecision } from "./cors.js";

function corsHeaders(allowOrigin: string | undefined): Headers {
  const headers = new Headers({
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    Vary: "Origin",
  });
  if (allowOrigin) headers.set("Access-Control-Allow-Origin", allowOrigin);
  return headers;
}

// Uses the same route-aware decision as the local server: public routes stay open,
// Google and intake routes refuse browser origins unless EXTENSION_ORIGIN matches exactly.
// EXTENSION_ORIGIN is read per request so a misconfigured deployment never defaults open.
export async function handleVercelRequest(request: Request): Promise<Response> {
  const pathname = new URL(request.url, "http://127.0.0.1").pathname;
  const decision = corsDecision(
    pathname,
    request.headers.get("origin") ?? undefined,
    process.env.EXTENSION_ORIGIN,
  );
  const headers = corsHeaders(decision.allowOrigin);
  if (!decision.allowed) {
    return Response.json({ error: "Request origin is not allowed." }, { status: 403, headers });
  }

  try {
    const result = await routeApiRequest({
      method: request.method,
      url: request.url,
      headers: request.headers,
      readJson: () => request.json(),
    });
    if (result.status === 204) return new Response(null, { status: 204, headers });
    return Response.json(result.body, { status: result.status, headers });
  } catch (error) {
    console.error("Unhandled API route error", error);
    return Response.json({ error: "Internal server error." }, { status: 500, headers });
  }
}
