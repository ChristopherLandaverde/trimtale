import { createServer } from "node:http";
import { renderVerificationTarget } from "./render.js";

const port = Number.parseInt(process.env.VERIFICATION_TARGET_PORT ?? "4175", 10);
const containerId = process.env.GTM_CONTAINER_ID?.trim() || "GTM-TEST000";
const html = renderVerificationTarget(containerId);

createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ status: "ok", service: "verification-target" }));
    return;
  }
  response.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(html);
}).listen(port, "127.0.0.1", () => {
  console.log(`Verification target listening on http://127.0.0.1:${port}`);
});
