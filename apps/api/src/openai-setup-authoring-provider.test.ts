import type {
  SetupAuthoringInputV1,
  SetupAuthoringProposalV1,
} from "@gtm-observability/core";
import { describe, expect, it, vi } from "vitest";
import { OPENAI_RESPONSES_ENDPOINT } from "./openai-intake-provider.js";
import {
  OpenAISetupAuthoringProvider,
  openAISetupAuthoringConfig,
  SETUP_AUTHORING_JSON_SCHEMA,
  type SetupProviderFetch,
} from "./openai-setup-authoring-provider.js";

const API_KEY = "sk-test-owner-secret-that-must-never-leak";

const input: SetupAuthoringInputV1 = {
  schemaVersion: 1,
  requestId: "author_phone",
  intent: "Track phone link clicks",
  businessOutcome: "Measure call intent",
  existingEventNames: [],
  firingPolicyCandidates: [{ id: "phone-links", label: "Phone links", sourceType: "click" }],
  valueCandidates: [{ id: "click-url", label: "Clicked link URL", sourceType: "built_in_variable" }],
  privacy: { redactedValueCount: 1, truncatedLabelIds: [] },
};

const proposal: SetupAuthoringProposalV1 = {
  schemaVersion: 1,
  status: "ready",
  eventName: "phone_click",
  firingPolicyCandidateIds: ["phone-links"],
  parameters: [{
    name: "link_url",
    classification: "provider_required",
    requirement: "required",
    valueCandidateId: "click-url",
    rationale: "Identify the phone link",
  }],
  clarification: null,
  rationale: "Measure grounded phone-link clicks",
  authority: {
    canSupplySelectors: false,
    canSupplyEvidence: false,
    canWriteGtm: false,
    canApprove: false,
    canPublish: false,
  },
};

function responseBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    status: "completed",
    output: [{
      type: "message",
      status: "completed",
      content: [{ type: "output_text", text: JSON.stringify(proposal) }],
    }],
    usage: { input_tokens: 1_000, output_tokens: 500 },
    ...overrides,
  };
}

function provider(fetchImpl: SetupProviderFetch): OpenAISetupAuthoringProvider {
  return new OpenAISetupAuthoringProvider({
    id: "openai-setup-author",
    model: "model-a-2026-08-24",
    apiKey: API_KEY,
    inputCostPerMillionTokensUsd: 2.5,
    outputCostPerMillionTokensUsd: 10,
    maxOutputTokens: 800,
  }, fetchImpl);
}

describe("OpenAI setup authoring provider", () => {
  it("remains disabled by default and requires complete explicit deployment configuration", () => {
    expect(openAISetupAuthoringConfig({})).toBeUndefined();
    expect(openAISetupAuthoringConfig({ OPENAI_SETUP_AUTHORING_ENABLED: "TRUE" })).toBeUndefined();
    expect(() => openAISetupAuthoringConfig({ OPENAI_SETUP_AUTHORING_ENABLED: "true" }))
      .toThrow(/model|credential|cost|budget/i);
    expect(openAISetupAuthoringConfig({
      OPENAI_SETUP_AUTHORING_ENABLED: "true",
      OPENAI_API_KEY: "sk-test-12345678901234567890",
      OPENAI_SETUP_AUTHORING_MODEL: "gpt-5.4-mini",
      OPENAI_SETUP_AUTHORING_INPUT_COST_PER_MILLION_USD: "1",
      OPENAI_SETUP_AUTHORING_OUTPUT_COST_PER_MILLION_USD: "4",
      OPENAI_SETUP_AUTHORING_MAX_OUTPUT_TOKENS: "1200",
    })).toMatchObject({
      id: "openai-setup-author",
      model: "gpt-5.4-mini",
      maxOutputTokens: 1200,
    });
  });
  it("requests one non-stored strict structured proposal", async () => {
    const fetchImpl = vi.fn<SetupProviderFetch>(async () => new Response(
      JSON.stringify(responseBody()),
      { status: 200 },
    ));
    const signal = new AbortController().signal;

    await expect(provider(fetchImpl).propose(input, { signal })).resolves.toEqual({
      proposal,
      usage: { inputTokens: 1_000, outputTokens: 500, estimatedCostUsd: 0.0075 },
    });

    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe(OPENAI_RESPONSES_ENDPOINT);
    expect(init?.method).toBe("POST");
    expect(init?.signal).toBe(signal);
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      model: "model-a-2026-08-24",
      store: false,
      tools: [],
      input: JSON.stringify(input),
      text: { format: { type: "json_schema", name: "gtm_setup_authoring_v1", strict: true } },
    });
    expect((body.text as { format: { schema: unknown } }).format.schema)
      .toEqual(SETUP_AUTHORING_JSON_SCHEMA);
    expect(JSON.stringify(body)).not.toContain(API_KEY);
    expect(String(body.input)).not.toMatch(/selector|evidence/i);
  });

  it.each([
    ["provider error", async () => new Response("private body", { status: 429 })],
    ["malformed JSON", async () => new Response("{", { status: 200 })],
    ["refusal", async () => new Response(JSON.stringify(responseBody({
      output: [{ type: "message", content: [{ type: "refusal", refusal: "private refusal" }] }],
    })), { status: 200 })],
    ["invalid usage", async () => new Response(JSON.stringify(responseBody({
      usage: { input_tokens: -1, output_tokens: 2 },
    })), { status: 200 })],
    ["transport error", async () => { throw new Error(API_KEY); }],
  ])("fails generically for %s", async (_name, fetchImpl) => {
    await expect(provider(fetchImpl).propose(input, { signal: new AbortController().signal }))
      .rejects.toThrow("OpenAI setup authoring provider request failed.");
  });

  it("rejects unsafe configuration before making a request", () => {
    const fetchImpl = vi.fn<SetupProviderFetch>();
    expect(() => new OpenAISetupAuthoringProvider({
      id: "unsafe id",
      model: "model-a",
      apiKey: API_KEY,
      inputCostPerMillionTokensUsd: 2.5,
      outputCostPerMillionTokensUsd: 10,
      maxOutputTokens: 800,
    }, fetchImpl)).toThrow(/provider id/i);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
