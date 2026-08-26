import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  authorTrackingSetup,
  validateAuthoringProposal,
  type SetupAuthoringGroundingV1,
  type SetupAuthoringInputV1,
  type SetupAuthoringProposalV1,
  type SetupAuthoringProvider,
} from "./setup-authoring.js";
import { validateTrackingSetup } from "./setup-contract.js";

interface AuthoringCase {
  id: string;
  input: SetupAuthoringInputV1;
  grounding: SetupAuthoringGroundingV1;
  proposal: SetupAuthoringProposalV1;
  expected: {
    status: SetupAuthoringProposalV1["status"];
    setupCreated: boolean;
    suggestionClasses: string[];
  };
}

function cases(): AuthoringCase[] {
  return JSON.parse(readFileSync(
    resolve(process.cwd(), "tests/fixtures/setup-authoring-corpus-v1.json"),
    "utf8",
  )) as AuthoringCase[];
}

function fakeProvider(proposal: unknown): SetupAuthoringProvider & { propose: ReturnType<typeof vi.fn> } {
  return {
    id: "fake-author",
    propose: vi.fn(async () => ({
      proposal,
      usage: { inputTokens: 300, outputTokens: 120, estimatedCostUsd: 0.001 },
    })),
  };
}

describe("model-backed setup authoring", () => {
  it.each(cases())("assembles $id through one bounded provider call", async (item) => {
    const provider = fakeProvider(item.proposal);
    const result = await authorTrackingSetup(
      provider,
      item.input,
      item.grounding,
      { signal: new AbortController().signal },
    );

    expect(provider.propose).toHaveBeenCalledTimes(1);
    expect(result.proposal.status).toBe(item.expected.status);
    expect(result.suggestions.map(({ classification }) => classification))
      .toEqual(item.expected.suggestionClasses);
    expect(result.setup !== null).toBe(item.expected.setupCreated);
    if (result.setup) {
      expect(validateTrackingSetup(result.setup)).toEqual([]);
      expect(result.setup.tagActions[0]?.destination).toEqual({
        type: "ga4",
        measurementId: item.grounding.measurementId,
      });
    }
  });

  it("rejects invented grounding, authority, selectors, and private disclosure", async () => {
    const item = cases()[0]!;
    const base = item.proposal;
    const failures: Array<[string, unknown]> = [
      ["invented firing policy", { ...base, firingPolicyCandidateIds: ["invented-policy"] }],
      ["invented value", {
        ...base,
        parameters: [{ ...base.parameters[0]!, valueCandidateId: "invented-value" }],
      }],
      ["mutation authority", { ...base, authority: { ...base.authority, canWriteGtm: true } }],
      ["selector output", { ...base, selector: "form#private" }],
      ["private disclosure", { ...base, rationale: "Use private-person@example.test" }],
    ];

    for (const [name, proposal] of failures) {
      const provider = fakeProvider(proposal);
      await expect(authorTrackingSetup(
        provider,
        item.input,
        item.grounding,
        { signal: new AbortController().signal },
      ), name).rejects.toThrow("Setup authoring provider output is invalid.");
    }
  });

  it("requires useful clarification for ambiguity and no setup for unsupported intent", () => {
    const ambiguous = cases().find(({ id }) => id === "ambiguous-business-outcome")!;
    const unsupported = cases().find(({ id }) => id === "unsupported-ad-platform")!;

    expect(validateAuthoringProposal(ambiguous.input, ambiguous.grounding, ambiguous.proposal)).toEqual([]);
    expect(ambiguous.proposal.clarification).toMatch(/\?$/);
    expect(validateAuthoringProposal(unsupported.input, unsupported.grounding, unsupported.proposal)).toEqual([]);
    expect(unsupported.proposal.eventName).toBeNull();
  });
});
