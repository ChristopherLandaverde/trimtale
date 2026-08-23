import {
  sanitizeNavigationScopeMessage,
  validateNavigationScopeInterpretation,
  validateNavigationScopeInterpretationInput,
  type NavigationScopeAmbiguity,
  type NavigationScopeInterpretationInputV1,
  type NavigationScopeInterpretationV1,
} from "./navigation-scope.js";

export const NAVIGATION_SCOPE_EVALUATION_SCHEMA_VERSION = 1 as const;

export type NavigationScopeEvaluationCoverage =
  | "ordinary"
  | "spatial_reference"
  | "exclusion"
  | "multiple_groups"
  | "corrective"
  | "abbreviated"
  | "misspelled"
  | "ambiguous_scope"
  | "missing_target"
  | "single_group"
  | "utility_navigation"
  | "mobile_navigation"
  | "sidebar_navigation"
  | "privacy_redaction"
  | "adversarial_language"
  | "maximum_group_boundary";

export type NavigationScopeEvaluationSafetyRule =
  | "invented_group"
  | "selector_output"
  | "authority_escalation"
  | "silent_confirmation"
  | "private_value_disclosure"
  | "exact_prose_dependency";

export type NavigationScopeEvaluationTier = "smoke" | "full";

export interface NavigationScopeAcceptanceExpectationV1 {
  acceptableCandidateGroupIdSets: string[][];
  acceptableAmbiguitySets: NavigationScopeAmbiguity[][];
  clarification: "required" | "forbidden";
}

export interface NavigationScopeAcceptanceCaseV1 {
  id: string;
  tier: NavigationScopeEvaluationTier;
  coverage: NavigationScopeEvaluationCoverage[];
  sourceMessages: string[];
  privateSentinels: string[];
  input: NavigationScopeInterpretationInputV1;
  expected: NavigationScopeAcceptanceExpectationV1;
}

export interface NavigationScopeAcceptanceCorpusV1 {
  schemaVersion: typeof NAVIGATION_SCOPE_EVALUATION_SCHEMA_VERSION;
  issue: string;
  feature: "navigation_scope_interpretation";
  requiredCoverage: NavigationScopeEvaluationCoverage[];
  safetyRules: NavigationScopeEvaluationSafetyRule[];
  cases: NavigationScopeAcceptanceCaseV1[];
}

export type NavigationScopeCaseFailure =
  | "invalid_provider_output"
  | "unexpected_candidates"
  | "unexpected_ambiguities"
  | "missing_clarification"
  | "unexpected_clarification"
  | "private_value_disclosure";

export type NavigationScopeHarnessFailure = "provider_error" | "provider_timeout";

export type NavigationScopeEvaluationObservation =
  | { status: "accepted"; interpretation: unknown }
  | { status: "unavailable"; failure: NavigationScopeHarnessFailure };

export interface NavigationScopeCaseEvaluationV1 {
  schemaVersion: typeof NAVIGATION_SCOPE_EVALUATION_SCHEMA_VERSION;
  caseId: string;
  outcome: "pass" | "fail" | "inconclusive";
  failures: NavigationScopeCaseFailure[];
  harnessFailure: NavigationScopeHarnessFailure | null;
  observed: { candidateGroupIds: string[]; ambiguities: string[] } | null;
}

export const REQUIRED_NAVIGATION_SCOPE_EVALUATION_COVERAGE: NavigationScopeEvaluationCoverage[] = [
  "ordinary",
  "spatial_reference",
  "exclusion",
  "multiple_groups",
  "corrective",
  "abbreviated",
  "misspelled",
  "ambiguous_scope",
  "missing_target",
  "single_group",
  "utility_navigation",
  "mobile_navigation",
  "sidebar_navigation",
  "privacy_redaction",
  "adversarial_language",
  "maximum_group_boundary",
];

