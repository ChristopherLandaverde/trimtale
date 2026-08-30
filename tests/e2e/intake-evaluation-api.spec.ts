import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const endpoint = "http://127.0.0.1:8787/api/intake-evaluations";
const extensionOrigin = "chrome-extension://gtm-observability-e2e";
const fixturePath = resolve("tests/fixtures/intake-evaluation-reports.json");

test("serves only read-only intake evaluation reports to the configured browser origin", async ({ request }) => {
  const before = readFileSync(fixturePath, "utf8");

  const list = await request.get(endpoint, { headers: { origin: extensionOrigin } });
  expect(list.status()).toBe(200);
  expect(list.headers()["access-control-allow-origin"]).toBe(extensionOrigin);
  expect(await list.json()).toEqual({ schemaVersion: 1, reports: [] });

  const originless = await request.get(endpoint);
  expect(originless.status()).toBe(200);
  expect(originless.headers()["access-control-allow-origin"]).toBeUndefined();

  const attacker = await request.get(endpoint, { headers: { origin: "https://attacker.example" } });
  expect(attacker.status()).toBe(403);
  expect(await attacker.json()).toEqual({ error: "Request origin is not allowed." });

  const write = await request.post(endpoint, {
    headers: { origin: extensionOrigin },
    data: { run: true },
  });
  expect(write.status()).toBe(405);
  expect(await write.json()).toEqual({ error: "Intake evaluation reports are read-only." });
  expect(readFileSync(fixturePath, "utf8")).toBe(before);
});
