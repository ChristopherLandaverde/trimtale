import {
  IntakeShadowHarness,
  type IntakeInterpretationInputV1,
  type IntakeInterpretationV1,
} from "@gtm-observability/core";
import { describe, expect, it, vi } from "vitest";
import {
  OPENAI_RESPONSES_ENDPOINT,
  OpenAIIntakeProvider,
  type IntakeProviderFetch,
} from "./openai-intake-provider.js";

const API_KEY = "sk-test-owner-secret-that-must-never-leak";

const input: IntakeInterpretationInputV1 = {
  schemaVersion: 1,
  messages: ["Track the contact form as a lead"],
  pageCandidates: [
    { id: "contact-sales", label: "Contact sales", kind: "form", position: "main", crossOrigin: false },
  ],
  successEvidenceCandidates: [
    {
      id: "contact-success",
      targetId: "contact-sales",
      label: "Inquiry received message",
      type: "visible_element",
    },
  ],
  privacy: { redactedValueCount: 0, truncatedCandidateLabelIds: [] },
};

const interpretation: IntakeInterpretationV1 = {
  schemaVersion: 1,
  interactionCandidate: "form_submission",
  conversionOutcomeCandidate: "qualified_inquiry",
  groundedTargetCandidateIds: ["contact-sales"],
  groundedSuccessEvidenceCandidateIds: ["contact-success"],
  ambiguities: [],
  clarification: null,
  authority: {
    canConfirmSpecification: false,
    canWriteGtm: false,
    canReportEvidenceVerdict: false,
    canClaimPlatformReceipt: false,
  },
};

function responseBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    status: "completed",
    output: [{
      type: "message",
      status: "completed",
      content: [{ type: "output_text", text: JSON.stringify(interpretation) }],
    }],
    usage: { input_tokens: 1_000, output_tokens: 500 },
    ...overrides,
  };
}

function provider(fetchImpl: IntakeProviderFetch): OpenAIIntakeProvider {
  return new OpenAIIntakeProvider({
    id: "openai-model-a",
    model: "model-a-2026-08-23",
    apiKey: API_KEY,
    inputCostPerMillionTokensUsd: 2.5,
    outputCostPerMillionTokensUsd: 10,
    maxOutputTokens: 800,
  }, fetchImpl);
}

