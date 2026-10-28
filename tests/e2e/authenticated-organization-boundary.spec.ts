import { expect as playwrightExpect, test as apiTest } from "@playwright/test";
import { resolve } from "node:path";
import { expect, test } from "./helpers/extension-test.js";

const api = "http://127.0.0.1:8787";
const screenshotOptions = {
  animations: "disabled" as const,
  stylePath: resolve("tests/e2e/visual-stability.css"),
};

apiTest("authorizes active member and admin sessions without returning identity details", async ({ request }) => {
  const preflight = await request.fetch(`${api}/api/auth/status`, {
    method: "OPTIONS",
    headers: { origin: "chrome-extension://gtm-observability-e2e" },
  });
  playwrightExpect(preflight.status()).toBe(204);
  playwrightExpect(preflight.headers()["access-control-allow-headers"])
    .toContain("Authorization");

  for (const [token, role] of [
    ["test_admin_access_token_0001", "admin"],
    ["test_member_access_token_0001", "member"],
  ] as const) {
    const response = await request.get(`${api}/api/auth/status`, {
      headers: { authorization: `Bearer ${token}` },
    });
    playwrightExpect(response.status()).toBe(200);
    const body = await response.json();
    playwrightExpect(body).toMatchObject({ authenticated: true, role });
    playwrightExpect(JSON.stringify(body)).not.toMatch(/user_|mem_|access_token|@/);
  }
});

apiTest("rejects signed-out, wrong-organization, and member publication requests", async ({ request }) => {
  const signedOut = await request.get(`${api}/api/auth/status`);
  playwrightExpect(signedOut.status()).toBe(401);

  const wrongOrganization = await request.get(`${api}/api/auth/status`, {
    headers: { authorization: "Bearer test_wrong_org_token_0001" },
  });
  playwrightExpect(wrongOrganization.status()).toBe(403);

  const memberPublication = await request.post(`${api}/api/google/workflows/operation_1/publish`, {
    headers: { authorization: "Bearer test_member_access_token_0001" },
    data: { versionFingerprint: "fingerprint_1234567890" },
  });
  playwrightExpect(memberPublication.status()).toBe(403);
});

test("shows a product sign-in action when the API rejects the session", async ({ context, page }) => {
  await context.route(`${api}/api/google/status`, (route) => route.fulfill({
    status: 401,
    contentType: "application/json",
    body: JSON.stringify({ error: "Product sign-in is required." }),
  }));
  await page.goto("http://127.0.0.1:4173/?gtm=GTM-TEST123");
  const root = page.locator("#gtm-observability-root");
  await root.getByRole("button", { name: "Open tracking agent" }).click();
  const card = root.getByRole("region", { name: "GTM connection" });
  await expect(card.getByText("GTM Observability sign-in required", { exact: true })).toBeVisible();
  await expect(card.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  await expect(card).toContainText("Product sign-in and Google authorization are separate.");
  await expect(root.locator("section.assistant")).toHaveScreenshot("product-sign-in.png", screenshotOptions);
});

test("shows the wrong-organization state without leaking identity details", async ({ context, page }) => {
  await context.route(`${api}/api/google/status`, (route) => route.fulfill({
    status: 403,
    contentType: "application/json",
    body: JSON.stringify({
      error: "<img src=x onerror=alert(1)> PRIVATE_MEMBER_EMAIL attacker@example.test",
    }),
  }));
  await page.goto("http://127.0.0.1:4173/?gtm=GTM-TEST123");
  const root = page.locator("#gtm-observability-root");
  await root.getByRole("button", { name: "Open tracking agent" }).click();
  const card = root.getByRole("region", { name: "GTM connection" });
  await expect(card.getByText("Authorized organization membership required", { exact: true })).toBeVisible();
  await expect(card).not.toContainText(/user_|mem_|access_token|@|PRIVATE_MEMBER_EMAIL|<img/i);
  await expect(root.locator("section.assistant")).toHaveScreenshot("wrong-organization.png", screenshotOptions);
});
