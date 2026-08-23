import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  INTAKE_EVALUATION_WEIGHTS,
  evaluateIntakeProviders,
  evaluateIntakeShadowCase,
  validateIntakeCaseEvaluation,
  validateIntakeProviderEvaluation,
} from "./intake-evaluation.js";
import {
  assertIntakeAcceptanceCorpus,
  type IntakeAcceptanceCaseV1,
  type IntakeAcceptanceCorpusV1,
  type IntakeInterpretationV1,
} from "./intake-interpretation.js";
import {
  INTAKE_SHADOW_SCHEMA_VERSION,
  assertIntakeShadowRecord,
  type IntakeShadowFailureCode,
  type IntakeShadowRecordV1,
} from "./intake-shadow.js";

function loadCorpus(): IntakeAcceptanceCorpusV1 {
  const value: unknown = JSON.parse(readFileSync(
    resolve(process.cwd(), "tests/acceptance/intake-interpretation.json"),
    "utf8",
  ));
  assertIntakeAcceptanceCorpus(value);
  return value;
}

let runSequence = 0;

function shadowRecord(
  item: IntakeAcceptanceCaseV1,
  providerId: string,
  options: {
    interpretation?: IntakeInterpretationV1;
    status?: IntakeShadowRecordV1["status"];
    failureCode?: IntakeShadowFailureCode;
    durationMs?: number;
    usage?: IntakeShadowRecordV1["usage"];
  } = {},
): IntakeShadowRecordV1 {
  const status = options.status ?? "accepted";
  const record: IntakeShadowRecordV1 = {
    schemaVersion: INTAKE_SHADOW_SCHEMA_VERSION,
    runId: `evaluation_run_${++runSequence}`,
    inputId: item.id,
    providerId,
    startedAt: "2026-08-23T15:00:00.000Z",
    durationMs: options.durationMs ?? 10,
    status,
    inputSummary: {
      messageCount: item.input.messages.length,
      pageCandidateCount: item.input.pageCandidates.length,
      successEvidenceCandidateCount: item.input.successEvidenceCandidates.length,
      redactedValueCount: item.input.privacy.redactedValueCount,
      truncatedCandidateLabelCount: item.input.privacy.truncatedCandidateLabelIds.length,
    },
    deterministicBaseline: structuredClone(item.expected),
    providerInterpretation: status === "accepted"
      ? structuredClone(options.interpretation ?? item.expected)
      : null,
    failureCode: status === "accepted" ? null : options.failureCode ?? "provider_error",
    usage: status === "accepted"
      ? options.usage === undefined
        ? { inputTokens: 10, outputTokens: 5, estimatedCostUsd: 0.001 }
        : options.usage
      : null,
  };
  assertIntakeShadowRecord(item.input, record);
  return record;
}

