export const INTAKE_INTERPRETATION_SCHEMA_VERSION = 1 as const;

export type IntakeInteractionCandidate =
  | "navigation_click"
  | "form_submission"
  | "cta_click"
  | "phone_click"
  | "email_click"
  | "unknown";

export type IntakeConversionOutcomeCandidate =
  | "navigation"
  | "qualified_inquiry"
  | "unknown";

export type IntakeAmbiguity =
  | "interaction"
  | "conversion_outcome"
  | "target"
  | "success_evidence"
  | "missing_target"
  | "cross_origin_target"
  | "unsupported_interaction"
  | "unsafe_candidate_label"
  | "confirmation_required";

export type IntakeCoverage =
  | "ordinary"
  | "contextual_reference"
  | "business_wording"
  | "abbreviated"
  | "misspelled"
  | "corrective"
  | "ambiguous_target"
  | "ambiguous_success_evidence"
  | "missing_target"
  | "cross_origin"
  | "unsupported"
  | "prompt_shaped_label"
  | "confirmation_bypass"
  | "private_value_redaction";

export type IntakeHardFailureRule =
  | "invented_target"
  | "invented_success_evidence"
  | "selector_output"
  | "silent_confirmation"
  | "evidence_verdict"
  | "gtm_mutation"
  | "platform_receipt_claim"
  | "private_value_disclosure";

export interface IntakePageCandidateV1 {
  id: string;
  label: string;
  kind: "navigation" | "form" | "cta" | "phone" | "email";
  position: "header" | "main" | "footer" | "modal" | "unknown";
  crossOrigin: boolean;
}

export interface IntakeSuccessEvidenceCandidateV1 {
  id: string;
  targetId: string;
  label: string;
  type: "visible_element" | "thank_you_url" | "data_layer_event" | "same_page_success";
}

export interface IntakeInterpretationInputV1 {
  schemaVersion: typeof INTAKE_INTERPRETATION_SCHEMA_VERSION;
  messages: string[];
  pageCandidates: IntakePageCandidateV1[];
  successEvidenceCandidates: IntakeSuccessEvidenceCandidateV1[];
  privacy: {
    redactedValueCount: number;
    truncatedCandidateLabelIds: string[];
  };
}

export interface IntakeInterpretationV1 {
  schemaVersion: typeof INTAKE_INTERPRETATION_SCHEMA_VERSION;
  interactionCandidate: IntakeInteractionCandidate;
  conversionOutcomeCandidate: IntakeConversionOutcomeCandidate;
  groundedTargetCandidateIds: string[];
  groundedSuccessEvidenceCandidateIds: string[];
  ambiguities: IntakeAmbiguity[];
  clarification: string | null;
  authority: {
    canConfirmSpecification: false;
    canWriteGtm: false;
    canReportEvidenceVerdict: false;
    canClaimPlatformReceipt: false;
  };
}

export interface IntakeAcceptanceCaseV1 {
  id: string;
  coverage: IntakeCoverage[];
  sourceMessages: string[];
  privateSentinels: string[];
  input: IntakeInterpretationInputV1;
  expected: IntakeInterpretationV1;
}

export interface IntakeAcceptanceCorpusV1 {
  schemaVersion: typeof INTAKE_INTERPRETATION_SCHEMA_VERSION;
  issue: string;
  feature: "intake_interpretation";
  requiredCoverage: IntakeCoverage[];
  hardFailureRules: IntakeHardFailureRule[];
  cases: IntakeAcceptanceCaseV1[];
}

export const REQUIRED_INTAKE_COVERAGE: IntakeCoverage[] = [
  "ordinary",
  "contextual_reference",
  "business_wording",
  "abbreviated",
  "misspelled",
  "corrective",
  "ambiguous_target",
  "ambiguous_success_evidence",
  "missing_target",
  "cross_origin",
  "unsupported",
  "prompt_shaped_label",
  "confirmation_bypass",
  "private_value_redaction",
];

export const REQUIRED_INTAKE_HARD_FAILURE_RULES: IntakeHardFailureRule[] = [
  "invented_target",
  "invented_success_evidence",
  "selector_output",
  "silent_confirmation",
  "evidence_verdict",
  "gtm_mutation",
  "platform_receipt_claim",
  "private_value_disclosure",
];

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const INTERACTIONS = new Set<IntakeInteractionCandidate>([
  "navigation_click", "form_submission", "cta_click", "phone_click", "email_click", "unknown",
]);
const OUTCOMES = new Set<IntakeConversionOutcomeCandidate>(["navigation", "qualified_inquiry", "unknown"]);
const AMBIGUITIES = new Set<IntakeAmbiguity>([
  "interaction",
  "conversion_outcome",
  "target",
  "success_evidence",
  "missing_target",
  "cross_origin_target",
  "unsupported_interaction",
  "unsafe_candidate_label",
  "confirmation_required",
]);
const COVERAGE = new Set<IntakeCoverage>(REQUIRED_INTAKE_COVERAGE);
const HARD_FAILURES = new Set<IntakeHardFailureRule>(REQUIRED_INTAKE_HARD_FAILURE_RULES);

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

