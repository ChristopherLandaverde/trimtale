import type {
  IntakeCaseEvaluationV1,
  IntakeProviderEvaluationV1,
} from "@gtm-observability/core";

const fullDimensions = {
  trackingIntentRecognition: 25,
  targetGrounding: 25,
  outcomeAndSuccessEvidenceRecognition: 20,
  clarificationQualityAndBrevity: 15,
  safetyAndRefusalToInventContext: 15,
} as const;

function evaluationCase(
  providerId: string,
  index: number,
  outcome: IntakeCaseEvaluationV1["outcome"],
): IntakeCaseEvaluationV1 {
  const inputId = [
    "ordinary-contact-lead",
    "contextual-bottom-quote-form",
    "business-wording-booked-demo",
    "abbreviated-demo-conversion",
    "misspelled-contact-lead",
    "follow-up-enterprise-correction",
    "multiple-plausible-form-targets",
    "ambiguous-success-evidence",
    "missing-target",
    "cross-origin-target",
    "unsupported-phone-click",
    "prompt-shaped-label",
    "confirmation-bypass",
    "private-value-redaction",
  ][index]!;
  if (outcome === "hard_failure") {
    return {
      schemaVersion: 1,
      inputId,
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
      durationMs: 34,
      usage: null,
    };
  }
  if (outcome === "inconclusive") {
    return {
      schemaVersion: 1,
      inputId,
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
      durationMs: 680,
      usage: null,
    };
  }
  if (outcome === "fail") {
    return {
      schemaVersion: 1,
      inputId,
      providerId,
      outcome,
      score: 75,
      dimensions: { ...fullDimensions, targetGrounding: 0 },
      hardFailures: [],
      harnessFailureCode: null,
      durationMs: 82,
      usage: { inputTokens: 540, outputTokens: 145, estimatedCostUsd: 0.0019 },
    };
  }
  return {
    schemaVersion: 1,
    inputId,
    providerId,
    outcome,
    score: 100,
    dimensions: fullDimensions,
    hardFailures: [],
    harnessFailureCode: null,
    durationMs: 48 + index,
    usage: { inputTokens: 520 + index, outputTokens: 132 + index, estimatedCostUsd: 0.0017 },
  };
}

function provider(
  providerId: string,
  outcomes: IntakeCaseEvaluationV1["outcome"][],
): IntakeProviderEvaluationV1 {
  const cases = outcomes.map((outcome, index) => evaluationCase(providerId, index, outcome));
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
      p50Ms: durations[Math.ceil(durations.length * 0.5) - 1]!,
      p95Ms: durations[Math.ceil(durations.length * 0.95) - 1]!,
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

function report(
  id: string,
  createdAt: string,
  providers: IntakeProviderEvaluationV1[],
) {
  return {
    schemaVersion: 1 as const,
    id,
    createdAt,
    corpusSchemaVersion: 1 as const,
    corpusCaseCount: 14,
    providers,
  };
}

const passingOutcomes = Array.from({ length: 14 }, () => "pass" as const);
const degradedOutcomes: IntakeCaseEvaluationV1["outcome"][] = [
  ...Array.from({ length: 11 }, () => "pass" as const),
  "fail",
  "hard_failure",
  "inconclusive",
];

export const passingIntakeEvaluationReport = report(
  "intake_report_passing",
  "2026-08-23T15:00:00.000Z",
  [
    provider("openai-fast-model", passingOutcomes),
    provider("openai-strong-model", passingOutcomes),
  ],
);

export const degradedIntakeEvaluationReport = report(
  "intake_report_degraded",
  "2026-08-23T16:00:00.000Z",
  [
    provider("openai-fast-model", degradedOutcomes),
    provider("openai-strong-model", passingOutcomes),
  ],
);

function summary(value: typeof passingIntakeEvaluationReport) {
  return {
    ...value,
    providers: value.providers.map(({ cases: _cases, ...providerSummary }) => providerSummary),
  };
}

export const intakeEvaluationListFixture = {
  schemaVersion: 1 as const,
  reports: [summary(degradedIntakeEvaluationReport), summary(passingIntakeEvaluationReport)],
};

export function intakeEvaluationDetailFixture(reportId: string) {
  const selected = reportId === passingIntakeEvaluationReport.id
    ? passingIntakeEvaluationReport
    : degradedIntakeEvaluationReport;
  return { schemaVersion: 1 as const, report: selected };
}
