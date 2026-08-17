import { routeApiRequest } from "./app.js";

const allowedOrigin = process.env.EXTENSION_ORIGIN ?? "*";

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    Vary: "Origin",
  };
}

export async function handleVercelRequest(request: Request): Promise<Response> {
  try {
    const result = await routeApiRequest({
      method: request.method,
      url: request.url,
      readJson: () => request.json(),
    });
    if (result.status === 204) return new Response(null, { status: 204, headers: corsHeaders() });
    return Response.json(result.body, { status: result.status, headers: corsHeaders() });
  } catch (error) {
    console.error("Unhandled API route error", error);
    return Response.json({ error: "Internal server error." }, { status: 500, headers: corsHeaders() });
  }
}
