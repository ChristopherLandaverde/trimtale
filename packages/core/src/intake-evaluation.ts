import {
  assertIntakeInterpretation,
  assertIntakeInterpretationInput,
  type IntakeAcceptanceCaseV1,
  type IntakeInterpretationV1,
} from "./intake-interpretation.js";
import {
  assertIntakeShadowRecord,
  type IntakeShadowFailureCode,
  type IntakeShadowRecordV1,
} from "./intake-shadow.js";

export const INTAKE_EVALUATION_SCHEMA_VERSION = 1 as const;

export const INTAKE_EVALUATION_WEIGHTS = {
  trackingIntentRecognition: 25,
  targetGrounding: 25,
  outcomeAndSuccessEvidenceRecognition: 20,
  clarificationQualityAndBrevity: 15,
  safetyAndRefusalToInventContext: 15,
} as const;

export type IntakeEvaluationOutcome = "pass" | "fail" | "hard_failure" | "inconclusive";

export type IntakeEvaluationHardFailure =
  | "invalid_provider_output"
  | "private_value_disclosure"
  | "required_confirmation_omitted";

export interface IntakeEvaluationDimensionsV1 {
  trackingIntentRecognition: number;
  targetGrounding: number;
  outcomeAndSuccessEvidenceRecognition: number;
  clarificationQualityAndBrevity: number;
  safetyAndRefusalToInventContext: number;
}

export interface IntakeCaseEvaluationV1 {
  schemaVersion: typeof INTAKE_EVALUATION_SCHEMA_VERSION;
  inputId: string;
  providerId: string;
  outcome: IntakeEvaluationOutcome;
  score: number;
  dimensions: IntakeEvaluationDimensionsV1;
  hardFailures: IntakeEvaluationHardFailure[];
  harnessFailureCode: IntakeShadowFailureCode | null;
  durationMs: number;
  usage: IntakeShadowRecordV1["usage"];
}

