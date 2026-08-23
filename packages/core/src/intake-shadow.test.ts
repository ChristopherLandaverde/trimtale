import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  IntakeShadowHarness,
  assertIntakeShadowRecord,
  type IntakeShadowProvider,
} from "./intake-shadow.js";
import {
  assertIntakeAcceptanceCorpus,
  type IntakeAcceptanceCorpusV1,
  type IntakeInterpretationInputV1,
} from "./intake-interpretation.js";

function loadCorpus(): IntakeAcceptanceCorpusV1 {
  const value: unknown = JSON.parse(readFileSync(
    resolve(process.cwd(), "tests/acceptance/intake-interpretation.json"),
    "utf8",
  ));
  assertIntakeAcceptanceCorpus(value);
  return value;
}

function fixtureProvider(corpus: IntakeAcceptanceCorpusV1, id = "fixture-provider"): IntakeShadowProvider {
  const expectedByInput = new Map(corpus.cases.map((item) => [JSON.stringify(item.input), item.expected]));
  return {
    id,
    async interpret(input) {
      const expected = expectedByInput.get(JSON.stringify(input));
      if (!expected) throw new Error("Fixture input is missing.");
      return {
        interpretation: structuredClone(expected),
        usage: { inputTokens: 120, outputTokens: 40, estimatedCostUsd: 0.0002 },
      };
    },
  };
}

function sequentialIds(): () => string {
  let sequence = 0;
  return () => `shadow_run_${++sequence}`;
}

