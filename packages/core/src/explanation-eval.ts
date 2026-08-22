export interface ExplanationExpectation {
  mustInclude: string[];
  mustNotClaim: string[];
}

export interface ExplanationEvaluation {
  passed: boolean;
  score: number;
  missingConcepts: string[];
  forbiddenClaims: string[];
}

function normalized(value: string): string {
  return value.toLocaleLowerCase().replace(/\s+/g, " ").trim();
}

export function evaluateExplanation(
  explanation: string,
  expectation: ExplanationExpectation,
): ExplanationEvaluation {
  const copy = normalized(explanation);
  const missingConcepts = expectation.mustInclude.filter((concept) => !copy.includes(normalized(concept)));
  const forbiddenClaims = expectation.mustNotClaim.filter((claim) => copy.includes(normalized(claim)));
  const requiredCount = expectation.mustInclude.length;
  const conceptScore = requiredCount === 0 ? 1 : (requiredCount - missingConcepts.length) / requiredCount;
  const score = forbiddenClaims.length > 0 ? 0 : conceptScore;
  return { passed: missingConcepts.length === 0 && forbiddenClaims.length === 0, score, missingConcepts, forbiddenClaims };
}
