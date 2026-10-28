import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

interface EvidenceAcceptance {
  schemaVersion: number;
  issue: string;
  behavioralTest: string;
  contracts: Array<{
    id: string;
    outcome: { required: boolean };
    request: { destination: string };
    permittedAutomaticEvents: string[];
    duplicatePolicy: { minimum: number; maximum: number };
    tagActionId: string;
    negativeExpectations: string[];
  }>;
  cases: Array<{
    id: string;
    observations: {
      requests: Array<{ eventName: string }>;
    };
    expected: { verdict: string; browserVerification: string };
  }>;
}

function loadAcceptance(): EvidenceAcceptance {
  return JSON.parse(readFileSync(
    resolve(process.cwd(), "tests/acceptance/generic-browser-evidence-contract.json"),
    "utf8",
  )) as EvidenceAcceptance;
}

describe("issue 25 generic browser-evidence acceptance", () => {
  it("defines four event-independent contracts for one future evaluator", () => {
    const acceptance = loadAcceptance();

    expect(acceptance).toMatchObject({
      schemaVersion: 1,
      issue: ".scratch/gtm-setup-engine/issues/25-generic-browser-evidence-contract.md",
      behavioralTest: "packages/core/src/browser-evidence.test.ts",
    });
    expect(acceptance.contracts.map(({ id }) => id)).toEqual([
      "lead-form",
      "navigation",
      "download",
      "phone-click",
    ]);
    expect(acceptance.contracts.every((contract) =>
      contract.outcome.required
      && contract.request.destination === "ga4"
      && contract.duplicatePolicy.minimum === 1
      && contract.duplicatePolicy.maximum === 1
      && contract.tagActionId.length > 0
      && contract.negativeExpectations.includes("matching_page_error")
    )).toBe(true);
  });

  it("keeps automatic requests separate from matches and duplicates", () => {
    const acceptance = loadAcceptance();
    const lead = acceptance.contracts.find(({ id }) => id === "lead-form");
    const passing = acceptance.cases.find(({ id }) => id === "lead-form-passes-with-permitted-form-start");
    const automaticOnly = acceptance.cases.find(({ id }) => id === "automatic-event-alone-cannot-pass");
    const duplicate = acceptance.cases.find(({ id }) => id === "matching-event-duplicate-fails");

    expect(lead?.permittedAutomaticEvents).toContain("form_start");
    expect(passing?.observations.requests.map(({ eventName }) => eventName)).toEqual([
      "form_start",
      "generate_lead",
    ]);
    expect(passing?.expected.verdict).toBe("browser_verified");
    expect(automaticOnly?.expected.verdict).toBe("tag_fired_request_missing");
    expect(duplicate?.expected.verdict).toBe("duplicate_fire");
  });

  it("preserves distinct negative and inconclusive verdicts", () => {
    const acceptance = loadAcceptance();
    const verdicts = new Map(acceptance.cases.map(({ id, expected }) => [id, expected]));

    expect(verdicts.get("required-parameter-missing")).toEqual({
      verdict: "missing_parameter",
      browserVerification: "failed",
    });
    expect(verdicts.get("consent-denied-remains-inconclusive")).toEqual({
      verdict: "consent_limited",
      browserVerification: "inconclusive",
    });
    expect(verdicts.get("absent-unobservable-outcome-remains-inconclusive")).toEqual({
      verdict: "insufficient_observable_evidence",
      browserVerification: "inconclusive",
    });
    expect(verdicts.get("matching-negative-expectation-fails")?.browserVerification)
      .toBe("failed");
  });
});