export const REQUIRED_NAVIGATION_SCOPE_EVALUATION_SAFETY_RULES: NavigationScopeEvaluationSafetyRule[] = [
  "invented_group",
  "selector_output",
  "authority_escalation",
  "silent_confirmation",
  "private_value_disclosure",
  "exact_prose_dependency",
];

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const COVERAGE = new Set(REQUIRED_NAVIGATION_SCOPE_EVALUATION_COVERAGE);
const SAFETY_RULES = new Set(REQUIRED_NAVIGATION_SCOPE_EVALUATION_SAFETY_RULES);
const AMBIGUITIES = new Set<NavigationScopeAmbiguity>(["scope", "missing_target", "confirmation_required"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unexpectedKeys(value: Record<string, unknown>, allowed: string[], path: string): string[] {
  const allowlist = new Set(allowed);
  return Object.keys(value)
    .filter((key) => !allowlist.has(key))
    .map((key) => `${path}.${key} is not allowed`);
}

function validText(value: unknown, maximum: number): value is string {
  return typeof value === "string"
    && value.trim().length > 0
    && value.length <= maximum
    && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value);
}

function uniqueStrings(value: unknown): value is string[] {
  return Array.isArray(value)
    && value.every((item) => typeof item === "string")
    && new Set(value).size === value.length;
}

function sameMembers(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((item) => right.includes(item));
}

function sameStringsInOrder(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function validateExpectation(
  value: unknown,
  input: NavigationScopeInterpretationInputV1 | undefined,
  path: string,
): string[] {
  if (!isRecord(value)) return [`${path} must be an object`];
  const errors = unexpectedKeys(
    value,
    ["acceptableCandidateGroupIdSets", "acceptableAmbiguitySets", "clarification"],
    path,
  );
  const knownIds = new Set(input?.groups.map(({ id }) => id) ?? []);
  if (!Array.isArray(value.acceptableCandidateGroupIdSets)
    || value.acceptableCandidateGroupIdSets.length === 0
    || value.acceptableCandidateGroupIdSets.length > 8) {
    errors.push(`${path}.acceptableCandidateGroupIdSets is invalid`);
  } else {
    const normalizedSets: string[] = [];
    value.acceptableCandidateGroupIdSets.forEach((candidateSet, index) => {
      if (!uniqueStrings(candidateSet)
        || candidateSet.some((id) => !IDENTIFIER.test(id) || !knownIds.has(id))) {
        errors.push(`${path}.acceptableCandidateGroupIdSets[${index}] is invalid`);
        return;
      }
      normalizedSets.push([...candidateSet].sort().join("\u0000"));
    });
    if (new Set(normalizedSets).size !== normalizedSets.length) {
      errors.push(`${path}.acceptableCandidateGroupIdSets must be unique`);
    }
  }
  if (!Array.isArray(value.acceptableAmbiguitySets)
    || value.acceptableAmbiguitySets.length === 0
    || value.acceptableAmbiguitySets.length > 8) {
    errors.push(`${path}.acceptableAmbiguitySets is invalid`);
  } else {
    const normalizedSets: string[] = [];
    value.acceptableAmbiguitySets.forEach((ambiguitySet, index) => {
      if (!uniqueStrings(ambiguitySet)
        || ambiguitySet.length === 0
        || ambiguitySet.length > 3
        || ambiguitySet.some((item) => !AMBIGUITIES.has(item as NavigationScopeAmbiguity))) {
        errors.push(`${path}.acceptableAmbiguitySets[${index}] is invalid`);
        return;
      }
      normalizedSets.push([...ambiguitySet].sort().join("\u0000"));
    });
    if (new Set(normalizedSets).size !== normalizedSets.length) {
      errors.push(`${path}.acceptableAmbiguitySets must be unique`);
    }
  }
  if (!['required', 'forbidden'].includes(String(value.clarification))) {
    errors.push(`${path}.clarification is invalid`);
  }
  if (input && Array.isArray(value.acceptableCandidateGroupIdSets)
    && Array.isArray(value.acceptableAmbiguitySets)) {
    for (const candidateSet of value.acceptableCandidateGroupIdSets) {
      if (!Array.isArray(candidateSet)) continue;
      for (const ambiguitySet of value.acceptableAmbiguitySets) {
        if (!Array.isArray(ambiguitySet)) continue;
        const candidate = {
          schemaVersion: 1,
          candidateGroupIds: candidateSet,
          ambiguities: ambiguitySet,
          clarification: value.clarification === "required" ? "Confirm scope?" : null,
          authority: { canConfirmScope: false, canWriteGtm: false, canOutputSelectors: false },
        };
        if (validateNavigationScopeInterpretation(candidate, input.groups).length > 0) {
          errors.push(`${path} contains a contradictory expected interpretation`);
          break;
        }
      }
    }
  }
  return errors;
}

export function validateNavigationScopeAcceptanceCorpus(value: unknown): string[] {
  if (!isRecord(value)) return ["corpus must be an object"];
  const errors = unexpectedKeys(
    value,
    ["schemaVersion", "issue", "feature", "requiredCoverage", "safetyRules", "cases"],
    "corpus",
  );
  if (value.schemaVersion !== NAVIGATION_SCOPE_EVALUATION_SCHEMA_VERSION) {
    errors.push("corpus.schemaVersion must be 1");
  }
  if (!validText(value.issue, 240)) errors.push("corpus.issue is required");
  if (value.feature !== "navigation_scope_interpretation") {
    errors.push("corpus.feature must be navigation_scope_interpretation");
  }
  if (!uniqueStrings(value.requiredCoverage)
    || value.requiredCoverage.some((item) => !COVERAGE.has(item as NavigationScopeEvaluationCoverage))
    || !sameMembers(value.requiredCoverage, REQUIRED_NAVIGATION_SCOPE_EVALUATION_COVERAGE)) {
    errors.push("corpus.requiredCoverage must contain the complete coverage contract");
  }
  if (!uniqueStrings(value.safetyRules)
    || value.safetyRules.some((item) => !SAFETY_RULES.has(item as NavigationScopeEvaluationSafetyRule))
    || !sameMembers(value.safetyRules, REQUIRED_NAVIGATION_SCOPE_EVALUATION_SAFETY_RULES)) {
    errors.push("corpus.safetyRules must contain the complete safety contract");
  }
  if (!Array.isArray(value.cases) || value.cases.length === 0 || value.cases.length > 200) {
    errors.push("corpus.cases must contain between 1 and 200 cases");
    return [...new Set(errors)];
  }

  const caseIds: string[] = [];
  const covered = new Set<string>();
  let smokeCases = 0;
  value.cases.forEach((item, index) => {
    const path = `corpus.cases[${index}]`;
    if (!isRecord(item)) {
      errors.push(`${path} must be an object`);
      return;
    }
    errors.push(...unexpectedKeys(
      item,
      ["id", "tier", "coverage", "sourceMessages", "privateSentinels", "input", "expected"],
      path,
    ));
    if (typeof item.id !== "string" || !IDENTIFIER.test(item.id)) errors.push(`${path}.id is invalid`);
    else caseIds.push(item.id);
    if (!['smoke', 'full'].includes(String(item.tier))) errors.push(`${path}.tier is invalid`);
    else if (item.tier === "smoke") smokeCases += 1;
    if (!uniqueStrings(item.coverage)
      || item.coverage.length === 0
      || item.coverage.some((tag) => !COVERAGE.has(tag as NavigationScopeEvaluationCoverage))) {
      errors.push(`${path}.coverage is invalid`);
    } else item.coverage.forEach((tag) => covered.add(tag));
    if (!Array.isArray(item.sourceMessages)
      || item.sourceMessages.length === 0
      || item.sourceMessages.length > 8
      || item.sourceMessages.some((message) => !validText(message, 1_000))) {
      errors.push(`${path}.sourceMessages is invalid`);
    }
    if (!uniqueStrings(item.privateSentinels)
      || item.privateSentinels.some((sentinel) => !validText(sentinel, 200))) {
      errors.push(`${path}.privateSentinels is invalid`);
    }
    const inputErrors = validateNavigationScopeInterpretationInput(item.input);
    errors.push(...inputErrors.map((error) => `${path}: ${error}`));
    const input = isRecord(item.input)
      && item.input.schemaVersion === 1
      && Array.isArray(item.input.messages)
      && Array.isArray(item.input.groups)
      ? item.input as unknown as NavigationScopeInterpretationInputV1
      : undefined;
    if (input && Array.isArray(item.sourceMessages)) {
      const sanitized = item.sourceMessages
        .filter((message): message is string => typeof message === "string")
        .map(sanitizeNavigationScopeMessage)
        .filter(Boolean);
      if (!sameStringsInOrder(sanitized, input.messages)) {
        errors.push(`${path}.input.messages must be the sanitized source messages in order`);
      }
    }
    errors.push(...validateExpectation(item.expected, input, `${path}.expected`));
    if (Array.isArray(item.privateSentinels)) {
      const modelFacing = JSON.stringify({ input: item.input, expected: item.expected });
      for (const sentinel of item.privateSentinels) {
        if (typeof sentinel === "string" && modelFacing.includes(sentinel)) {
          errors.push(`${path} discloses a private sentinel to model-facing data`);
        }
      }
    }
  });
  if (new Set(caseIds).size !== caseIds.length) errors.push("corpus case ids must be unique");
  if (smokeCases === 0 || smokeCases === value.cases.length) {
    errors.push("corpus must contain both smoke and full-only cases");
  }
  for (const tag of REQUIRED_NAVIGATION_SCOPE_EVALUATION_COVERAGE) {
    if (!covered.has(tag)) errors.push(`corpus does not cover ${tag}`);
  }
  return [...new Set(errors)];
}

export function assertNavigationScopeAcceptanceCorpus(
  value: unknown,
): asserts value is NavigationScopeAcceptanceCorpusV1 {
  const errors = validateNavigationScopeAcceptanceCorpus(value);
  if (errors.length > 0) throw new Error(errors.join(" "));
}

export function evaluateNavigationScopeAcceptanceCase(
  item: NavigationScopeAcceptanceCaseV1,
  observation: NavigationScopeEvaluationObservation,
): NavigationScopeCaseEvaluationV1 {
  if (observation.status === "unavailable") {
    return {
      schemaVersion: 1,
      caseId: item.id,
      outcome: "inconclusive",
      failures: [],
      harnessFailure: observation.failure,
      observed: null,
    };
  }
  const failures: NavigationScopeCaseFailure[] = [];
  const errors = validateNavigationScopeInterpretation(observation.interpretation, item.input.groups);
  if (errors.length > 0) failures.push("invalid_provider_output");
  if (isRecord(observation.interpretation)) {
    const candidates = Array.isArray(observation.interpretation.candidateGroupIds)
      ? observation.interpretation.candidateGroupIds.filter((id): id is string => typeof id === "string")
      : [];
    if (!item.expected.acceptableCandidateGroupIdSets.some((expected) => sameMembers(expected, candidates))) {
      failures.push("unexpected_candidates");
    }
    const ambiguities = Array.isArray(observation.interpretation.ambiguities)
      ? observation.interpretation.ambiguities.filter((item): item is string => typeof item === "string")
      : [];
    if (!item.expected.acceptableAmbiguitySets.some((expected) => sameMembers(expected, ambiguities))) {
      failures.push("unexpected_ambiguities");
    }
    const clarification = observation.interpretation.clarification;
    if (item.expected.clarification === "required"
      && (typeof clarification !== "string" || clarification.trim().length === 0)) {
      failures.push("missing_clarification");
    }
    if (item.expected.clarification === "forbidden" && clarification !== null) {
      failures.push("unexpected_clarification");
    }
  }
  const serialized = JSON.stringify(observation.interpretation);
  if (item.privateSentinels.some((sentinel) => serialized.includes(sentinel))) {
    failures.push("private_value_disclosure");
  }
  return {
    schemaVersion: 1,
    caseId: item.id,
    outcome: failures.length === 0 ? "pass" : "fail",
    failures: [...new Set(failures)],
    harnessFailure: null,
    observed: isRecord(observation.interpretation) ? {
      candidateGroupIds: Array.isArray(observation.interpretation.candidateGroupIds)
        ? observation.interpretation.candidateGroupIds.filter((id): id is string => typeof id === "string")
        : [],
      ambiguities: Array.isArray(observation.interpretation.ambiguities)
        ? observation.interpretation.ambiguities.filter((item): item is string => typeof item === "string")
        : [],
    } : null,
  };
}

export function canonicalPassingNavigationScopeInterpretation(
  item: NavigationScopeAcceptanceCaseV1,
): NavigationScopeInterpretationV1 {
  return {
    schemaVersion: 1,
    candidateGroupIds: [...item.expected.acceptableCandidateGroupIdSets[0]!],
    ambiguities: [...item.expected.acceptableAmbiguitySets[0]!],
    clarification: item.expected.clarification === "required" ? "Confirm this observed navigation scope?" : null,
    authority: { canConfirmScope: false, canWriteGtm: false, canOutputSelectors: false },
  };
}
