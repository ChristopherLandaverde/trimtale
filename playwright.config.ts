import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";

const reuseExistingServer = process.env.PLAYWRIGHT_REUSE_SERVERS === "true";

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  outputDir: "./test-results",
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      name: "api",
      command: "npm run start --workspace @gtm-observability/api",
      url: "http://127.0.0.1:8787/health",
      env: {
        NODE_ENV: "test",
        EXTENSION_ORIGIN: "chrome-extension://gtm-observability-e2e",
        INTAKE_EVALUATION_REPORT_STORE: resolve("tests/fixtures/intake-evaluation-reports.json"),
        TEST_AUTH_ORGANIZATION_ID: "org_beta",
        TEST_AUTH_SESSIONS: JSON.stringify({
          test_admin_access_token_0001: {
            status: "active",
            practitionerId: "user_admin",
            organizationId: "org_beta",
            membershipId: "mem_admin",
            role: "admin",
          },
          test_member_access_token_0001: {
            status: "active",
            practitionerId: "user_member",
            organizationId: "org_beta",
            membershipId: "mem_member",
            role: "member",
          },
          test_wrong_org_token_0001: {
            status: "active",
            practitionerId: "user_wrong",
            organizationId: "org_wrong",
            membershipId: "mem_wrong",
            role: "admin",
          },
        }),
      },
      reuseExistingServer,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      name: "fixture",
      command: "npm run start --workspace @gtm-observability/fixture-site",
      url: "http://127.0.0.1:4173/health",
      reuseExistingServer,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      name: "verification-target",
      command: "npm run start --workspace @gtm-observability/verification-target",
      url: "http://127.0.0.1:4175/health",
      reuseExistingServer,
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
});
