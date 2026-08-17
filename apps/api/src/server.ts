import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createSetupProposal, type SetupRequest } from "@gtm-observability/core";
import {
  discoverGtmContainers,
  GoogleIntegrationDisabledError,
  googleIntegrationStatus,
  loadGoogleIntegrationConfig,
} from "./google.js";

const port = Number.parseInt(process.env.PORT ?? "18787", 10);
const allowedOrigin = process.env.EXTENSION_ORIGIN ?? "*";
const maximumBodyBytes = 256_000;

function setCors(response: ServerResponse): void {
  response.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
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

  if (request.method === "GET" && request.url === "/api/google/status") {
    sendJson(response, 200, googleIntegrationStatus(loadGoogleIntegrationConfig()));
    return;
  }

  if (request.method === "GET" && request.url === "/api/google/gtm/accounts") {
    try {
      sendJson(response, 200, await discoverGtmContainers(loadGoogleIntegrationConfig()));
    } catch (error) {
      if (error instanceof GoogleIntegrationDisabledError) {
        sendJson(response, 503, { error: error.message });
        return;
      }
      const message = error instanceof Error ? error.message : "Unable to discover GTM containers.";
      sendJson(response, 502, { error: message });
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
