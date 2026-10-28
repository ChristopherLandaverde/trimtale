import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  evaluateBrowserEvidence,
  type BrowserEvidenceContractV1,
  type BrowserEvidenceObservationsV1,
} from "./browser-evidence.js";

interface AcceptanceFixture {
  contracts: BrowserEvidenceContractV1[];
  cases: Array<{
    id: string;
    contractId: string;
    observations: BrowserEvidenceObservationsV1;
    expected: {
      verdict: string;
      browserVerification: string;
    };
  }>;
}

function fixture(): AcceptanceFixture {
  return JSON.parse(readFileSync(
    resolve(process.cwd(), "tests/acceptance/generic-browser-evidence-contract.json"),
    "utf8",
  )) as AcceptanceFixture;
}

describe("generic browser evidence", () => {
  it("evaluates every accepted interaction through one deterministic contract", () => {
    const acceptance = fixture();
    const contracts = new Map(acceptance.contracts.map((contract) => [contract.id, contract]));

    for (const scenario of acceptance.cases) {
      const contract = contracts.get(scenario.contractId);
      expect(contract, scenario.id).toBeDefined();
      expect(evaluateBrowserEvidence(contract!, scenario.observations), scenario.id).toMatchObject({
        code: scenario.expected.verdict,
        browserVerification: scenario.expected.browserVerification,
        platformConfirmation: "unverified",
      });
    }
  });
});
