import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  REQUIRED_INTAKE_COVERAGE,
  REQUIRED_INTAKE_HARD_FAILURE_RULES,
  assertIntakeAcceptanceCorpus,
  assertIntakeInterpretation,
  assertIntakeInterpretationInput,
  validateIntakeAcceptanceCorpus,
  validateIntakeInterpretation,
  validateIntakeInterpretationInput,
  type IntakeAcceptanceCorpusV1,
} from "./intake-interpretation.js";

function loadCorpus(): IntakeAcceptanceCorpusV1 {
  const value: unknown = JSON.parse(readFileSync(
    resolve(process.cwd(), "tests/acceptance/intake-interpretation.json"),
    "utf8",
  ));
  assertIntakeAcceptanceCorpus(value);
  return value;
}

describe("intake interpretation acceptance contract", () => {
  it("validates the complete versioned corpus and safety policy", () => {
    const corpus = loadCorpus();
    expect(validateIntakeAcceptanceCorpus(corpus)).toEqual([]);
    expect(corpus.requiredCoverage).toEqual(REQUIRED_INTAKE_COVERAGE);
    expect(corpus.hardFailureRules).toEqual(REQUIRED_INTAKE_HARD_FAILURE_RULES);
    expect(corpus.cases).toHaveLength(14);
    for (const item of corpus.cases) {
      assertIntakeInterpretationInput(item.input);
      assertIntakeInterpretation(item.input, item.expected);
    }
  });

  it("keeps private sentinels out of every model-facing input and interpretation", () => {
    for (const item of loadCorpus().cases) {
      const modelFacing = JSON.stringify({ input: item.input, expected: item.expected });
      for (const sentinel of item.privateSentinels) expect(modelFacing).not.toContain(sentinel);
    }
  });

  it("rejects ungrounded targets and success evidence from another target", () => {
    const ordinary = loadCorpus().cases.find((item) => item.id === "ordinary-contact-lead")!;
    expect(validateIntakeInterpretation(ordinary.input, {
      ...ordinary.expected,
      groundedTargetCandidateIds: ["invented-form"],
    })).toContain("interpretation.groundedTargetCandidateIds must reference supplied candidates");

    const input = structuredClone(ordinary.input);
    input.pageCandidates.push({
      id: "newsletter",
      label: "Newsletter signup",
      kind: "form",
      position: "footer",
      crossOrigin: false,
    });
    input.successEvidenceCandidates.push({
      id: "newsletter-success",
      targetId: "newsletter",
      label: "Subscription confirmed message",
      type: "visible_element",
    });
    expect(validateIntakeInterpretation(input, {
      ...ordinary.expected,
      groundedSuccessEvidenceCandidateIds: ["newsletter-success"],
    })).toContain("interpretation success evidence must belong to a grounded target");
  });

  it("rejects selectors, page payloads, verdicts, and unauthorized authority", () => {
    const ordinary = loadCorpus().cases.find((item) => item.id === "ordinary-contact-lead")!;
    const candidateWithSelector: unknown = {
      ...ordinary.input,
      pageCandidates: [{ ...ordinary.input.pageCandidates[0]!, selector: "#contact" }],
    };
    expect(validateIntakeInterpretationInput(candidateWithSelector))
      .toContain("input.pageCandidates[0].selector is not allowed");

    const inputWithPagePayload: unknown = { ...ordinary.input, fullHtml: "<form>private</form>" };
    expect(validateIntakeInterpretationInput(inputWithPagePayload)).toContain("input.fullHtml is not allowed");

    const interpretationWithVerdict: unknown = { ...ordinary.expected, verdict: "browser_verified" };
    expect(validateIntakeInterpretation(ordinary.input, interpretationWithVerdict))
      .toContain("interpretation.verdict is not allowed");

    expect(validateIntakeInterpretation(ordinary.input, {
      ...ordinary.expected,
      authority: { ...ordinary.expected.authority, canWriteGtm: true },
    })).toContain("interpretation.authority.canWriteGtm must be false");
  });

  it("requires one bounded clarification only when ambiguity remains", () => {
    const corpus = loadCorpus();
    const ambiguous = corpus.cases.find((item) => item.id === "multiple-plausible-form-targets")!;
    expect(validateIntakeInterpretation(ambiguous.input, {
      ...ambiguous.expected,
      clarification: "Choose one",
    })).toContain("interpretation.clarification must be one bounded question for ambiguous input");

    const ordinary = corpus.cases.find((item) => item.id === "ordinary-contact-lead")!;
    expect(validateIntakeInterpretation(ordinary.input, {
      ...ordinary.expected,
      clarification: "Should I continue?",
    })).toContain("interpretation.clarification must be null without ambiguity");
  });

  it("fails the corpus when a private sentinel reaches model-facing data", () => {
    const corpus = structuredClone(loadCorpus());
    const privateCase = corpus.cases.find((item) => item.id === "private-values-are-redacted")!;
    privateCase.input.messages[0] = `${privateCase.input.messages[0]} private-sentinel@example.com`;
    expect(validateIntakeAcceptanceCorpus(corpus))
      .toContain("corpus.cases[13] discloses a private sentinel to model-facing data");
  });
});
