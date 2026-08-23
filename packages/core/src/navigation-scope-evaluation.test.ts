import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertNavigationScopeAcceptanceCorpus,
  canonicalPassingNavigationScopeInterpretation,
  evaluateNavigationScopeAcceptanceCase,
  validateNavigationScopeAcceptanceCorpus,
  type NavigationScopeAcceptanceCorpusV1,
} from "./navigation-scope-evaluation.js";

function loadCorpus(): NavigationScopeAcceptanceCorpusV1 {
  const value: unknown = JSON.parse(readFileSync(
    resolve(process.cwd(), "tests/acceptance/navigation-scope-interpretation.json"),
    "utf8",
  ));
  assertNavigationScopeAcceptanceCorpus(value);
  return value;
}

describe("navigation scope canonical evaluation corpus", () => {
  it("validates one complete provider-neutral corpus with bounded smoke and full lanes", () => {
    const corpus = loadCorpus();
    expect(corpus.cases).toHaveLength(32);
    expect(corpus.cases.filter(({ tier }) => tier === "smoke")).toHaveLength(15);
    expect(validateNavigationScopeAcceptanceCorpus(corpus)).toEqual([]);
  });

  it("automates every canonical case without comparing exact clarification prose", () => {
    const corpus = loadCorpus();
    for (const item of corpus.cases) {
      const interpretation = canonicalPassingNavigationScopeInterpretation(item);
      interpretation.clarification = item.expected.clarification === "required"
        ? `A provider-specific question for ${item.id}?`
        : null;
      expect(evaluateNavigationScopeAcceptanceCase(item, {
        status: "accepted",
        interpretation,
      }), item.id).toMatchObject({ outcome: "pass", failures: [], harnessFailure: null });
    }
  });

  it("fails wrong groups, ambiguity, authority escalation, malformed output, and private disclosure", () => {
    const corpus = loadCorpus();
    const item = corpus.cases.find(({ id }) => id === "private-values-redacted")!;
    const passing = canonicalPassingNavigationScopeInterpretation(item);
    const observations = [
      { ...passing, candidateGroupIds: ["footer_nav"] },
      { ...passing, ambiguities: ["scope"] },
      { ...passing, authority: { ...passing.authority, canWriteGtm: true } },
      { ...passing, selector: "header nav a" },
      { ...passing, clarification: "person@example.test" },
    ];
    const results = observations.map((interpretation) => evaluateNavigationScopeAcceptanceCase(
      item,
      { status: "accepted", interpretation },
    ));
    expect(results.map(({ outcome }) => outcome)).toEqual(["fail", "fail", "fail", "fail", "fail"]);
    expect(results.flatMap(({ failures }) => failures)).toEqual(expect.arrayContaining([
      "unexpected_candidates",
      "unexpected_ambiguities",
      "invalid_provider_output",
      "private_value_disclosure",
    ]));
  });

  it("records provider errors and timeouts as inconclusive without provider prose", () => {
    const item = loadCorpus().cases[0]!;
    expect(evaluateNavigationScopeAcceptanceCase(item, {
      status: "unavailable",
      failure: "provider_error",
    })).toEqual({
      schemaVersion: 1,
      caseId: item.id,
      outcome: "inconclusive",
      failures: [],
      harnessFailure: "provider_error",
      observed: null,
    });
    expect(evaluateNavigationScopeAcceptanceCase(item, {
      status: "unavailable",
      failure: "provider_timeout",
    })).toMatchObject({ outcome: "inconclusive", harnessFailure: "provider_timeout" });
  });

  it("rejects incomplete coverage and source messages that bypass redaction", () => {
    const corpus = loadCorpus();
    expect(validateNavigationScopeAcceptanceCorpus({
      ...corpus,
      requiredCoverage: corpus.requiredCoverage.slice(1),
    })).toContain("corpus.requiredCoverage must contain the complete coverage contract");
    const privateIndex = corpus.cases.findIndex(({ id }) => id === "private-values-redacted");
    const cases = structuredClone(corpus.cases);
    cases[privateIndex]!.input.messages = [...cases[privateIndex]!.sourceMessages];
    expect(validateNavigationScopeAcceptanceCorpus({ ...corpus, cases }))
      .toEqual(expect.arrayContaining([
        expect.stringContaining("messages contain unredacted private values"),
        expect.stringContaining("input.messages must be the sanitized source messages"),
        expect.stringContaining("discloses a private sentinel"),
      ]));
  });
});
