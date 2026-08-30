import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

interface AcceptanceContract {
  schemaVersion: number;
  issue: string;
  feature: string;
  behavioralTest: string;
  journeys: Array<{
    id: string;
    intent: string;
    clarifications: Array<{ field: string; answer: string }>;
    practitionerConfirmsSpecification: boolean;
    fixtureState: string;
    expected: {
      eventName: string;
      artifact: string;
      verdict: string;
      browserVerification: string;
      platformConfirmation: string;
      explanationMustInclude: string[];
      explanationMustNotClaim: string[];
    };
  }>;
}

function loadContract(): AcceptanceContract {
  return JSON.parse(readFileSync(
    resolve(process.cwd(), "tests/acceptance/conversational-form-e2e.json"),
    "utf8",
  )) as AcceptanceContract;
}

describe("issue 08 conversational form acceptance contract", () => {
  it("defines executable positive and negative journeys before implementation", () => {
    const contract = loadContract();
    expect(contract.schemaVersion).toBe(1);
    expect(contract.issue).toBe(".scratch/conversational-tracking-specs/issues/08-form-e2e.md");
    expect(contract.behavioralTest).toBe("tests/e2e/conversational-form.spec.ts");
    expect(contract.journeys.map((journey) => journey.id)).toEqual([
      "confirmed-form-success",
      "validation-error-is-not-a-conversion",
    ]);
    expect(contract.journeys.every((journey) =>
      journey.intent.length > 0 &&
      journey.clarifications.length > 0 &&
      journey.practitionerConfirmsSpecification
    )).toBe(true);
  });

  it("requires a successful outcome and a false-positive guard", () => {
    const journeys = loadContract().journeys;
    const passing = journeys.find((journey) => journey.fixtureState === "ajax_success");
    const validationError = journeys.find((journey) => journey.fixtureState === "validation_failure");
    expect(passing?.expected).toMatchObject({
      eventName: "generate_lead",
      artifact: "gtm_container_import",
      verdict: "browser_verified",
      browserVerification: "passed",
      platformConfirmation: "unverified",
      explanationMustInclude: ["browser", "request", "platform confirmation"],
    });
    expect(validationError?.expected).toMatchObject({
      eventName: "generate_lead",
      artifact: "gtm_container_import",
      verdict: "expected_non_conversion",
      browserVerification: "failed",
      platformConfirmation: "unverified",
      explanationMustInclude: ["validation", "not counted", "submit again"],
    });
    expect(journeys.every((journey) => journey.expected.explanationMustNotClaim.length > 0)).toBe(true);
  });
});
