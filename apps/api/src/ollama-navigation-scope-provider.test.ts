import { describe, expect, it, vi } from "vitest";
import {
  configuredOllamaNavigationScopeProvider,
  OLLAMA_CHAT_ENDPOINT,
  OllamaNavigationScopeProvider,
  type OllamaFetch,
} from "./ollama-navigation-scope-provider.js";
import type { NavigationScopeInterpretationInputV1 } from "@gtm-observability/core";

const input: NavigationScopeInterpretationInputV1 = {
  schemaVersion: 1,
  messages: ["Track the header, not the footer"],
  groups: [
    { id: "header", label: "Primary navigation", area: "header", targetCount: 8 },
    { id: "footer", label: "Footer navigation", area: "footer", targetCount: 17 },
  ],
};

const validInterpretation = {
  schemaVersion: 1,
  candidateGroupIds: ["header"],
  ambiguities: ["confirmation_required"],
  clarification: "Model-authored prose with internal id header should not be shown.",
  authority: { canConfirmScope: false, canWriteGtm: false, canOutputSelectors: false },
};

function response(content: unknown, envelope: Record<string, unknown> = {}): Response {
  return new Response(JSON.stringify({
    model: "qwen3:30b",
    done: true,
    message: { role: "assistant", content: JSON.stringify(content) },
    ...envelope,
  }), { status: 200, headers: { "content-type": "application/json" } });
}

describe("Ollama navigation scope provider", () => {
  it("uses the fixed loopback endpoint and structured non-authoritative output", async () => {
    let captured: { input: string | URL; init?: RequestInit } | undefined;
    const fetchImpl: OllamaFetch = async (requestInput, init) => {
      captured = { input: requestInput, ...(init ? { init } : {}) };
      return response(validInterpretation);
    };
    const provider = new OllamaNavigationScopeProvider({ model: "qwen3:30b" }, fetchImpl);
    await expect(provider.interpret(input, new AbortController().signal)).resolves.toEqual({
      ...validInterpretation,
      clarification: "Confirm Primary navigation and exclude Footer navigation?",
    });
    expect(captured?.input).toBe(OLLAMA_CHAT_ENDPOINT);
    const body = JSON.parse(String(captured?.init?.body)) as Record<string, unknown>;
    expect(body).toMatchObject({ model: "qwen3:30b", stream: false, think: false, keep_alive: "30m" });
    const messages = body.messages as Array<{ role: string; content: string }>;
    expect(messages[0]?.content).toContain("one ordered conversation");
    expect(messages[0]?.content).toContain("generic request");
    expect(messages[0]?.content).toContain("all or every observed navigation group");
    expect(messages.at(-1)?.content).not.toContain("selector");
  });

  it("rejects invented groups, authority escalation, malformed envelopes, and provider errors", async () => {
    for (const result of [
      { ...validInterpretation, candidateGroupIds: ["invented"] },
      { ...validInterpretation, authority: { ...validInterpretation.authority, canWriteGtm: true } },
    ]) {
      const provider = new OllamaNavigationScopeProvider({ model: "qwen3:30b" }, async () => response(result));
      await expect(provider.interpret(input, new AbortController().signal)).rejects.toThrow(
        "Local navigation scope interpretation failed.",
      );
    }
    const malformed = new OllamaNavigationScopeProvider(
      { model: "qwen3:30b" },
      async () => response(validInterpretation, { done: false }),
    );
    await expect(malformed.interpret(input, new AbortController().signal)).rejects.toThrow(
      "Local navigation scope interpretation failed.",
    );
    const unavailable = new OllamaNavigationScopeProvider(
      { model: "qwen3:30b" },
      async () => new Response("offline", { status: 503 }),
    );
    await expect(unavailable.interpret(input, new AbortController().signal)).rejects.toThrow(
      "Local navigation scope interpretation failed.",
    );
  });

  it("defaults to the local qwen model and supports an explicit fail-closed disable", () => {
    expect(configuredOllamaNavigationScopeProvider({})).toMatchObject({ id: "ollama", model: "qwen3:30b" });
    expect(configuredOllamaNavigationScopeProvider({ OLLAMA_AGENT_ENABLED: "false" })).toBeUndefined();
  });
});
