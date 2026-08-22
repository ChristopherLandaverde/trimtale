import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "./test-results",
  timeout: 45_000,
  expect: {
    timeout: 8_000,
    toHaveScreenshot: {
      // Linux hosts rasterize identical system-font glyphs slightly differently.
      // Structural, role/name, focus, and state assertions remain exact.
      maxDiffPixelRatio: 0.02,
    },
  },
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
      reuseExistingServer: !process.env.CI,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      name: "fixture",
      command: "npm run start --workspace @gtm-observability/fixture-site",
      url: "http://127.0.0.1:4173/health",
      reuseExistingServer: !process.env.CI,
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
});
