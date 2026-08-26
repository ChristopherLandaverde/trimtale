import { describe, expect, it } from "vitest";
import {
  STAGE1_GOOGLE_TARGET,
  assertSmokeApi,
  assertSmokeExtension,
  assertSmokePage,
  containerIdFromScript,
  stage1SmokeEnvironment,
  verifySmokeRecognition,
} from "./stage1-google-smoke.mjs";

const extensionId = "a".repeat(32);

describe("credentialed Stage 1 workflow", () => {
  it("recognizes container IDs only from the official GTM loader", () => {
    expect(containerIdFromScript(
      "https://www.googletagmanager.com/gtm.js?id=GTM-PCJ3Q5RK",
      STAGE1_GOOGLE_TARGET.url,
    )).toBe("GTM-PCJ3Q5RK");
    expect(containerIdFromScript(
      "https://attacker.example/?next=googletagmanager.com/gtm.js&id=GTM-PCJ3Q5RK",
      STAGE1_GOOGLE_TARGET.url,
    )).toBeUndefined();
    expect(containerIdFromScript(
      "http://www.googletagmanager.com/gtm.js?id=GTM-PCJ3Q5RK",
      STAGE1_GOOGLE_TARGET.url,
    )).toBeUndefined();
    expect(containerIdFromScript(
      "https://www.googletagmanager.com/alternate.js?id=GTM-PCJ3Q5RK",
      STAGE1_GOOGLE_TARGET.url,
    )).toBeUndefined();
  });

  it("accepts readiness only from the launched API session", () => {
    expect(() => assertSmokeApi({
      status: "ok",
      service: "gtm-observability-api",
      sessionId: "current-session",
    }, "current-session")).not.toThrow();
    expect(() => assertSmokeApi({
      status: "ok",
      service: "gtm-observability-api",
      sessionId: "stale-session",
    }, "current-session")).toThrow("launched API session");
    expect(() => assertSmokeApi({
      status: "ok",
      service: "gtm-observability-api",
    }, "current-session")).toThrow("launched API session");
  });

  it("locks the publication session to the disposable target", () => {
    expect(stage1SmokeEnvironment({
      SAFE_BASE: "kept",
      GOOGLE_ANALYTICS_WRITES_ENABLED: "true",
    }, "current-session")).toMatchObject({
      SAFE_BASE: "kept",
      GOOGLE_GTM_CONTAINER_WRITES_ENABLED: "true",
      GOOGLE_GTM_PUBLICATION_SCOPE_REQUESTED: "true",
      GOOGLE_GTM_PUBLICATION_ENABLED: "true",
      GOOGLE_GTM_WRITE_TARGET_PUBLIC_ID: "GTM-PCJ3Q5RK",
      GOOGLE_ANALYTICS_WRITES_ENABLED: "false",
      STAGE1_SMOKE_SESSION_ID: "current-session",
    });
    expect(() => stage1SmokeEnvironment({}, " ")).toThrow("session identity");
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
    expect(() => assertSmokePage(
      "https://consentflow-psi.vercel.app/admin",
      ["GTM-PCJ3Q5RK"],
    )).toThrow("website target");
    expect(() => assertSmokePage(
      "https://consentflow-psi.vercel.app/?redirect=attacker",
      ["GTM-PCJ3Q5RK"],
    )).toThrow("website target");
    expect(() => assertSmokePage(
      "https://consentflow-psi.vercel.app/#redirect=attacker",
      ["GTM-PCJ3Q5RK"],
    )).toThrow("website target");
    expect(() => assertSmokePage(STAGE1_GOOGLE_TARGET.url, ["GTM-OTHER123"]))
      .toThrow("container target");
  });

  it("requires the exact recognized container and GA4 destination", async () => {
    const recognized = {
      containerWritesEnabled: true,
      result: {
        status: "recognized",
        publicId: STAGE1_GOOGLE_TARGET.publicId,
        container: { publicId: STAGE1_GOOGLE_TARGET.publicId },
        measurementIds: [STAGE1_GOOGLE_TARGET.measurementId],
      },
    };
    await expect(verifySmokeRecognition(async () => new Response(JSON.stringify(recognized))))
      .resolves.toBeUndefined();
    await expect(verifySmokeRecognition(async () => new Response(JSON.stringify({
      ...recognized,
      result: { ...recognized.result, measurementIds: ["G-OTHER123"] },
    })))).rejects.toThrow("GA4 destination");
    await expect(verifySmokeRecognition(async () => new Response(JSON.stringify({
      ...recognized,
      result: { status: "ambiguous", publicId: STAGE1_GOOGLE_TARGET.publicId },
    })))).rejects.toThrow("container recognition");
  });
});