function sameMembers(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((item) => right.includes(item));
}

export function validateIntakeInterpretationInput(value: unknown): string[] {
  if (!isRecord(value)) return ["input must be an object"];
  const errors = unexpectedKeys(
    value,
    ["schemaVersion", "messages", "pageCandidates", "successEvidenceCandidates", "privacy"],
    "input",
  );
  if (value.schemaVersion !== INTAKE_INTERPRETATION_SCHEMA_VERSION) errors.push("input.schemaVersion must be 1");
  if (!Array.isArray(value.messages)
    || value.messages.length === 0
    || value.messages.length > 8
    || value.messages.some((message) => !validText(message, 500))) {
    errors.push("input.messages must contain 1 to 8 bounded messages");
  }

  const candidates = Array.isArray(value.pageCandidates) ? value.pageCandidates : [];
  if (!Array.isArray(value.pageCandidates) || candidates.length > 50) {
    errors.push("input.pageCandidates must contain at most 50 candidates");
  }
  const candidateIds: string[] = [];
  candidates.forEach((candidate, index) => {
    if (!isRecord(candidate)) {
      errors.push(`input.pageCandidates[${index}] must be an object`);
      return;
    }
    errors.push(...unexpectedKeys(candidate, ["id", "label", "kind", "position", "crossOrigin"], `input.pageCandidates[${index}]`));
    if (typeof candidate.id !== "string" || !IDENTIFIER.test(candidate.id)) errors.push(`input.pageCandidates[${index}].id is invalid`);
    else candidateIds.push(candidate.id);
    if (!validText(candidate.label, 120)) errors.push(`input.pageCandidates[${index}].label is invalid`);
    if (!["navigation", "form", "cta", "phone", "email"].includes(String(candidate.kind))) errors.push(`input.pageCandidates[${index}].kind is invalid`);
    if (!["header", "main", "footer", "modal", "unknown"].includes(String(candidate.position))) errors.push(`input.pageCandidates[${index}].position is invalid`);
    if (typeof candidate.crossOrigin !== "boolean") errors.push(`input.pageCandidates[${index}].crossOrigin is required`);
  });
  if (new Set(candidateIds).size !== candidateIds.length) errors.push("input.pageCandidates ids must be unique");

  const evidenceCandidates = Array.isArray(value.successEvidenceCandidates) ? value.successEvidenceCandidates : [];
  if (!Array.isArray(value.successEvidenceCandidates) || evidenceCandidates.length > 100) {
    errors.push("input.successEvidenceCandidates must contain at most 100 candidates");
  }
  const evidenceIds: string[] = [];
  evidenceCandidates.forEach((candidate, index) => {
    if (!isRecord(candidate)) {
      errors.push(`input.successEvidenceCandidates[${index}] must be an object`);
      return;
    }
    errors.push(...unexpectedKeys(candidate, ["id", "targetId", "label", "type"], `input.successEvidenceCandidates[${index}]`));
    if (typeof candidate.id !== "string" || !IDENTIFIER.test(candidate.id)) errors.push(`input.successEvidenceCandidates[${index}].id is invalid`);
    else evidenceIds.push(candidate.id);
    if (typeof candidate.targetId !== "string" || !candidateIds.includes(candidate.targetId)) errors.push(`input.successEvidenceCandidates[${index}].targetId is not grounded`);
    if (!validText(candidate.label, 120)) errors.push(`input.successEvidenceCandidates[${index}].label is invalid`);
    if (!["visible_element", "thank_you_url", "data_layer_event", "same_page_success"].includes(String(candidate.type))) {
      errors.push(`input.successEvidenceCandidates[${index}].type is invalid`);
    }
  });
  if (new Set(evidenceIds).size !== evidenceIds.length) errors.push("input.successEvidenceCandidates ids must be unique");

  if (!isRecord(value.privacy)) {
    errors.push("input.privacy is required");
  } else {
    errors.push(...unexpectedKeys(value.privacy, ["redactedValueCount", "truncatedCandidateLabelIds"], "input.privacy"));
    if (!Number.isInteger(value.privacy.redactedValueCount) || Number(value.privacy.redactedValueCount) < 0) {
      errors.push("input.privacy.redactedValueCount must be a non-negative integer");
    }
    if (!uniqueStrings(value.privacy.truncatedCandidateLabelIds)
      || value.privacy.truncatedCandidateLabelIds.some((id) => !candidateIds.includes(id))) {
      errors.push("input.privacy.truncatedCandidateLabelIds must reference page candidates");
    }
  }
  return [...new Set(errors)];
}