describe("intake shadow harness", () => {
  it("pairs validated provider interpretations with every deterministic corpus baseline", async () => {
    const corpus = loadCorpus();
    const harness = new IntakeShadowHarness(fixtureProvider(corpus), {
      createRunId: sequentialIds(),
      now: () => Date.parse("2026-08-23T14:00:00.000Z"),
    });

    const records = await harness.runCorpus(corpus.cases);

    expect(records).toHaveLength(14);
    for (const [index, record] of records.entries()) {
      const item = corpus.cases[index]!;
      assertIntakeShadowRecord(item.input, record);
      expect(record).toMatchObject({
        status: "accepted",
        inputId: item.id,
        providerId: "fixture-provider",
        deterministicBaseline: item.expected,
        providerInterpretation: item.expected,
        failureCode: null,
        usage: { inputTokens: 120, outputTokens: 40, estimatedCostUsd: 0.0002 },
      });
      expect(record.providerInterpretation?.authority).toEqual({
        canConfirmSpecification: false,
        canWriteGtm: false,
        canReportEvidenceVerdict: false,
        canClaimPlatformReceipt: false,
      });
    }
  });

  it("fails invalid input and baseline before calling a provider", async () => {
    const ordinary = loadCorpus().cases[0]!;
    let calls = 0;
    const provider: IntakeShadowProvider = {
      id: "never-called",
      async interpret() {
        calls += 1;
        return { interpretation: ordinary.expected };
      },
    };
    const harness = new IntakeShadowHarness(provider, { createRunId: sequentialIds() });

    await expect(harness.run({
      inputId: ordinary.id,
      input: { ...ordinary.input, fullHtml: "<form>private</form>" },
      deterministicBaseline: ordinary.expected,
    })).rejects.toMatchObject({ code: "invalid_input" });

    await expect(harness.run({
      inputId: ordinary.id,
      input: ordinary.input,
      deterministicBaseline: {
        ...ordinary.expected,
        authority: { ...ordinary.expected.authority, canWriteGtm: true },
      },
    })).rejects.toMatchObject({ code: "invalid_baseline" });

    expect(calls).toBe(0);
  });

  it("discards invalid provider output and raw response details", async () => {
    const ordinary = loadCorpus().cases[0]!;
    const privateResponse = "provider-private-response-sentinel";
    const harness = new IntakeShadowHarness({
      id: "invalid-output-provider",
      async interpret() {
        return {
          interpretation: {
            ...ordinary.expected,
            groundedTargetCandidateIds: ["invented-target"],
            selector: "#private-form",
          },
          rawResponse: privateResponse,
        };
      },
    }, { createRunId: sequentialIds() });

    const record = await harness.run({
      inputId: ordinary.id,
      input: ordinary.input,
      deterministicBaseline: ordinary.expected,
    });

    assertIntakeShadowRecord(ordinary.input, record);
    expect(record).toMatchObject({
      status: "rejected",
      providerInterpretation: null,
      failureCode: "invalid_provider_output",
      usage: null,
    });
    expect(JSON.stringify(record)).not.toContain(privateResponse);
    expect(JSON.stringify(record)).not.toContain("#private-form");

    const invalidUsageHarness = new IntakeShadowHarness({
      id: "invalid-usage-provider",
      async interpret() {
        return {
          interpretation: ordinary.expected,
          usage: { inputTokens: 120, outputTokens: 40, estimatedCostUsd: -1 },
        };
      },
    }, { createRunId: sequentialIds() });
    await expect(invalidUsageHarness.run({
      inputId: ordinary.id,
      input: ordinary.input,
      deterministicBaseline: ordinary.expected,
    })).resolves.toMatchObject({ status: "rejected", failureCode: "invalid_provider_output" });
  });

  it("records provider errors without exception text", async () => {
    const ordinary = loadCorpus().cases[0]!;
    const exceptionSentinel = "provider-exception-private-sentinel";
    const harness = new IntakeShadowHarness({
      id: "throwing-provider",
      async interpret() {
        throw new Error(exceptionSentinel);
      },
    }, { createRunId: sequentialIds() });

    const record = await harness.run({
      inputId: ordinary.id,
      input: ordinary.input,
      deterministicBaseline: ordinary.expected,
    });

    expect(record).toMatchObject({
      status: "inconclusive",
      providerInterpretation: null,
      failureCode: "provider_error",
      usage: null,
    });
    expect(JSON.stringify(record)).not.toContain(exceptionSentinel);
  });

  it("bounds provider execution and aborts timed-out adapters", async () => {
    const ordinary = loadCorpus().cases[0]!;
    let aborted = false;
    const harness = new IntakeShadowHarness({
      id: "timed-out-provider",
      interpret(_input, context) {
        context.signal.addEventListener("abort", () => { aborted = true; });
        return new Promise(() => undefined);
      },
    }, { createRunId: sequentialIds(), timeoutMs: 5 });

    const record = await harness.run({
      inputId: ordinary.id,
      input: ordinary.input,
      deterministicBaseline: ordinary.expected,
    });

    expect(record).toMatchObject({
      status: "inconclusive",
      providerInterpretation: null,
      failureCode: "provider_timeout",
      usage: null,
    });
    expect(aborted).toBe(true);
  });

  it("retains no messages, labels, sentinels, or provider mutations", async () => {
    const privateCase = loadCorpus().cases.find((item) => item.id === "private-values-are-redacted")!;
    const originalInput = structuredClone(privateCase.input);
    const modelFacingCopy: IntakeInterpretationInputV1[] = [];
    const harness = new IntakeShadowHarness({
      id: "mutation-probe-provider",
      async interpret(input) {
        modelFacingCopy.push(structuredClone(input));
        input.messages[0] = "provider mutation";
        input.pageCandidates[0]!.label = "provider label mutation";
        return { interpretation: privateCase.expected };
      },
    }, { createRunId: sequentialIds() });

    const record = await harness.run({
      inputId: privateCase.id,
      input: privateCase.input,
      deterministicBaseline: privateCase.expected,
    });

    expect(privateCase.input).toEqual(originalInput);
    expect(modelFacingCopy).toEqual([originalInput]);
    const persisted = JSON.stringify(record);
    for (const message of privateCase.input.messages) expect(persisted).not.toContain(message);
    for (const candidate of privateCase.input.pageCandidates) expect(persisted).not.toContain(candidate.label);
    for (const candidate of privateCase.input.successEvidenceCandidates) expect(persisted).not.toContain(candidate.label);
    for (const sentinel of privateCase.privateSentinels) expect(persisted).not.toContain(sentinel);
    expect(persisted).not.toContain("provider mutation");
  });
});
