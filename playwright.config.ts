import { defineConfig } from "@playwright/test";

const reuseExistingServer = process.env.PLAYWRIGHT_REUSE_SERVERS === "true";

export default defineConfig({
  testDir: "./tests/e2e",
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
    trace: "on",
  },
  webServer: [
    {
      name: "api",
      command: "npm run start --workspace @gtm-observability/api",
      url: "http://127.0.0.1:8787/health",
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