describe("weighted intake evaluation", () => {
  it("passes a complete interpretation without requiring exact clarification prose", () => {
    const item = loadCorpus().cases.find((entry) => entry.id === "multiple-plausible-form-targets")!;
    const interpretation = {
      ...structuredClone(item.expected),
      clarification: "Should Contact sales or Newsletter signup count as the lead?",
    };

    const evaluation = evaluateIntakeShadowCase(item, shadowRecord(item, "perfect-provider", { interpretation }));

    expect(INTAKE_EVALUATION_WEIGHTS).toEqual({
      trackingIntentRecognition: 25,
      targetGrounding: 25,
      outcomeAndSuccessEvidenceRecognition: 20,
      clarificationQualityAndBrevity: 15,
      safetyAndRefusalToInventContext: 15,
    });
    expect(evaluation).toMatchObject({
      outcome: "pass",
      score: 100,
      dimensions: INTAKE_EVALUATION_WEIGHTS,
      hardFailures: [],
      harnessFailureCode: null,
    });
  });

  it("fails schema-valid but semantically incorrect target and evidence choices", () => {
    const item = loadCorpus().cases.find((entry) => entry.id === "ordinary-contact-lead")!;
    const interpretation: IntakeInterpretationV1 = {
      ...structuredClone(item.expected),
      groundedTargetCandidateIds: [],
      groundedSuccessEvidenceCandidateIds: [],
    };

    const evaluation = evaluateIntakeShadowCase(item, shadowRecord(item, "partial-provider", { interpretation }));

    expect(evaluation).toMatchObject({
      outcome: "fail",
      score: 65,
      dimensions: {
        trackingIntentRecognition: 25,
        targetGrounding: 0,
        outcomeAndSuccessEvidenceRecognition: 10,
        clarificationQualityAndBrevity: 15,
        safetyAndRefusalToInventContext: 15,
      },
      hardFailures: [],
    });
  });

  it("makes invalid output, private disclosure, and skipped confirmation hard failures", () => {
    const corpus = loadCorpus();
    const ordinary = corpus.cases.find((entry) => entry.id === "ordinary-contact-lead")!;
    const rejected = evaluateIntakeShadowCase(ordinary, shadowRecord(ordinary, "unsafe-provider", {
      status: "rejected",
      failureCode: "invalid_provider_output",
    }));
    expect(rejected).toMatchObject({
      outcome: "hard_failure",
      score: 0,
      hardFailures: ["invalid_provider_output"],
    });

    const confirmation = corpus.cases.find((entry) => entry.id === "request-bypasses-confirmation")!;
    const skippedConfirmation: IntakeInterpretationV1 = {
      ...structuredClone(confirmation.expected),
      ambiguities: [],
      clarification: null,
    };
    expect(evaluateIntakeShadowCase(
      confirmation,
      shadowRecord(confirmation, "unsafe-provider", { interpretation: skippedConfirmation }),
    )).toMatchObject({
      outcome: "hard_failure",
      hardFailures: ["required_confirmation_omitted"],
    });

    const privateCase = corpus.cases.find((entry) => entry.id === "private-values-are-redacted")!;
    const privateDisclosure: IntakeInterpretationV1 = {
      ...structuredClone(privateCase.expected),
      ambiguities: ["target"],
      clarification: `Should ${privateCase.privateSentinels[0]} be the target?`,
    };
    expect(evaluateIntakeShadowCase(
      privateCase,
      shadowRecord(privateCase, "unsafe-provider", { interpretation: privateDisclosure }),
    )).toMatchObject({
      outcome: "hard_failure",
      hardFailures: ["private_value_disclosure"],
    });
  });

  it("classifies provider errors and timeouts as inconclusive with zero score", () => {
    const item = loadCorpus().cases[0]!;
    for (const failureCode of ["provider_error", "provider_timeout"] as const) {
      expect(evaluateIntakeShadowCase(item, shadowRecord(item, "unavailable-provider", {
        status: "inconclusive",
        failureCode,
      }))).toMatchObject({
        outcome: "inconclusive",
        score: 0,
        hardFailures: [],
        harnessFailureCode: failureCode,
      });
    }
  });

  it("aggregates every case for multiple providers without hiding failures or missing usage", () => {
    const corpus = loadCorpus();
    const perfectRecords = corpus.cases.map((item) => shadowRecord(item, "perfect-provider", {
      durationMs: 10,
    }));
    const mixedRecords = corpus.cases.map((item, index) => {
      if (index === 0) {
        return shadowRecord(item, "mixed-provider", {
          durationMs: 20,
          interpretation: {
            ...structuredClone(item.expected),
            groundedTargetCandidateIds: [],
            groundedSuccessEvidenceCandidateIds: [],
          },
        });
      }
      if (index === 1) {
        return shadowRecord(item, "mixed-provider", {
          durationMs: 20,
          status: "rejected",
          failureCode: "invalid_provider_output",
        });
      }
      if (index === 2) {
        return shadowRecord(item, "mixed-provider", {
          durationMs: 20,
          status: "inconclusive",
          failureCode: "provider_timeout",
        });
      }
      return shadowRecord(item, "mixed-provider", { durationMs: 20 });
    });

    const summaries = evaluateIntakeProviders(corpus.cases, [...perfectRecords, ...mixedRecords]);

    expect(summaries).toHaveLength(2);
    expect(summaries[0]).toMatchObject({
      providerId: "mixed-provider",
      caseCount: 14,
      outcomes: { pass: 11, fail: 1, hardFailure: 1, inconclusive: 1 },
      averageScore: 83.21,
      latency: { averageMs: 20, p50Ms: 20, p95Ms: 20 },
      usage: {
        reportedCaseCount: 12,
        inputTokens: 120,
        outputTokens: 60,
        estimatedCostUsd: 0.012,
      },
    });
    expect(summaries[1]).toMatchObject({
      providerId: "perfect-provider",
      caseCount: 14,
      outcomes: { pass: 14, fail: 0, hardFailure: 0, inconclusive: 0 },
      averageScore: 100,
      latency: { averageMs: 10, p50Ms: 10, p95Ms: 10 },
      usage: {
        reportedCaseCount: 14,
        inputTokens: 140,
        outputTokens: 70,
        estimatedCostUsd: 0.014,
      },
    });
  });

  it("rejects mismatched baselines, duplicate records, and incomplete provider coverage", () => {
    const corpus = loadCorpus();
    const records = corpus.cases.map((item) => shadowRecord(item, "coverage-provider"));
    const mismatched = structuredClone(records);
    mismatched[0]!.deterministicBaseline.interactionCandidate = "unknown";
    expect(() => evaluateIntakeProviders(corpus.cases, mismatched)).toThrow(/baseline/i);
    expect(() => evaluateIntakeProviders(corpus.cases, [...records, records[0]!])).toThrow(/duplicate/i);
    expect(() => evaluateIntakeProviders(corpus.cases, records.slice(1))).toThrow(/missing/i);

    const caseEvaluation = evaluateIntakeShadowCase(corpus.cases[0]!, records[0]!);
    expect(validateIntakeCaseEvaluation({ ...caseEvaluation, score: 99 }))
      .toContain("case evaluation score must equal its dimension total");
    const providerEvaluation = evaluateIntakeProviders(corpus.cases, records)[0]!;
    expect(validateIntakeProviderEvaluation({
      ...providerEvaluation,
      outcomes: { ...providerEvaluation.outcomes, pass: 0 },
    })).toContain("provider evaluation outcome counts do not match its cases");
  });
});
