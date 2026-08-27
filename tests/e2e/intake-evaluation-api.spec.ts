import { expect, test } from "@playwright/test";
const endpoint = "http://127.0.0.1:8787/api/intake-evaluations";
const extensionOrigin = "chrome-extension://gtm-observability-e2e";

test("keeps operator evaluation reports outside the organization-member API", async ({ request }) => {
  const list = await request.get(endpoint, {
    headers: {
      origin: extensionOrigin,
      authorization: "Bearer test_admin_access_token_0001",
    },
  });
  expect(list.status()).toBe(403);
  expect(list.headers()["access-control-allow-origin"]).toBe(extensionOrigin);
  expect(await list.json()).toEqual({ error: "This API is unavailable to organization members." });

  const originless = await request.get(endpoint);
  expect(originless.status()).toBe(403);
  expect(originless.headers()["access-control-allow-origin"]).toBeUndefined();

  const attacker = await request.get(endpoint, { headers: { origin: "https://attacker.example" } });
  expect(attacker.status()).toBe(403);
  expect(await attacker.json()).toEqual({ error: "Request origin is not allowed." });

  const write = await request.post(endpoint, {
    headers: { origin: extensionOrigin },
    data: { run: true },
  });
  expect(write.status()).toBe(403);
  expect(await write.json()).toEqual({ error: "This API is unavailable to organization members." });
});