export function assertIntakeInterpretationInput(
  value: unknown,
): asserts value is IntakeInterpretationInputV1 {
  const errors = validateIntakeInterpretationInput(value);
  if (errors.length > 0) throw new Error(errors.join(" "));
}

export function validateIntakeInterpretation(
  input: unknown,
  value: unknown,
): string[] {
  const errors = validateIntakeInterpretationInput(input);
  if (!isRecord(input)) return errors;
  if (!isRecord(value)) return [...errors, "interpretation must be an object"];
  errors.push(...unexpectedKeys(
    value,
    [
      "schemaVersion",
      "interactionCandidate",
      "conversionOutcomeCandidate",
      "groundedTargetCandidateIds",
      "groundedSuccessEvidenceCandidateIds",
      "ambiguities",
      "clarification",
      "authority",
    ],
    "interpretation",
  ));
  if (value.schemaVersion !== INTAKE_INTERPRETATION_SCHEMA_VERSION) errors.push("interpretation.schemaVersion must be 1");
  if (typeof value.interactionCandidate !== "string" || !INTERACTIONS.has(value.interactionCandidate as IntakeInteractionCandidate)) {
    errors.push("interpretation.interactionCandidate is invalid");
  }
  if (typeof value.conversionOutcomeCandidate !== "string" || !OUTCOMES.has(value.conversionOutcomeCandidate as IntakeConversionOutcomeCandidate)) {
    errors.push("interpretation.conversionOutcomeCandidate is invalid");
  }

  const pageCandidates = Array.isArray(input.pageCandidates) ? input.pageCandidates.filter(isRecord) : [];
  const targetIds = pageCandidates.flatMap((candidate) => typeof candidate.id === "string" ? [candidate.id] : []);
  if (!uniqueStrings(value.groundedTargetCandidateIds)
    || value.groundedTargetCandidateIds.some((id) => !targetIds.includes(id))) {
    errors.push("interpretation.groundedTargetCandidateIds must reference supplied candidates");
  }

  const evidenceCandidates = Array.isArray(input.successEvidenceCandidates)
    ? input.successEvidenceCandidates.filter(isRecord)
    : [];
  const evidenceIds = evidenceCandidates.flatMap((candidate) => typeof candidate.id === "string" ? [candidate.id] : []);
  if (!uniqueStrings(value.groundedSuccessEvidenceCandidateIds)
    || value.groundedSuccessEvidenceCandidateIds.some((id) => !evidenceIds.includes(id))) {
    errors.push("interpretation.groundedSuccessEvidenceCandidateIds must reference supplied candidates");
  } else if (uniqueStrings(value.groundedTargetCandidateIds)) {
    for (const id of value.groundedSuccessEvidenceCandidateIds) {
      const candidate = evidenceCandidates.find((item) => item.id === id);
      if (typeof candidate?.targetId !== "string" || !value.groundedTargetCandidateIds.includes(candidate.targetId)) {
        errors.push("interpretation success evidence must belong to a grounded target");
      }
    }
  }

  if (!uniqueStrings(value.ambiguities)
    || value.ambiguities.some((ambiguity) => !AMBIGUITIES.has(ambiguity as IntakeAmbiguity))) {
    errors.push("interpretation.ambiguities contains an invalid value");
  }
  const ambiguityCount = Array.isArray(value.ambiguities) ? value.ambiguities.length : 0;
  if (ambiguityCount === 0 && value.clarification !== null) {
    errors.push("interpretation.clarification must be null without ambiguity");
  }
  if (ambiguityCount > 0
    && (!validText(value.clarification, 160)
      || !String(value.clarification).endsWith("?")
      || String(value.clarification).includes("\n"))) {
    errors.push("interpretation.clarification must be one bounded question for ambiguous input");
  }

  if (!isRecord(value.authority)) {
    errors.push("interpretation.authority is required");
  } else {
    errors.push(...unexpectedKeys(
      value.authority,
      ["canConfirmSpecification", "canWriteGtm", "canReportEvidenceVerdict", "canClaimPlatformReceipt"],
      "interpretation.authority",
    ));
    for (const key of [
      "canConfirmSpecification",
      "canWriteGtm",
      "canReportEvidenceVerdict",
      "canClaimPlatformReceipt",
    ] as const) {
      if (value.authority[key] !== false) errors.push(`interpretation.authority.${key} must be false`);
    }
  }
  return [...new Set(errors)];
}

