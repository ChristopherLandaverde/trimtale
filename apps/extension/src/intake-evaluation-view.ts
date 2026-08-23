import {
  validateIntakeProviderEvaluation,
  type IntakeProviderEvaluationV1,
} from "@gtm-observability/core";

export interface IntakeProviderEvaluationSummaryV1 {
  schemaVersion: 1;
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
}

export interface IntakeEvaluationReportSummaryV1 {
  schemaVersion: 1;
  id: string;
  createdAt: string;
  corpusSchemaVersion: 1;
  corpusCaseCount: number;
  providers: IntakeProviderEvaluationSummaryV1[];
}

export interface IntakeEvaluationReportV1 {
  schemaVersion: 1;
  id: string;
  createdAt: string;
  corpusSchemaVersion: 1;
  corpusCaseCount: number;
  providers: IntakeProviderEvaluationV1[];
}

export type IntakeProviderDisplayState = "passing" | "degraded" | "hard_failure" | "inconclusive";

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const MAXIMUM_REPORT_COUNT = 100;
const MAXIMUM_CASE_COUNT = 100;
const MAXIMUM_TOKEN_COUNT = 100_000_000;
const MAXIMUM_ESTIMATED_COST_USD = 1_000_000;
const MAXIMUM_DURATION_MS = 120_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).length === keys.length
    && Object.keys(value).every((key) => keys.includes(key));
}

function nonNegativeInteger(value: unknown, maximum: number): value is number {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= maximum;
}

function boundedMetric(value: unknown, maximum: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= maximum;
}

function validOutcomes(value: unknown, caseCount: number): value is IntakeProviderEvaluationSummaryV1["outcomes"] {
  if (!isRecord(value) || !hasOnlyKeys(value, ["pass", "fail", "hardFailure", "inconclusive"])) return false;
  const counts = [value.pass, value.fail, value.hardFailure, value.inconclusive];
  return counts.every((count) => nonNegativeInteger(count, caseCount))
    && counts.reduce((total, count) => total + Number(count), 0) === caseCount;
}

function validLatency(value: unknown): value is IntakeProviderEvaluationSummaryV1["latency"] {
  if (!isRecord(value) || !hasOnlyKeys(value, ["averageMs", "p50Ms", "p95Ms"])) return false;
  return boundedMetric(value.averageMs, MAXIMUM_DURATION_MS)
    && boundedMetric(value.p50Ms, MAXIMUM_DURATION_MS)
    && boundedMetric(value.p95Ms, MAXIMUM_DURATION_MS)
    && value.p50Ms <= value.p95Ms;
}

function validUsage(value: unknown, caseCount: number): value is IntakeProviderEvaluationSummaryV1["usage"] {
  if (!isRecord(value)
    || !hasOnlyKeys(value, ["reportedCaseCount", "inputTokens", "outputTokens", "estimatedCostUsd"])) {
    return false;
  }
  return nonNegativeInteger(value.reportedCaseCount, caseCount)
    && nonNegativeInteger(value.inputTokens, MAXIMUM_TOKEN_COUNT)
    && nonNegativeInteger(value.outputTokens, MAXIMUM_TOKEN_COUNT)
    && boundedMetric(value.estimatedCostUsd, MAXIMUM_ESTIMATED_COST_USD);
}

function providerSummary(value: unknown): IntakeProviderEvaluationSummaryV1 | undefined {
  if (!isRecord(value)
    || !hasOnlyKeys(value, [
      "schemaVersion",
      "providerId",
      "caseCount",
      "outcomes",
      "averageScore",
      "latency",
      "usage",
    ])
    || value.schemaVersion !== 1
    || typeof value.providerId !== "string"
    || !IDENTIFIER.test(value.providerId)
    || !nonNegativeInteger(value.caseCount, MAXIMUM_CASE_COUNT)
    || value.caseCount < 1
    || !validOutcomes(value.outcomes, value.caseCount)
    || !boundedMetric(value.averageScore, 100)
    || !validLatency(value.latency)
    || !validUsage(value.usage, value.caseCount)) {
    return undefined;
  }
  return structuredClone(value) as unknown as IntakeProviderEvaluationSummaryV1;
}

