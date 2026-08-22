import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

interface VerifiedResolutionAcceptanceContract {
  schemaVersion: number;
  issue: string;
  feature: string;
  behavioralTest: string;
  cases: Array<{
    id: string;
    input: Record<string, unknown>;
    expected: {
      accepted: boolean;
      error?: string;
      persistedForbiddenSentinels?: string[];
      deterministicRulesChanged: boolean;
    };
  }>;
}

function loadContract(): VerifiedResolutionAcceptanceContract {
  return JSON.parse(readFileSync(
    resolve(process.cwd(), "tests/acceptance/verified-resolution-foundation.json"),
    "utf8",
  )) as VerifiedResolutionAcceptanceContract;
}

describe("issue 09 verified-resolution acceptance contract", () => {
  it("binds the acceptance cases to the future persistence test", () => {
    const contract = loadContract();
    expect(contract.schemaVersion).toBe(1);
    expect(contract.issue).toBe(".scratch/conversational-tracking-specs/issues/09-verified-resolution-foundation.md");
    expect(contract.behavioralTest).toBe("apps/api/src/verified-resolutions.test.ts");
    expect(contract.cases.map((item) => item.id)).toEqual([
      "stores-human-confirmed-before-and-after-resolution",
      "rejects-unconfirmed-diagnosis",
      "rejects-missing-evidence-link",
      "rejects-non-passing-after-evidence",
      "rejects-evidence-verdict-mismatch",
      "rejects-passing-before-evidence",
      "rejects-missing-confirmed-cause",
      "rejects-missing-corrective-action",
      "rejects-unknown-schema-version",
      "redacts-forbidden-customer-data",
    ]);
  });

  it("never permits acceptance cases to change deterministic rules", () => {
    const contract = loadContract();
    expect(contract.cases.every((item) => item.expected.deterministicRulesChanged === false)).toBe(true);
    expect(contract.cases.filter((item) => item.expected.accepted)).toHaveLength(2);
    expect(contract.cases.filter((item) => !item.expected.accepted).every((item) => item.expected.error)).toBe(true);
  });

  it("requires explicit privacy sentinels and an empty persisted result", () => {
    const privacyCase = loadContract().cases.find((item) => item.id === "redacts-forbidden-customer-data");
    expect(privacyCase?.input.forbiddenSentinels).toEqual([
      "privacy-sentinel@example.invalid",
      "PRIVATE_COOKIE_SENTINEL",
      "DO_NOT_PERSIST_7F31",
    ]);
    expect(privacyCase?.expected.persistedForbiddenSentinels).toEqual([]);
  });
});
