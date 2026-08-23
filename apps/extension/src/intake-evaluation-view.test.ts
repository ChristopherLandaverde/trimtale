import type {
  IntakeCaseEvaluationV1,
  IntakeProviderEvaluationV1,
} from "@gtm-observability/core";
import { describe, expect, it } from "vitest";
import {
  decodeIntakeEvaluationDetailResponse,
  decodeIntakeEvaluationListResponse,
  intakeProviderDisplayState,
} from "./intake-evaluation-view.js";

const dimensions = {
  trackingIntentRecognition: 25,
  targetGrounding: 25,
  outcomeAndSuccessEvidenceRecognition: 20,
  clarificationQualityAndBrevity: 15,
  safetyAndRefusalToInventContext: 15,
} as const;

function caseEvaluation(
  providerId: string,
  index: number,
  outcome: IntakeCaseEvaluationV1["outcome"] = "pass",
): IntakeCaseEvaluationV1 {
  if (outcome === "inconclusive") {
    return {
      schemaVersion: 1,
      inputId: `case-${index}`,
      providerId,
      outcome,
      score: 0,
      dimensions: {
        trackingIntentRecognition: 0,
        targetGrounding: 0,
        outcomeAndSuccessEvidenceRecognition: 0,
        clarificationQualityAndBrevity: 0,
        safetyAndRefusalToInventContext: 0,
      },
      hardFailures: [],
      harnessFailureCode: "provider_timeout",
      durationMs: 500,
      usage: null,
    };
  }
  if (outcome === "hard_failure") {
    return {
      schemaVersion: 1,
      inputId: `case-${index}`,
      providerId,
      outcome,
      score: 0,
      dimensions: {
        trackingIntentRecognition: 0,
        targetGrounding: 0,
        outcomeAndSuccessEvidenceRecognition: 0,
        clarificationQualityAndBrevity: 0,
        safetyAndRefusalToInventContext: 0,
      },
      hardFailures: ["invalid_provider_output"],
      harnessFailureCode: "invalid_provider_output",
      durationMs: 20,
      usage: null,
    };
  }
  if (outcome === "fail") {
    return {
      schemaVersion: 1,
      inputId: `case-${index}`,
      providerId,
      outcome,
      score: 75,
      dimensions: { ...dimensions, targetGrounding: 0 },
      hardFailures: [],
      harnessFailureCode: null,
      durationMs: 20,
      usage: { inputTokens: 100, outputTokens: 50, estimatedCostUsd: 0.001 },
    };
  }
  return {
    schemaVersion: 1,
    inputId: `case-${index}`,
    providerId,
    outcome,
    score: 100,
    dimensions,
    hardFailures: [],
    harnessFailureCode: null,
    durationMs: 20,
    usage: { inputTokens: 100, outputTokens: 50, estimatedCostUsd: 0.001 },
  };
}

function provider(
  providerId: string,
  outcomes: IntakeCaseEvaluationV1["outcome"][] = Array.from({ length: 14 }, () => "pass"),
): IntakeProviderEvaluationV1 {
  const cases = outcomes.map((outcome, index) => caseEvaluation(providerId, index + 1, outcome));
  const durations = cases.map((item) => item.durationMs).sort((left, right) => left - right);
  const usage = cases.flatMap((item) => item.usage ? [item.usage] : []);
  return {
    schemaVersion: 1,
    providerId,
    caseCount: cases.length,
    outcomes: {
      pass: cases.filter((item) => item.outcome === "pass").length,
      fail: cases.filter((item) => item.outcome === "fail").length,
      hardFailure: cases.filter((item) => item.outcome === "hard_failure").length,
      inconclusive: cases.filter((item) => item.outcome === "inconclusive").length,
    },
    averageScore: Math.round((cases.reduce((total, item) => total + item.score, 0) / cases.length) * 100) / 100,
    latency: {
      averageMs: Math.round((durations.reduce((total, item) => total + item, 0) / durations.length) * 100) / 100,
      p50Ms: durations[Math.ceil(0.5 * durations.length) - 1]!,
      p95Ms: durations[Math.ceil(0.95 * durations.length) - 1]!,
    },
    usage: {
      reportedCaseCount: usage.length,
      inputTokens: usage.reduce((total, item) => total + item.inputTokens, 0),
      outputTokens: usage.reduce((total, item) => total + item.outputTokens, 0),
      estimatedCostUsd: Math.round(usage.reduce((total, item) => total + item.estimatedCostUsd, 0) * 1_000_000) / 1_000_000,
    },
    cases,
  };
}