function reportIdentity(value: Record<string, unknown>): boolean {
  return value.schemaVersion === 1
    && typeof value.id === "string"
    && IDENTIFIER.test(value.id)
    && typeof value.createdAt === "string"
    && !Number.isNaN(Date.parse(value.createdAt))
    && value.corpusSchemaVersion === 1
    && nonNegativeInteger(value.corpusCaseCount, MAXIMUM_CASE_COUNT)
    && value.corpusCaseCount > 0;
}

function reportSummary(value: unknown): IntakeEvaluationReportSummaryV1 | undefined {
  if (!isRecord(value)
    || !hasOnlyKeys(value, [
      "schemaVersion",
      "id",
      "createdAt",
      "corpusSchemaVersion",
      "corpusCaseCount",
      "providers",
    ])
    || !reportIdentity(value)
    || !Array.isArray(value.providers)
    || value.providers.length < 2
    || value.providers.length > 3) {
    return undefined;
  }
  const providers = value.providers.map(providerSummary);
  if (providers.some((provider) => provider === undefined)) return undefined;
  const typedProviders = providers as IntakeProviderEvaluationSummaryV1[];
  if (new Set(typedProviders.map((provider) => provider.providerId)).size !== typedProviders.length
    || typedProviders.some((provider) => provider.caseCount !== value.corpusCaseCount)) {
    return undefined;
  }
  return {
    schemaVersion: 1,
    id: value.id as string,
    createdAt: value.createdAt as string,
    corpusSchemaVersion: 1,
    corpusCaseCount: value.corpusCaseCount as number,
    providers: structuredClone(typedProviders),
  };
}

export function decodeIntakeEvaluationListResponse(
  value: unknown,
): IntakeEvaluationReportSummaryV1[] | undefined {
  if (!isRecord(value)
    || !hasOnlyKeys(value, ["schemaVersion", "reports"])
    || value.schemaVersion !== 1
    || !Array.isArray(value.reports)
    || value.reports.length > MAXIMUM_REPORT_COUNT) {
    return undefined;
  }
  const reports = value.reports.map(reportSummary);
  if (reports.some((report) => report === undefined)) return undefined;
  const typedReports = reports as IntakeEvaluationReportSummaryV1[];
  if (new Set(typedReports.map((report) => report.id)).size !== typedReports.length) return undefined;
  return structuredClone(typedReports);
}

export function decodeIntakeEvaluationDetailResponse(value: unknown): IntakeEvaluationReportV1 | undefined {
  if (!isRecord(value)
    || !hasOnlyKeys(value, ["schemaVersion", "report"])
    || value.schemaVersion !== 1
    || !isRecord(value.report)
    || !hasOnlyKeys(value.report, [
      "schemaVersion",
      "id",
      "createdAt",
      "corpusSchemaVersion",
      "corpusCaseCount",
      "providers",
    ])
    || !reportIdentity(value.report)
    || !Array.isArray(value.report.providers)
    || value.report.providers.length < 2
    || value.report.providers.length > 3) {
    return undefined;
  }
  const providers = value.report.providers;
  const corpusCaseCount = value.report.corpusCaseCount as number;
  if (providers.some((provider) => validateIntakeProviderEvaluation(provider).length > 0)) return undefined;
  const typedProviders = providers as IntakeProviderEvaluationV1[];
  if (new Set(typedProviders.map((provider) => provider.providerId)).size !== typedProviders.length
    || typedProviders.some((provider) => provider.caseCount !== corpusCaseCount)) {
    return undefined;
  }
  const expectedCaseIds = typedProviders[0]?.cases.map((item) => item.inputId) ?? [];
  if (typedProviders.some((provider) => (
    provider.cases.length !== expectedCaseIds.length
    || provider.cases.some((item) => !expectedCaseIds.includes(item.inputId))
  ))) {
    return undefined;
  }
  return structuredClone(value.report) as unknown as IntakeEvaluationReportV1;
}

export function intakeProviderDisplayState(
  provider: Pick<IntakeProviderEvaluationSummaryV1, "outcomes" | "averageScore" | "caseCount">,
): IntakeProviderDisplayState {
  if (provider.outcomes.hardFailure > 0) return "hard_failure";
  if (provider.outcomes.inconclusive > 0) return "inconclusive";
  if (provider.outcomes.fail > 0 || provider.averageScore < 100 || provider.outcomes.pass !== provider.caseCount) {
    return "degraded";
  }
  return "passing";
}
