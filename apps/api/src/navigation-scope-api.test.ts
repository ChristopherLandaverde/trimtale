import { describe, expect, it, vi } from "vitest";
import { navigationScopeApiResponse } from "./navigation-scope-api.js";
import type { LocalNavigationScopeProvider } from "./ollama-navigation-scope-provider.js";

const input = {
  schemaVersion: 1 as const,
  messages: ["Track header navigation"],
  groups: [{ id: "header", label: "Header navigation", area: "header" as const, targetCount: 5 }],
};
const interpretation = {
  schemaVersion: 1 as const,
  candidateGroupIds: ["header"],
  ambiguities: ["confirmation_required" as const],
  clarification: "Confirm Header navigation?",
  authority: { canConfirmScope: false as const, canWriteGtm: false as const, canOutputSelectors: false as const },
};

function provider(interpret = vi.fn(async () => interpretation)): LocalNavigationScopeProvider {
  return { id: "ollama", model: "qwen3:30b", interpret };
}

describe("navigation scope agent API", () => {
  it("returns one validated local suggestion with safe provider identity", async () => {
    await expect(navigationScopeApiResponse(
      "POST", "/api/agent/navigation-scope", input, provider(),
    )).resolves.toEqual({
      status: 200,
      body: { interpretation, provider: { id: "ollama", model: "qwen3:30b" } },
    });
  });

  it("fails closed for invalid input, disabled configuration, and provider failure", async () => {
    await expect(navigationScopeApiResponse(
      "POST", "/api/agent/navigation-scope", { ...input, groups: [] }, provider(),
    )).resolves.toMatchObject({ status: 400 });
    await expect(navigationScopeApiResponse(
      "POST", "/api/agent/navigation-scope", input, undefined,
    )).resolves.toEqual({
      status: 503,
      body: { error: "The local agent model is disabled.", code: "local_model_disabled" },
    });
    await expect(navigationScopeApiResponse(
      "POST",
      "/api/agent/navigation-scope",
      input,
      provider(vi.fn(async () => { throw new Error("private provider detail"); })),
    )).resolves.toEqual({
      status: 503,
      body: { error: "The local agent model is unavailable.", code: "local_model_unavailable" },
    });
  });

  it("does not claim unrelated routes and rejects other methods", async () => {
    await expect(navigationScopeApiResponse("POST", "/api/other", input, provider())).resolves.toBeUndefined();
    await expect(navigationScopeApiResponse(
      "GET", "/api/agent/navigation-scope", input, provider(),
    )).resolves.toMatchObject({ status: 405 });
  });
});
