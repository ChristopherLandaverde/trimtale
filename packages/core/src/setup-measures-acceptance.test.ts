import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

interface MeasuresAcceptance {
  schemaVersion: number;
  issue: string;
  measures: Array<{
    id: string;
    start: string;
    terminal: string;
    unit: string;
    aggregation: string[];
  }>;
  sampleStrata: string[];
  allowedFields: string[];
  forbiddenFields: string[];
  localBaseline: {
    durationKind: string;
    samples: Array<{
      runs: number;
      passed: number;
      minimumMs: number;
      p50Ms: number;
      p90Ms: number;
      maximumMs: number;
    }>;
    firstPassVerification: { numerator: number; denominator: number };
    restartRecovery: { numerator: number; denominator: number; duplicateMutations: number };
    providerActivity: { status: string };
    credentialedGoogle: { status: string };
  };
  performanceGate: boolean;
  productionTelemetry: boolean;
}

function loadAcceptance(): MeasuresAcceptance {
  return JSON.parse(readFileSync(
    resolve(process.cwd(), "tests/acceptance/setup-optimization-measures.json"),
    "utf8",
  )) as MeasuresAcceptance;
}

describe("issue 28 setup-measures acceptance", () => {
  it("defines every measure with exact boundaries and units", () => {
    const acceptance = loadAcceptance();

    expect(acceptance).toMatchObject({
      schemaVersion: 1,
      issue: ".scratch/gtm-setup-engine/issues/28-setup-optimization-measures.md",
      performanceGate: false,
      productionTelemetry: false,
    });
    expect(acceptance.measures.map(({ id }) => id)).toEqual([
      "time_to_verified_setup",
      "first_pass_verification_rate",
      "false_positive_rate",
      "false_negative_rate",
      "provider_activity_counts",
      "restart_recovery_rate",
      "clarification_count",
      "required_human_action_count",
    ]);
    expect(acceptance.measures.every((measure) =>
      measure.start.length > 0
      && measure.terminal.length > 0
      && measure.unit.length > 0
      && measure.aggregation.length > 0
    )).toBe(true);
  });

  it("separates sample strata and excludes private inputs", () => {
    const acceptance = loadAcceptance();

    expect(acceptance.sampleStrata).toEqual(["local_deterministic", "credentialed_google"]);
    expect(acceptance.allowedFields).not.toEqual(expect.arrayContaining([
      "intent_text",
      "urls",
      "form_values",
      "request_payloads",
    ]));
    expect(acceptance.forbiddenFields).toEqual(expect.arrayContaining([
      "intent_text",
      "urls",
      "form_values",
      "request_payloads",
      "cookies",
      "credentials",
      "raw_provider_errors",
    ]));
  });

  it("reports five-run distributions instead of one best case", () => {
    const baseline = loadAcceptance().localBaseline;

    expect(baseline.durationKind).toBe("playwright_test_body_upper_bound_proxy");
    expect(baseline.samples).toHaveLength(4);
    expect(baseline.samples.every((sample) =>
      sample.runs === 5
      && sample.passed === 5
      && sample.minimumMs <= sample.p50Ms
      && sample.p50Ms <= sample.p90Ms
      && sample.p90Ms <= sample.maximumMs
    )).toBe(true);
    expect(baseline.firstPassVerification).toEqual({ numerator: 10, denominator: 10 });
    expect(baseline.restartRecovery).toEqual({
      numerator: 5,
      denominator: 5,
      duplicateMutations: 0,
    });
  });

  it("marks unavailable provider and credentialed measures honestly", () => {
    const baseline = loadAcceptance().localBaseline;

    expect(baseline.providerActivity.status).toBe("not_observable_in_mocked_browser_routes");
    expect(baseline.credentialedGoogle.status).toBe("not_measured_with_shared_boundaries");
  });
});