describe("OpenAI intake shadow provider", () => {
  it("requests a non-stored strict structured interpretation and returns bounded usage", async () => {
    const fetchImpl = vi.fn<IntakeProviderFetch>(async () => new Response(JSON.stringify(responseBody()), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    const controller = new AbortController();

    await expect(provider(fetchImpl).interpret(input, { signal: controller.signal })).resolves.toEqual({
      interpretation,
      usage: { inputTokens: 1_000, outputTokens: 500, estimatedCostUsd: 0.0075 },
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe(OPENAI_RESPONSES_ENDPOINT);
    expect(init?.method).toBe("POST");
    expect(init?.signal).toBe(controller.signal);
    expect(new Headers(init?.headers).get("authorization")).toBe(`Bearer ${API_KEY}`);
    expect(new Headers(init?.headers).get("content-type")).toBe("application/json");

    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      model: "model-a-2026-08-23",
      store: false,
      max_output_tokens: 800,
      tools: [],
      input: JSON.stringify(input),
      text: {
        format: {
          type: "json_schema",
          name: "intake_interpretation_v1",
          strict: true,
        },
      },
    });
    expect(body.instructions).toEqual(expect.any(String));
    expect(JSON.stringify(body)).not.toContain(API_KEY);
    expect((body.text as { format: { schema: unknown } }).format.schema).toMatchObject({
      type: "object",
      additionalProperties: false,
      required: [
        "schemaVersion",
        "interactionCandidate",
        "conversionOutcomeCandidate",
        "groundedTargetCandidateIds",
        "groundedSuccessEvidenceCandidateIds",
        "ambiguities",
        "clarification",
        "authority",
      ],
    });
    expect(JSON.stringify((body.text as { format: { schema: unknown } }).format.schema))
      .not.toMatch(/"(?:pattern|minLength|maxLength|minItems|maxItems|uniqueItems)"/);
  });

  it.each([
    ["non-success response", async () => new Response("provider-body-secret", { status: 429 })],
    ["malformed JSON", async () => new Response("{", { status: 200 })],
    ["incomplete response", async () => new Response(JSON.stringify(responseBody({ status: "incomplete" })), { status: 200 })],
    ["missing output", async () => new Response(JSON.stringify(responseBody({ output: [] })), { status: 200 })],
    ["refusal output", async () => new Response(JSON.stringify(responseBody({
      output: [{ type: "message", content: [{ type: "refusal", refusal: "private refusal" }] }],
    })), { status: 200 })],
    ["invalid usage", async () => new Response(JSON.stringify(responseBody({
      usage: { input_tokens: -1, output_tokens: 2 },
    })), { status: 200 })],
    ["transport exception", async () => { throw new Error(`network detail ${API_KEY}`); }],
  ])("fails generically for %s", async (_name, fetchImpl) => {
    const result = provider(fetchImpl).interpret(input, { signal: new AbortController().signal });
    await expect(result).rejects.toThrow("OpenAI intake provider request failed.");
    await expect(result).rejects.not.toThrow(API_KEY);
    await expect(result).rejects.not.toThrow(/provider-body-secret|private refusal|network detail/);
  });

  it("propagates the harness abort signal without exposing transport details", async () => {
    let receivedSignal: AbortSignal | undefined;
    const fetchImpl: IntakeProviderFetch = async (_url, init) => {
      receivedSignal = init?.signal ?? undefined;
      return await new Promise<Response>((_resolve, reject) => {
        receivedSignal?.addEventListener("abort", () => reject(new Error(`aborted ${API_KEY}`)), { once: true });
      });
    };
    const controller = new AbortController();
    const result = provider(fetchImpl).interpret(input, { signal: controller.signal });
    controller.abort();

    await expect(result).rejects.toThrow("OpenAI intake provider request failed.");
    expect(receivedSignal).toBe(controller.signal);
  });

  it("lets the shadow harness classify semantically invalid structured output as a hard failure", async () => {
    const invalidInterpretation = {
      ...interpretation,
      groundedTargetCandidateIds: ["invented-target"],
    };
    const fetchImpl: IntakeProviderFetch = async () => new Response(JSON.stringify(responseBody({
      output: [{
        type: "message",
        status: "completed",
        content: [{ type: "output_text", text: JSON.stringify(invalidInterpretation) }],
      }],
    })), { status: 200 });
    const harness = new IntakeShadowHarness(provider(fetchImpl), {
      now: () => Date.parse("2026-08-23T16:00:00.000Z"),
      createRunId: () => "shadow_openai_invalid",
    });

    await expect(harness.run({
      inputId: "openai-invalid-output",
      input,
      deterministicBaseline: interpretation,
    })).resolves.toMatchObject({
      status: "rejected",
      providerInterpretation: null,
      failureCode: "invalid_provider_output",
      usage: null,
    });
  });

  it("rejects unsafe adapter configuration before making a request", () => {
    const fetchImpl = vi.fn<IntakeProviderFetch>();
    const base = {
      id: "openai-model-a",
      model: "model-a",
      apiKey: API_KEY,
      inputCostPerMillionTokensUsd: 2.5,
      outputCostPerMillionTokensUsd: 10,
      maxOutputTokens: 800,
    };

    expect(() => new OpenAIIntakeProvider({ ...base, id: "unsafe id" }, fetchImpl)).toThrow(/provider id/i);
    expect(() => new OpenAIIntakeProvider({ ...base, model: "unsafe model" }, fetchImpl)).toThrow(/model/i);
    expect(() => new OpenAIIntakeProvider({ ...base, apiKey: "short" }, fetchImpl)).toThrow(/credential/i);
    expect(() => new OpenAIIntakeProvider({ ...base, inputCostPerMillionTokensUsd: -1 }, fetchImpl)).toThrow(/cost/i);
    expect(() => new OpenAIIntakeProvider({ ...base, inputCostPerMillionTokensUsd: 0 }, fetchImpl)).toThrow(/cost/i);
    expect(() => new OpenAIIntakeProvider({ ...base, maxOutputTokens: 0 }, fetchImpl)).toThrow(/output/i);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
