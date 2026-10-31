import { afterEach, describe, expect, it, vi } from "vitest";
import { handleVercelRequest } from "./vercel.js";

const extensionOrigin = "chrome-extension://abcdefghijklmnopabcdefghijklmnop";
const attackerOrigin = "https://attacker.example";
const deployment = "https://gtm-observability.vercel.app";
const publicRoute = `${deployment}/api/health`;
const googleRoute = `${deployment}/api/google/status`;

function request(url: string, origin?: string, method = "GET"): Request {
  return new Request(url, { method, headers: origin ? { Origin: origin } : {} });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Vercel handler CORS boundary", () => {
  describe("public route", () => {
    it("serves requests without an Origin header", async () => {
      vi.stubEnv("EXTENSION_ORIGIN", extensionOrigin);
      const response = await handleVercelRequest(request(publicRoute));
      expect(response.status).toBe(200);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });

    it("serves the configured extension origin", async () => {
      vi.stubEnv("EXTENSION_ORIGIN", extensionOrigin);
      const response = await handleVercelRequest(request(publicRoute, extensionOrigin));
      expect(response.status).toBe(200);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });

    it("serves other origins because the route is stateless", async () => {
      vi.stubEnv("EXTENSION_ORIGIN", extensionOrigin);
      const response = await handleVercelRequest(request(publicRoute, attackerOrigin));
      expect(response.status).toBe(200);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });

    it("keeps working for the extension when EXTENSION_ORIGIN is unset or a wildcard", async () => {
      for (const configured of [undefined, "*"]) {
        vi.stubEnv("EXTENSION_ORIGIN", configured);
        const response = await handleVercelRequest(request(publicRoute, extensionOrigin));
        expect(response.status).toBe(200);
        expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
      }
    });

    it("answers setup preflights from the extension without EXTENSION_ORIGIN", async () => {
      vi.stubEnv("EXTENSION_ORIGIN", undefined);
      const preflight = await handleVercelRequest(
        request(`${deployment}/api/setups`, extensionOrigin, "OPTIONS"),
      );
      expect(preflight.status).toBe(204);
      expect(preflight.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(preflight.headers.get("Access-Control-Allow-Methods")).toContain("POST");
      expect(preflight.headers.get("Access-Control-Allow-Headers")).toBe("Content-Type");
    });
  });

  describe("Google-prefixed route", () => {
    it("serves non-browser requests without granting cross-origin read access", async () => {
      vi.stubEnv("EXTENSION_ORIGIN", extensionOrigin);
      const response = await handleVercelRequest(request(googleRoute));
      expect(response.status).not.toBe(403);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    });

    it("echoes only the exactly configured extension origin", async () => {
      vi.stubEnv("EXTENSION_ORIGIN", extensionOrigin);
      const response = await handleVercelRequest(request(googleRoute, extensionOrigin));
      expect(response.status).not.toBe(403);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe(extensionOrigin);
    });

    it("refuses other origins, including prefix lookalikes", async () => {
      vi.stubEnv("EXTENSION_ORIGIN", extensionOrigin);
      for (const origin of [attackerOrigin, `${extensionOrigin}.attacker`, "null"]) {
        const response = await handleVercelRequest(request(googleRoute, origin));
        expect(response.status).toBe(403);
        expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
        expect(await response.json()).toEqual({ error: "Request origin is not allowed." });
      }
    });

    it("refuses preflights from other origins", async () => {
      vi.stubEnv("EXTENSION_ORIGIN", extensionOrigin);
      const response = await handleVercelRequest(request(googleRoute, attackerOrigin, "OPTIONS"));
      expect(response.status).toBe(403);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    });

    it("fails closed when EXTENSION_ORIGIN is unset, wildcard, null, or blank", async () => {
      for (const configured of [undefined, "*", "null", "  "]) {
        vi.stubEnv("EXTENSION_ORIGIN", configured);
        for (const origin of [extensionOrigin, attackerOrigin]) {
          const response = await handleVercelRequest(request(googleRoute, origin));
          expect(response.status).toBe(403);
          expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
        }
      }
    });
  });

  describe("unknown route defaults", () => {
    it("refuses mixed-case and percent-encoded protected paths", async () => {
      vi.stubEnv("EXTENSION_ORIGIN", extensionOrigin);
      for (const path of [
        "/api/Google/status",
        "/api/%67oogle/status",
        "/api/INTAKE-EVALUATIONS/report",
        "/api/%69ntake-evaluations/report",
        "/api/not-public",
      ]) {
        const response = await handleVercelRequest(request(`${deployment}${path}`, extensionOrigin));
        expect(response.status).toBe(403);
        expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
      }
    });
  });
});