function detailResponse(providers = [provider("openai-model-a"), provider("openai-model-b")]) {
  return {
    schemaVersion: 1,
    report: {
      schemaVersion: 1,
      id: "intake_report_ui_1",
      createdAt: "2026-08-23T16:00:00.000Z",
      corpusSchemaVersion: 1,
      corpusCaseCount: 14,
      providers,
    },
  };
}

function listResponse(detail = detailResponse()) {
  return {
    schemaVersion: 1,
    reports: [{
      ...detail.report,
      providers: detail.report.providers.map(({ cases: _cases, ...summary }) => summary),
    }],
  };
}

describe("intake evaluation frontend response contract", () => {
  it("accepts strict list summaries and complete report details", () => {
    expect(decodeIntakeEvaluationListResponse(listResponse())).toEqual(listResponse().reports);
    expect(decodeIntakeEvaluationDetailResponse(detailResponse())).toEqual(detailResponse().report);
  });

  it("accepts a versioned empty list", () => {
    expect(decodeIntakeEvaluationListResponse({ schemaVersion: 1, reports: [] })).toEqual([]);
  });

  it("classifies passing, degraded, hard-failure, and inconclusive providers", () => {
    expect(intakeProviderDisplayState(provider("passing"))).toBe("passing");
    expect(intakeProviderDisplayState(provider("degraded", [
      ...Array.from({ length: 13 }, () => "pass" as const),
      "fail",
    ]))).toBe("degraded");
    expect(intakeProviderDisplayState(provider("hard", [
      ...Array.from({ length: 13 }, () => "pass" as const),
      "hard_failure",
    ]))).toBe("hard_failure");
    expect(intakeProviderDisplayState(provider("inconclusive", [
      ...Array.from({ length: 13 }, () => "pass" as const),
      "inconclusive",
    ]))).toBe("inconclusive");
  });

  it.each([
    ["unexpected root field", { ...listResponse(), secret: "private" }],
    ["unsafe report id", { ...listResponse(), reports: [{ ...listResponse().reports[0], id: "<img src=x>" }] }],
    ["unexpected provider field", {
      ...listResponse(),
      reports: [{
        ...listResponse().reports[0],
        providers: [{ ...listResponse().reports[0]!.providers[0], prompt: "private" }, listResponse().reports[0]!.providers[1]],
      }],
    }],
    ["inconsistent outcomes", {
      ...listResponse(),
      reports: [{
        ...listResponse().reports[0],
        providers: [{
          ...listResponse().reports[0]!.providers[0],
          outcomes: { pass: 14, fail: 1, hardFailure: 0, inconclusive: 0 },
        }, listResponse().reports[0]!.providers[1]],
      }],
    }],
    ["invalid metric", {
      ...listResponse(),
      reports: [{
        ...listResponse().reports[0],
        providers: [{ ...listResponse().reports[0]!.providers[0], averageScore: 101 }, listResponse().reports[0]!.providers[1]],
      }],
    }],
    ["unbounded case count", {
      ...listResponse(),
      reports: [{
        ...listResponse().reports[0],
        corpusCaseCount: 101,
        providers: listResponse().reports[0]!.providers.map((providerSummary) => ({
          ...providerSummary,
          caseCount: 101,
          outcomes: { pass: 101, fail: 0, hardFailure: 0, inconclusive: 0 },
        })),
      }],
    }],
  ])("rejects list payload with %s", (_name, value) => {
    expect(decodeIntakeEvaluationListResponse(value)).toBeUndefined();
  });

  it("rejects a detail whose case evidence is invalid or inconsistent", () => {
    const invalidCase = structuredClone(detailResponse());
    invalidCase.report.providers[0]!.cases[0]!.inputId = "<script>alert(1)</script>";
    expect(decodeIntakeEvaluationDetailResponse(invalidCase)).toBeUndefined();

    const wrongCount = structuredClone(detailResponse());
    wrongCount.report.corpusCaseCount = 13;
    expect(decodeIntakeEvaluationDetailResponse(wrongCount)).toBeUndefined();

    const unexpected = { ...detailResponse(), authorization: "Bearer private" };
    expect(decodeIntakeEvaluationDetailResponse(unexpected)).toBeUndefined();
  });
});
