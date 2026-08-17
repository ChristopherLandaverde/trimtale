import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { routeApiRequest } from "./app.js";

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
  const result = await routeApiRequest({
    method: request.method,
    url: request.url,
    readJson: () => readJson(request),
  });
  if (result.status === 204) {
    setCors(response);
    response.writeHead(204);
    response.end();
    return;
  }
  sendJson(response, result.status, result.body);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`GTM Observability API listening on http://127.0.0.1:${port}`);
});