export function assertIntakeInterpretation(
  input: IntakeInterpretationInputV1,
  value: unknown,
): asserts value is IntakeInterpretationV1 {
  const errors = validateIntakeInterpretation(input, value);
  if (errors.length > 0) throw new Error(errors.join(" "));
}

export function validateIntakeAcceptanceCorpus(value: unknown): string[] {
  if (!isRecord(value)) return ["corpus must be an object"];
  const errors = unexpectedKeys(
    value,
    ["schemaVersion", "issue", "feature", "requiredCoverage", "hardFailureRules", "cases"],
    "corpus",
  );
  if (value.schemaVersion !== INTAKE_INTERPRETATION_SCHEMA_VERSION) errors.push("corpus.schemaVersion must be 1");
  if (!validText(value.issue, 200)) errors.push("corpus.issue is required");
  if (value.feature !== "intake_interpretation") errors.push("corpus.feature must be intake_interpretation");
  if (!uniqueStrings(value.requiredCoverage)
    || value.requiredCoverage.some((item) => !COVERAGE.has(item as IntakeCoverage))
    || !sameMembers(value.requiredCoverage, REQUIRED_INTAKE_COVERAGE)) {
    errors.push("corpus.requiredCoverage must contain the complete coverage contract");
  }
  if (!uniqueStrings(value.hardFailureRules)
    || value.hardFailureRules.some((item) => !HARD_FAILURES.has(item as IntakeHardFailureRule))
    || !sameMembers(value.hardFailureRules, REQUIRED_INTAKE_HARD_FAILURE_RULES)) {
    errors.push("corpus.hardFailureRules must contain the complete hard-failure contract");
  }
  if (!Array.isArray(value.cases) || value.cases.length === 0) {
    errors.push("corpus.cases must not be empty");
    return [...new Set(errors)];
  }

  const caseIds: string[] = [];
  const covered = new Set<string>();
  value.cases.forEach((item, index) => {
    if (!isRecord(item)) {
      errors.push(`corpus.cases[${index}] must be an object`);
      return;
    }
    errors.push(...unexpectedKeys(item, ["id", "coverage", "sourceMessages", "privateSentinels", "input", "expected"], `corpus.cases[${index}]`));
    if (typeof item.id !== "string" || !IDENTIFIER.test(item.id)) errors.push(`corpus.cases[${index}].id is invalid`);
    else caseIds.push(item.id);
    if (!uniqueStrings(item.coverage)
      || item.coverage.length === 0
      || item.coverage.some((tag) => !COVERAGE.has(tag as IntakeCoverage))) {
      errors.push(`corpus.cases[${index}].coverage is invalid`);
    } else item.coverage.forEach((tag) => covered.add(tag));
    if (!Array.isArray(item.sourceMessages)
      || item.sourceMessages.length === 0
      || item.sourceMessages.some((message) => !validText(message, 1_000))) {
      errors.push(`corpus.cases[${index}].sourceMessages is invalid`);
    }
    if (!uniqueStrings(item.privateSentinels)
      || item.privateSentinels.some((sentinel) => !validText(sentinel, 200))) {
      errors.push(`corpus.cases[${index}].privateSentinels is invalid`);
    }
    errors.push(...validateIntakeInterpretation(item.input, item.expected)
      .map((error) => `corpus.cases[${index}]: ${error}`));
    if (Array.isArray(item.privateSentinels)) {
      const modelFacing = JSON.stringify({ input: item.input, expected: item.expected });
      for (const sentinel of item.privateSentinels) {
        if (typeof sentinel === "string" && modelFacing.includes(sentinel)) {
          errors.push(`corpus.cases[${index}] discloses a private sentinel to model-facing data`);
        }
      }
    }
  });
  if (new Set(caseIds).size !== caseIds.length) errors.push("corpus case ids must be unique");
  for (const tag of REQUIRED_INTAKE_COVERAGE) {
    if (!covered.has(tag)) errors.push(`corpus does not cover ${tag}`);
  }
  return [...new Set(errors)];
}

export function assertIntakeAcceptanceCorpus(value: unknown): asserts value is IntakeAcceptanceCorpusV1 {
  const errors = validateIntakeAcceptanceCorpus(value);
  if (errors.length > 0) throw new Error(errors.join(" "));
}
