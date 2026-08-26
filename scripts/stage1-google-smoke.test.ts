import { describe, expect, it } from "vitest";
import {
  STAGE1_GOOGLE_TARGET,
  assertSmokeExtension,
  assertSmokePage,
  stage1SmokeEnvironment,
} from "./stage1-google-smoke.mjs";

const extensionId = "a".repeat(32);

describe("credentialed Stage 1 workflow", () => {
  it("locks the publication session to the disposable target", () => {
    expect(stage1SmokeEnvironment({ SAFE_BASE: "kept" })).toMatchObject({
      SAFE_BASE: "kept",
      GOOGLE_GTM_CONTAINER_WRITES_ENABLED: "true",
      GOOGLE_GTM_PUBLICATION_SCOPE_REQUESTED: "true",
      GOOGLE_GTM_PUBLICATION_ENABLED: "true",
      GOOGLE_GTM_WRITE_TARGET_PUBLIC_ID: "GTM-PCJ3Q5RK",
    });
  });

  it("accepts only the configured extension origin", () => {
    expect(() => assertSmokeExtension(
      `chrome-extension://${extensionId}`,
      `chrome-extension://${extensionId}/service-worker.js`,
    )).not.toThrow();
    expect(() => assertSmokeExtension(
      `chrome-extension://${extensionId}`,
      `chrome-extension://${"b".repeat(32)}/service-worker.js`,
    )).toThrow("extension origin");
  });

  it("accepts only the exact website and one observed disposable container", () => {
    expect(() => assertSmokePage(
      STAGE1_GOOGLE_TARGET.url,
      ["gtm-pcj3q5rk", "GTM-PCJ3Q5RK"],
    )).not.toThrow();
    expect(() => assertSmokePage("https://example.test/", ["GTM-PCJ3Q5RK"]))
      .toThrow("website target");
    expect(() => assertSmokePage(STAGE1_GOOGLE_TARGET.url, ["GTM-OTHER123"]))
      .toThrow("container target");
  });
});
