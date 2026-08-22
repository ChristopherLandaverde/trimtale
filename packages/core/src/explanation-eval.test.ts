import { describe, expect, it } from "vitest";
import { evaluateExplanation } from "./explanation-eval.js";

const expectation = {
  mustInclude: ["browser", "request", "platform confirmation"],
  mustNotClaim: ["GA4 confirmed", "published"],
};

describe("verdict explanation evaluation", () => {
  it("accepts varied prose containing every required meaning", () => {
    expect(evaluateExplanation(
      "Browser verification passed because one request was observed. Platform confirmation remains unverified.",
      expectation,
    )).toEqual({ passed: true, score: 1, missingConcepts: [], forbiddenClaims: [] });
  });

  it("scores missing concepts without requiring exact prose", () => {
    expect(evaluateExplanation("The browser check passed.", expectation)).toMatchObject({
      passed: false,
      score: 1 / 3,
      missingConcepts: ["request", "platform confirmation"],
    });
  });

  it("fails unsupported claims regardless of included concepts", () => {
    expect(evaluateExplanation(
      "The browser observed one request and platform confirmation is pending, but GA4 confirmed it.",
      expectation,
    )).toMatchObject({ passed: false, score: 0, forbiddenClaims: ["GA4 confirmed"] });
  });
});