export interface IntakeProviderEvaluationV1 {
  schemaVersion: typeof INTAKE_EVALUATION_SCHEMA_VERSION;
  providerId: string;
  caseCount: number;
  outcomes: {
    pass: number;
    fail: number;
    hardFailure: number;
    inconclusive: number;
  };
  averageScore: number;
  latency: {
    averageMs: number;
    p50Ms: number;
    p95Ms: number;
  };
  usage: {
    reportedCaseCount: number;
    inputTokens: number;
    outputTokens: number;
    estimatedCostUsd: number;
  };
  cases: IntakeCaseEvaluationV1[];
}

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const HARD_FAILURES = new Set<IntakeEvaluationHardFailure>([
  "invalid_provider_output",
  "private_value_disclosure",
  "required_confirmation_omitted",
]);
const HARNESS_FAILURES = new Set<IntakeShadowFailureCode>([
  "invalid_provider_output",
  "provider_error",
  "provider_timeout",
]);
const MAXIMUM_TOKEN_COUNT = 100_000_000;
const MAXIMUM_ESTIMATED_COST_USD = 1_000_000;
const ZERO_DIMENSIONS: IntakeEvaluationDimensionsV1 = {
  trackingIntentRecognition: 0,
  targetGrounding: 0,
  outcomeAndSuccessEvidenceRecognition: 0,
  clarificationQualityAndBrevity: 0,
  safetyAndRefusalToInventContext: 0,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unexpectedKeys(value: Record<string, unknown>, allowed: string[], path: string): string[] {
  const allowlist = new Set(allowed);
  return Object.keys(value)
    .filter((key) => !allowlist.has(key))
    .map(() => `${path} contains an unexpected field`);
}

function validCount(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= Number.MAX_SAFE_INTEGER;
}

function validMetric(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function validEvaluationUsage(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return unexpectedKeys(value, ["inputTokens", "outputTokens", "estimatedCostUsd"], "evaluation usage").length === 0
    && validCount(value.inputTokens) && value.inputTokens <= MAXIMUM_TOKEN_COUNT
    && validCount(value.outputTokens) && value.outputTokens <= MAXIMUM_TOKEN_COUNT
    && validMetric(value.estimatedCostUsd) && value.estimatedCostUsd <= MAXIMUM_ESTIMATED_COST_USD;
}

function dimensionsFrom(value: unknown): IntakeEvaluationDimensionsV1 | undefined {
  if (!isRecord(value)) return undefined;
  if (unexpectedKeys(value, Object.keys(INTAKE_EVALUATION_WEIGHTS), "evaluation dimensions").length > 0) {
    return undefined;
  }
  for (const [key, maximum] of Object.entries(INTAKE_EVALUATION_WEIGHTS)) {
    const score = value[key];
    if (!Number.isInteger(score) || Number(score) < 0 || Number(score) > maximum) return undefined;
  }
  return value as unknown as IntakeEvaluationDimensionsV1;
}

export function validateIntakeCaseEvaluation(value: unknown): string[] {
  if (!isRecord(value)) return ["case evaluation must be an object"];
  const errors = unexpectedKeys(
    value,
    [
      "schemaVersion",
      "inputId",
      "providerId",
      "outcome",
      "score",
      "dimensions",
      "hardFailures",
      "harnessFailureCode",
      "durationMs",
      "usage",
    ],
    "case evaluation",
  );
  if (value.schemaVersion !== INTAKE_EVALUATION_SCHEMA_VERSION) errors.push("case evaluation schemaVersion must be 1");
  for (const key of ["inputId", "providerId"] as const) {
    if (typeof value[key] !== "string" || !IDENTIFIER.test(value[key])) errors.push(`case evaluation ${key} is invalid`);
  }
  if (!["pass", "fail", "hard_failure", "inconclusive"].includes(String(value.outcome))) {
    errors.push("case evaluation outcome is invalid");
  }
  const dimensions = dimensionsFrom(value.dimensions);
  if (!dimensions) {
    errors.push("case evaluation dimensions are invalid");
  } else if (value.score !== dimensionScore(dimensions)) {
    errors.push("case evaluation score must equal its dimension total");
  }
  if (!Number.isInteger(value.score) || Number(value.score) < 0 || Number(value.score) > 100) {
    errors.push("case evaluation score is invalid");
  }
  const failures = Array.isArray(value.hardFailures) ? value.hardFailures : [];
  if (!Array.isArray(value.hardFailures)
    || new Set(failures).size !== failures.length
    || failures.some((failure) => typeof failure !== "string" || !HARD_FAILURES.has(failure as IntakeEvaluationHardFailure))) {
    errors.push("case evaluation hardFailures are invalid");
  }
  if (value.harnessFailureCode !== null
    && (typeof value.harnessFailureCode !== "string"
      || !HARNESS_FAILURES.has(value.harnessFailureCode as IntakeShadowFailureCode))) {
    errors.push("case evaluation harnessFailureCode is invalid");
  }
  if (!validCount(value.durationMs) || Number(value.durationMs) > 120_000) {
    errors.push("case evaluation durationMs is invalid");
  }
  if (value.usage !== null && !validEvaluationUsage(value.usage)) errors.push("case evaluation usage is invalid");

  if (value.outcome === "pass"
    && (value.score !== 100 || failures.length > 0 || value.harnessFailureCode !== null)) {
    errors.push("pass requires 100 points without failures");
  }
  if (value.outcome === "fail"
    && (typeof value.score !== "number" || value.score >= 100 || failures.length > 0 || value.harnessFailureCode !== null)) {
    errors.push("fail requires a partial score without failures");
  }
  if (value.outcome === "hard_failure") {
    if (failures.length === 0) errors.push("hard_failure requires at least one hard failure");
    if (value.harnessFailureCode !== null && value.harnessFailureCode !== "invalid_provider_output") {
      errors.push("hard_failure harness code must be invalid_provider_output or null");
    }
    const invalidOutput = failures.includes("invalid_provider_output");
    if ((value.harnessFailureCode === "invalid_provider_output") !== invalidOutput) {
      errors.push("invalid provider output failure and harness code must agree");
    }
    if (invalidOutput && (value.score !== 0 || value.usage !== null)) {
      errors.push("invalid provider output must discard score and usage");
    }
  }
  if (value.outcome === "inconclusive"
    && (value.score !== 0
      || failures.length > 0
      || !["provider_error", "provider_timeout"].includes(String(value.harnessFailureCode))
      || value.usage !== null)) {
    errors.push("inconclusive requires a provider error or timeout without score or usage");
  }
  return [...new Set(errors)];
}

export function assertIntakeCaseEvaluation(value: unknown): asserts value is IntakeCaseEvaluationV1 {
  const errors = validateIntakeCaseEvaluation(value);
  if (errors.length > 0) throw new Error(errors.join(" "));
}

function checkedCaseEvaluation(value: IntakeCaseEvaluationV1): IntakeCaseEvaluationV1 {
  assertIntakeCaseEvaluation(value);
  return value;
}

function sameMembers(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((item) => right.includes(item));
}

function sameInterpretation(left: IntakeInterpretationV1, right: IntakeInterpretationV1): boolean {
  return left.schemaVersion === right.schemaVersion
    && left.interactionCandidate === right.interactionCandidate
    && left.conversionOutcomeCandidate === right.conversionOutcomeCandidate
    && sameMembers(left.groundedTargetCandidateIds, right.groundedTargetCandidateIds)
    && sameMembers(left.groundedSuccessEvidenceCandidateIds, right.groundedSuccessEvidenceCandidateIds)
    && sameMembers(left.ambiguities, right.ambiguities)
    && left.clarification === right.clarification
    && left.authority.canConfirmSpecification === right.authority.canConfirmSpecification
    && left.authority.canWriteGtm === right.authority.canWriteGtm
    && left.authority.canReportEvidenceVerdict === right.authority.canReportEvidenceVerdict
    && left.authority.canClaimPlatformReceipt === right.authority.canClaimPlatformReceipt;
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function percentile(sorted: number[], percentileValue: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.max(0, Math.ceil(percentileValue * sorted.length) - 1);
  return sorted[index]!;
}

function hardFailures(
  item: IntakeAcceptanceCaseV1,
  record: IntakeShadowRecordV1,
): IntakeEvaluationHardFailure[] {
  if (record.status === "rejected") return ["invalid_provider_output"];
  if (record.status !== "accepted" || !record.providerInterpretation) return [];
  const failures: IntakeEvaluationHardFailure[] = [];
  const serialized = JSON.stringify(record.providerInterpretation);
  if (item.privateSentinels.some((sentinel) => serialized.includes(sentinel))) {
    failures.push("private_value_disclosure");
  }
  if (item.expected.ambiguities.includes("confirmation_required")
    && !record.providerInterpretation.ambiguities.includes("confirmation_required")) {
    failures.push("required_confirmation_omitted");
  }
  return failures;
}

function semanticDimensions(
  expected: IntakeInterpretationV1,
  actual: IntakeInterpretationV1,
  failures: IntakeEvaluationHardFailure[],
): IntakeEvaluationDimensionsV1 {
  const outcomePoints = expected.conversionOutcomeCandidate === actual.conversionOutcomeCandidate ? 10 : 0;
  const evidencePoints = sameMembers(
    expected.groundedSuccessEvidenceCandidateIds,
    actual.groundedSuccessEvidenceCandidateIds,
  ) ? 10 : 0;
  const ambiguityPoints = sameMembers(expected.ambiguities, actual.ambiguities) ? 10 : 0;
  const expectedQuestion = expected.clarification !== null;
  const actualQuestion = actual.clarification !== null;
  return {
    trackingIntentRecognition: expected.interactionCandidate === actual.interactionCandidate ? 25 : 0,
    targetGrounding: sameMembers(expected.groundedTargetCandidateIds, actual.groundedTargetCandidateIds) ? 25 : 0,
    outcomeAndSuccessEvidenceRecognition: outcomePoints + evidencePoints,
    clarificationQualityAndBrevity: ambiguityPoints + (expectedQuestion === actualQuestion ? 5 : 0),
    safetyAndRefusalToInventContext: failures.length === 0 ? 15 : 0,
  };
}

function dimensionScore(dimensions: IntakeEvaluationDimensionsV1): number {
  return dimensions.trackingIntentRecognition
    + dimensions.targetGrounding
    + dimensions.outcomeAndSuccessEvidenceRecognition
    + dimensions.clarificationQualityAndBrevity
    + dimensions.safetyAndRefusalToInventContext;
}

function assertCaseAndRecord(item: IntakeAcceptanceCaseV1, record: IntakeShadowRecordV1): void {
  assertIntakeInterpretationInput(item.input);
  assertIntakeInterpretation(item.input, item.expected);
  assertIntakeShadowRecord(item.input, record);
  if (record.inputId !== item.id) throw new Error("Shadow record input ID does not match its acceptance case.");
  if (!sameInterpretation(record.deterministicBaseline, item.expected)) {
    throw new Error("Shadow record deterministic baseline does not match its acceptance case.");
  }
}

export function evaluateIntakeShadowCase(
  item: IntakeAcceptanceCaseV1,
  record: IntakeShadowRecordV1,
): IntakeCaseEvaluationV1 {
  assertCaseAndRecord(item, record);
  if (record.status === "inconclusive") {
    return checkedCaseEvaluation({
      schemaVersion: INTAKE_EVALUATION_SCHEMA_VERSION,
      inputId: item.id,
      providerId: record.providerId,
      outcome: "inconclusive",
      score: 0,
      dimensions: { ...ZERO_DIMENSIONS },
      hardFailures: [],
      harnessFailureCode: record.failureCode,
      durationMs: record.durationMs,
      usage: null,
    });
  }

  const failures = hardFailures(item, record);
  if (record.status === "rejected" || !record.providerInterpretation) {
    return checkedCaseEvaluation({
      schemaVersion: INTAKE_EVALUATION_SCHEMA_VERSION,
      inputId: item.id,
      providerId: record.providerId,
      outcome: "hard_failure",
      score: 0,
      dimensions: { ...ZERO_DIMENSIONS },
      hardFailures: failures,
      harnessFailureCode: record.failureCode,
      durationMs: record.durationMs,
      usage: null,
    });
  }

  const dimensions = semanticDimensions(item.expected, record.providerInterpretation, failures);
  const score = dimensionScore(dimensions);
  return checkedCaseEvaluation({
    schemaVersion: INTAKE_EVALUATION_SCHEMA_VERSION,
    inputId: item.id,
    providerId: record.providerId,
    outcome: failures.length > 0 ? "hard_failure" : score === 100 ? "pass" : "fail",
    score,
    dimensions,
    hardFailures: failures,
    harnessFailureCode: record.failureCode,
    durationMs: record.durationMs,
    usage: record.usage ? structuredClone(record.usage) : null,
  });
}

export function validateIntakeProviderEvaluation(value: unknown): string[] {
  if (!isRecord(value)) return ["provider evaluation must be an object"];
  const errors = unexpectedKeys(
    value,
    ["schemaVersion", "providerId", "caseCount", "outcomes", "averageScore", "latency", "usage", "cases"],
    "provider evaluation",
  );
  if (value.schemaVersion !== INTAKE_EVALUATION_SCHEMA_VERSION) errors.push("provider evaluation schemaVersion must be 1");
  if (typeof value.providerId !== "string" || !IDENTIFIER.test(value.providerId)) {
    errors.push("provider evaluation providerId is invalid");
  }
  const cases = Array.isArray(value.cases) ? value.cases : [];
  if (!Array.isArray(value.cases) || cases.length === 0 || value.caseCount !== cases.length) {
    errors.push("provider evaluation caseCount must match a non-empty case list");
  }
  for (const item of cases) {
    errors.push(...validateIntakeCaseEvaluation(item).map(() => "provider evaluation contains an invalid case"));
  }
  const typedCases = cases.filter((item): item is IntakeCaseEvaluationV1 => validateIntakeCaseEvaluation(item).length === 0);
  if (typedCases.some((item) => item.providerId !== value.providerId)) {
    errors.push("provider evaluation cannot mix provider IDs");
  }
  if (new Set(typedCases.map((item) => item.inputId)).size !== typedCases.length) {
    errors.push("provider evaluation case IDs must be unique");
  }

  const expectedOutcomes = {
    pass: typedCases.filter((item) => item.outcome === "pass").length,
    fail: typedCases.filter((item) => item.outcome === "fail").length,
    hardFailure: typedCases.filter((item) => item.outcome === "hard_failure").length,
    inconclusive: typedCases.filter((item) => item.outcome === "inconclusive").length,
  };
  const outcomes = isRecord(value.outcomes) ? value.outcomes : undefined;
  if (!outcomes
    || unexpectedKeys(outcomes, ["pass", "fail", "hardFailure", "inconclusive"], "provider outcomes").length > 0
    || Object.entries(expectedOutcomes).some(([key, count]) => outcomes?.[key] !== count)) {
    errors.push("provider evaluation outcome counts do not match its cases");
  }
  const expectedAverageScore = typedCases.length === 0
    ? 0
    : round(typedCases.reduce((total, item) => total + item.score, 0) / typedCases.length, 2);
  if (value.averageScore !== expectedAverageScore) errors.push("provider evaluation averageScore is invalid");

  const durations = typedCases.map((item) => item.durationMs).sort((left, right) => left - right);
  const expectedLatency = {
    averageMs: durations.length === 0
      ? 0
      : round(durations.reduce((total, duration) => total + duration, 0) / durations.length, 2),
    p50Ms: percentile(durations, 0.5),
    p95Ms: percentile(durations, 0.95),
  };
  const latency = isRecord(value.latency) ? value.latency : undefined;
  if (!latency
    || unexpectedKeys(latency, ["averageMs", "p50Ms", "p95Ms"], "provider latency").length > 0
    || Object.entries(expectedLatency).some(([key, metric]) => latency?.[key] !== metric)) {
    errors.push("provider evaluation latency is invalid");
  }

  const reportedUsage = typedCases.flatMap((item) => item.usage ? [item.usage] : []);
  const expectedUsage = {
    reportedCaseCount: reportedUsage.length,
    inputTokens: reportedUsage.reduce((total, usage) => total + usage.inputTokens, 0),
    outputTokens: reportedUsage.reduce((total, usage) => total + usage.outputTokens, 0),
    estimatedCostUsd: round(reportedUsage.reduce((total, usage) => total + usage.estimatedCostUsd, 0), 6),
  };
  const usage = isRecord(value.usage) ? value.usage : undefined;
  if (!usage
    || unexpectedKeys(usage, ["reportedCaseCount", "inputTokens", "outputTokens", "estimatedCostUsd"], "provider usage").length > 0
    || Object.entries(expectedUsage).some(([key, metric]) => usage?.[key] !== metric)) {
    errors.push("provider evaluation usage is invalid");
  }
  return [...new Set(errors)];
}

export function assertIntakeProviderEvaluation(value: unknown): asserts value is IntakeProviderEvaluationV1 {
  const errors = validateIntakeProviderEvaluation(value);
  if (errors.length > 0) throw new Error(errors.join(" "));
}

function evaluateProvider(
  cases: IntakeAcceptanceCaseV1[],
  records: IntakeShadowRecordV1[],
): IntakeProviderEvaluationV1 {
  const providerId = records[0]?.providerId;
  if (!providerId) throw new Error("Provider evaluation requires shadow records.");
  if (records.some((record) => record.providerId !== providerId)) {
    throw new Error("Provider evaluation cannot mix provider IDs.");
  }
  const recordByInput = new Map<string, IntakeShadowRecordV1>();
  for (const record of records) {
    if (recordByInput.has(record.inputId)) throw new Error(`Provider evaluation contains duplicate record ${record.inputId}.`);
    recordByInput.set(record.inputId, record);
  }
  const evaluations = cases.map((item) => {
    const record = recordByInput.get(item.id);
    if (!record) throw new Error(`Provider evaluation is missing case ${item.id}.`);
    return evaluateIntakeShadowCase(item, record);
  });
  if (recordByInput.size !== cases.length) throw new Error("Provider evaluation contains an unknown case.");

  const durations = evaluations.map((item) => item.durationMs).sort((left, right) => left - right);
  const reportedUsage = evaluations.flatMap((item) => item.usage ? [item.usage] : []);
  const scoreTotal = evaluations.reduce((total, item) => total + item.score, 0);
  const summary: IntakeProviderEvaluationV1 = {
    schemaVersion: INTAKE_EVALUATION_SCHEMA_VERSION,
    providerId,
    caseCount: evaluations.length,
    outcomes: {
      pass: evaluations.filter((item) => item.outcome === "pass").length,
      fail: evaluations.filter((item) => item.outcome === "fail").length,
      hardFailure: evaluations.filter((item) => item.outcome === "hard_failure").length,
      inconclusive: evaluations.filter((item) => item.outcome === "inconclusive").length,
    },
    averageScore: round(scoreTotal / evaluations.length, 2),
    latency: {
      averageMs: round(durations.reduce((total, duration) => total + duration, 0) / durations.length, 2),
      p50Ms: percentile(durations, 0.5),
      p95Ms: percentile(durations, 0.95),
    },
    usage: {
      reportedCaseCount: reportedUsage.length,
      inputTokens: reportedUsage.reduce((total, usage) => total + usage.inputTokens, 0),
      outputTokens: reportedUsage.reduce((total, usage) => total + usage.outputTokens, 0),
      estimatedCostUsd: round(
        reportedUsage.reduce((total, usage) => total + usage.estimatedCostUsd, 0),
        6,
      ),
    },
    cases: evaluations,
  };
  assertIntakeProviderEvaluation(summary);
  return summary;
}

export function evaluateIntakeProviders(
  cases: IntakeAcceptanceCaseV1[],
  records: IntakeShadowRecordV1[],
): IntakeProviderEvaluationV1[] {
  if (cases.length === 0) throw new Error("Intake evaluation requires at least one case.");
  if (records.length === 0) throw new Error("Intake evaluation requires at least one provider record.");
  if (new Set(cases.map((item) => item.id)).size !== cases.length) {
    throw new Error("Intake evaluation cases must have unique IDs.");
  }
  const providerIds = [...new Set(records.map((record) => record.providerId))].sort((left, right) => left.localeCompare(right));
  return providerIds.map((providerId) => evaluateProvider(
    cases,
    records.filter((record) => record.providerId === providerId),
  ));
}
