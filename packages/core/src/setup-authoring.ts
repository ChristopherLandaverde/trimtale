import {
  assertTrackingSetup,
  type FiringPolicyV1,
  type ParameterRequirement,
  type TrackingSetupV1,
  type ValueSourceV1,
  type VerificationExpectationV1,
} from "./setup-contract.js";

export const SETUP_AUTHORING_SCHEMA_VERSION = 1 as const;

export type SuggestionClass =
  | "provider_required"
  | "provider_recommended"
  | "observed_available"
  | "model_suggested"
  | "unavailable"
  | "requires_clarification"
  | "requires_custom_definition"
  | "prohibited";

export interface SetupAuthoringInputV1 {
  schemaVersion: typeof SETUP_AUTHORING_SCHEMA_VERSION;
  requestId: string;
  intent: string;
  businessOutcome: string | null;
  existingEventNames: string[];
  firingPolicyCandidates: Array<{
    id: string;
    label: string;
    sourceType: FiringPolicyV1["source"]["type"];
  }>;
  valueCandidates: Array<{
    id: string;
    label: string;
    sourceType: Exclude<ValueSourceV1["type"], "literal">;
  }>;
  privacy: {
    redactedValueCount: number;
    truncatedLabelIds: string[];
  };
}

export interface ParameterSuggestionV1 {
  name: string;
  classification: SuggestionClass;
  requirement: ParameterRequirement;
  valueCandidateId: string | null;
  rationale: string;
}

export interface SetupAuthoringProposalV1 {
  schemaVersion: typeof SETUP_AUTHORING_SCHEMA_VERSION;
  status: "ready" | "needs_clarification" | "unsupported";
  eventName: string | null;
  firingPolicyCandidateIds: string[];
  parameters: ParameterSuggestionV1[];
  clarification: string | null;
  rationale: string;
  authority: {
    canSupplySelectors: false;
    canSupplyEvidence: false;
    canWriteGtm: false;
    canApprove: false;
    canPublish: false;
  };
}

export interface SetupAuthoringGroundingV1 {
  setupId: string;
  measurementId: string;
  firingPolicies: Array<{
    candidateId: string;
    policy: FiringPolicyV1;
  }>;
  values: Array<{
    candidateId: string;
    value: ValueSourceV1;
  }>;
  verification: {
    positive: VerificationExpectationV1[];
    negative: VerificationExpectationV1[];
  };
  prohibitedOutputValues: string[];
}

export interface SetupAuthoringUsageV1 {
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
}

export interface SetupAuthoringProvider {
  id: string;
  propose(
    input: Readonly<SetupAuthoringInputV1>,
    context: { signal: AbortSignal },
  ): Promise<{ proposal: unknown; usage: SetupAuthoringUsageV1 }>;
}

export interface SetupAuthoringResultV1 {
  schemaVersion: typeof SETUP_AUTHORING_SCHEMA_VERSION;
  providerId: string;
  proposal: SetupAuthoringProposalV1;
  suggestions: ParameterSuggestionV1[];
  setup: TrackingSetupV1 | null;
  usage: SetupAuthoringUsageV1;
}

const EVENT_NAME = /^[a-z][a-z0-9_]{0,39}$/;
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const MEASUREMENT_ID = /^G-[A-Z0-9]{4,20}$/;
const MAX_TEXT_LENGTH = 2_000;
const MAX_CANDIDATES = 100;
const MAX_PARAMETERS = 50;
const STATUSES = new Set(["ready", "needs_clarification", "unsupported"]);
const SOURCE_TYPES = new Set([
  "page_view",
  "dom_ready",
  "window_loaded",
  "history_change",
  "click",
  "form_submission",
  "element_visibility",
  "custom_data_layer",
]);
const VALUE_TYPES = new Set(["built_in_variable", "data_layer_variable", "constant"]);
const SUGGESTION_CLASSES = new Set<SuggestionClass>([
  "provider_required",
  "provider_recommended",
  "observed_available",
  "model_suggested",
  "unavailable",
  "requires_clarification",
  "requires_custom_definition",
  "prohibited",
]);
const REQUIREMENTS = new Set(["required", "recommended", "optional"]);
const INPUT_KEYS = [
  "schemaVersion",
  "requestId",
  "intent",
  "businessOutcome",
  "existingEventNames",
  "firingPolicyCandidates",
  "valueCandidates",
  "privacy",
];
const PROPOSAL_KEYS = [
  "schemaVersion",
  "status",
  "eventName",
  "firingPolicyCandidateIds",
  "parameters",
  "clarification",
  "rationale",
  "authority",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validText(value: unknown, maxLength = MAX_TEXT_LENGTH): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}

function unexpectedKeys(
  value: Record<string, unknown>,
  allowed: string[],
  path: string,
): string[] {
  return Object.keys(value)
    .filter((key) => !allowed.includes(key))
    .map((key) => `${path}.${key} is not allowed`);
}

function uniqueIds(value: unknown, max: number): value is string[] {
  return Array.isArray(value)
    && value.length <= max
    && value.every((item) => typeof item === "string" && IDENTIFIER.test(item))
    && new Set(value).size === value.length;
}

function validUsage(value: unknown): value is SetupAuthoringUsageV1 {
  if (!isRecord(value)) {
    return false;
  }
  return Number.isInteger(value.inputTokens)
    && Number(value.inputTokens) >= 0
    && Number.isInteger(value.outputTokens)
    && Number(value.outputTokens) >= 0
    && typeof value.estimatedCostUsd === "number"
    && Number.isFinite(value.estimatedCostUsd)
    && value.estimatedCostUsd >= 0;
}

export function validateAuthoringInput(value: unknown): string[] {
  if (!isRecord(value)) {
    return ["setup authoring input must be an object"];
  }
  const errors = unexpectedKeys(value, INPUT_KEYS, "input");
  if (value.schemaVersion !== SETUP_AUTHORING_SCHEMA_VERSION) {
    errors.push("input.schemaVersion must be 1");
  }
  if (typeof value.requestId !== "string" || !IDENTIFIER.test(value.requestId)) {
    errors.push("input.requestId is invalid");
  }
  if (!validText(value.intent)) {
    errors.push("input.intent is required");
  }
  if (value.businessOutcome !== null && !validText(value.businessOutcome)) {
    errors.push("input.businessOutcome is invalid");
  }
  if (!uniqueIds(value.existingEventNames, MAX_CANDIDATES)
    || (value.existingEventNames as string[]).some((name) => !EVENT_NAME.test(name))) {
    errors.push("input.existingEventNames is invalid");
  }

  if (!Array.isArray(value.firingPolicyCandidates)
    || value.firingPolicyCandidates.length > MAX_CANDIDATES) {
    errors.push("input.firingPolicyCandidates is invalid");
  } else {
    const ids = new Set<string>();
    value.firingPolicyCandidates.forEach((candidate, index) => {
      const path = `input.firingPolicyCandidates[${index}]`;
      if (!isRecord(candidate)) {
        errors.push(`${path} is invalid`);
        return;
      }
      errors.push(...unexpectedKeys(candidate, ["id", "label", "sourceType"], path));
      if (typeof candidate.id !== "string" || !IDENTIFIER.test(candidate.id) || ids.has(candidate.id)) {
        errors.push(`${path}.id is invalid or duplicate`);
      } else {
        ids.add(candidate.id);
      }
      if (!validText(candidate.label, 256)) {
        errors.push(`${path}.label is required`);
      }
      if (typeof candidate.sourceType !== "string" || !SOURCE_TYPES.has(candidate.sourceType)) {
        errors.push(`${path}.sourceType is unsupported`);
      }
    });
  }

  if (!Array.isArray(value.valueCandidates) || value.valueCandidates.length > MAX_CANDIDATES) {
    errors.push("input.valueCandidates is invalid");
  } else {
    const ids = new Set<string>();
    value.valueCandidates.forEach((candidate, index) => {
      const path = `input.valueCandidates[${index}]`;
      if (!isRecord(candidate)) {
        errors.push(`${path} is invalid`);
        return;
      }
      errors.push(...unexpectedKeys(candidate, ["id", "label", "sourceType"], path));
      if (typeof candidate.id !== "string" || !IDENTIFIER.test(candidate.id) || ids.has(candidate.id)) {
        errors.push(`${path}.id is invalid or duplicate`);
      } else {
        ids.add(candidate.id);
      }
      if (!validText(candidate.label, 256)) {
        errors.push(`${path}.label is required`);
      }
      if (typeof candidate.sourceType !== "string" || !VALUE_TYPES.has(candidate.sourceType)) {
        errors.push(`${path}.sourceType is unsupported`);
      }
    });
  }

  if (!isRecord(value.privacy)) {
    errors.push("input.privacy is required");
  } else {
    errors.push(...unexpectedKeys(value.privacy, ["redactedValueCount", "truncatedLabelIds"], "input.privacy"));
    if (!Number.isInteger(value.privacy.redactedValueCount) || Number(value.privacy.redactedValueCount) < 0) {
      errors.push("input.privacy.redactedValueCount is invalid");
    }
    if (!uniqueIds(value.privacy.truncatedLabelIds, MAX_CANDIDATES)) {
      errors.push("input.privacy.truncatedLabelIds is invalid");
    }
  }
  return [...new Set(errors)];
}

function validateSuggestion(
  value: unknown,
  index: number,
  valueCandidateIds: Set<string>,
  errors: string[],
): void {
  const path = `proposal.parameters[${index}]`;
  if (!isRecord(value)) {
    errors.push(`${path} is invalid`);
    return;
  }
  errors.push(...unexpectedKeys(
    value,
    ["name", "classification", "requirement", "valueCandidateId", "rationale"],
    path,
  ));
  if (typeof value.name !== "string" || !EVENT_NAME.test(value.name)) {
    errors.push(`${path}.name is invalid`);
  }
  if (typeof value.classification !== "string"
    || !SUGGESTION_CLASSES.has(value.classification as SuggestionClass)) {
    errors.push(`${path}.classification is unsupported`);
  }
  if (typeof value.requirement !== "string" || !REQUIREMENTS.has(value.requirement)) {
    errors.push(`${path}.requirement is unsupported`);
  }
  if (value.valueCandidateId !== null
    && (typeof value.valueCandidateId !== "string" || !valueCandidateIds.has(value.valueCandidateId))) {
    errors.push(`${path}.valueCandidateId must reference a supplied candidate`);
  }
  if (value.requirement === "required" && value.valueCandidateId === null) {
    errors.push(`${path}.required suggestion needs an available value`);
  }
  if (!validText(value.rationale, 500)) {
    errors.push(`${path}.rationale is required`);
  }
}

export function validateAuthoringProposal(
  input: SetupAuthoringInputV1,
  grounding: SetupAuthoringGroundingV1,
  value: unknown,
): string[] {
  if (!isRecord(value)) {
    return ["setup authoring proposal must be an object"];
  }
  const errors = unexpectedKeys(value, PROPOSAL_KEYS, "proposal");
  if (value.schemaVersion !== SETUP_AUTHORING_SCHEMA_VERSION) {
    errors.push("proposal.schemaVersion must be 1");
  }
  if (typeof value.status !== "string" || !STATUSES.has(value.status)) {
    errors.push("proposal.status is unsupported");
  }
  if (value.eventName !== null && (typeof value.eventName !== "string" || !EVENT_NAME.test(value.eventName))) {
    errors.push("proposal.eventName is invalid");
  }
  const firingIds = new Set(input.firingPolicyCandidates.map(({ id }) => id));
  if (!uniqueIds(value.firingPolicyCandidateIds, MAX_CANDIDATES)
    || (value.firingPolicyCandidateIds as string[]).some((id) => !firingIds.has(id))) {
    errors.push("proposal.firingPolicyCandidateIds must reference supplied candidates");
  }
  const valueIds = new Set(input.valueCandidates.map(({ id }) => id));
  if (!Array.isArray(value.parameters) || value.parameters.length > MAX_PARAMETERS) {
    errors.push("proposal.parameters is invalid");
  } else {
    value.parameters.forEach((suggestion, index) => {
      validateSuggestion(suggestion, index, valueIds, errors);
    });
    const names = value.parameters
      .filter(isRecord)
      .map(({ name }) => name)
      .filter((name): name is string => typeof name === "string");
    if (new Set(names).size !== names.length) {
      errors.push("proposal.parameters contains duplicate names");
    }
  }
  if (value.status === "ready") {
    if (typeof value.eventName !== "string" || !EVENT_NAME.test(value.eventName)) {
      errors.push("ready proposal requires an eventName");
    }
    if (!Array.isArray(value.firingPolicyCandidateIds) || value.firingPolicyCandidateIds.length === 0) {
      errors.push("ready proposal requires a firing policy");
    }
    if (!input.businessOutcome) {
      errors.push("ready proposal requires a grounded business outcome");
    }
    if (value.clarification !== null) {
      errors.push("ready proposal cannot ask a clarification");
    }
  }
  if (value.status === "needs_clarification"
    && (!validText(value.clarification, 300) || !String(value.clarification).endsWith("?"))) {
    errors.push("ambiguous proposal requires one bounded question");
  }
  if (value.status === "unsupported" && value.eventName !== null) {
    errors.push("unsupported proposal cannot supply an eventName");
  }
  if (!validText(value.rationale, 1_000)) {
    errors.push("proposal.rationale is required");
  }
  if (!isRecord(value.authority)) {
    errors.push("proposal.authority is required");
  } else {
    const authority = value.authority;
    const authorityKeys = [
      "canSupplySelectors",
      "canSupplyEvidence",
      "canWriteGtm",
      "canApprove",
      "canPublish",
    ];
    errors.push(...unexpectedKeys(authority, authorityKeys, "proposal.authority"));
    authorityKeys.forEach((key) => {
      if (authority[key] !== false) {
        errors.push(`proposal.authority.${key} must be false`);
      }
    });
  }

  const serialized = JSON.stringify(value).toLowerCase();
  for (const prohibited of grounding.prohibitedOutputValues) {
    if (prohibited.length > 0 && serialized.includes(prohibited.toLowerCase())) {
      errors.push("proposal contains a prohibited private value");
    }
  }
  const groundedPolicyIds = new Set(grounding.firingPolicies.map(({ candidateId }) => candidateId));
  if (Array.isArray(value.firingPolicyCandidateIds)
    && value.firingPolicyCandidateIds.some((id) => typeof id === "string" && !groundedPolicyIds.has(id))) {
    errors.push("proposal firing policy is not deterministically grounded");
  }
  const groundedValueIds = new Set(grounding.values.map(({ candidateId }) => candidateId));
  if (Array.isArray(value.parameters) && value.parameters.some((parameter) =>
    isRecord(parameter)
      && typeof parameter.valueCandidateId === "string"
      && !groundedValueIds.has(parameter.valueCandidateId))) {
    errors.push("proposal parameter value is not deterministically grounded");
  }
  return [...new Set(errors)];
}

function assembleSetup(
  input: SetupAuthoringInputV1,
  grounding: SetupAuthoringGroundingV1,
  proposal: SetupAuthoringProposalV1,
): TrackingSetupV1 | null {
  if (proposal.status !== "ready" || !proposal.eventName || !input.businessOutcome) {
    return null;
  }
  if (!MEASUREMENT_ID.test(grounding.measurementId)) {
    throw new Error("Setup authoring grounding is invalid.");
  }
  const policies = new Map(grounding.firingPolicies.map((item) => [item.candidateId, item.policy]));
  const values = new Map(grounding.values.map((item) => [item.candidateId, item.value]));
  const includedClasses = new Set<SuggestionClass>([
    "provider_required",
    "provider_recommended",
    "observed_available",
    "model_suggested",
    "requires_custom_definition",
  ]);
  const actionId = `tag_${proposal.eventName}`;
  const setup: TrackingSetupV1 = {
    schemaVersion: 1,
    id: grounding.setupId,
    status: "draft",
    intent: {
      statement: input.intent,
      businessOutcome: input.businessOutcome,
    },
    tagActions: [{
      id: actionId,
      name: `GA4 Event - ${proposal.eventName}`,
      execution: {
        type: "template",
        templateId: "google.analytics.ga4_event",
        fields: [],
      },
      destination: { type: "ga4", measurementId: grounding.measurementId },
      event: {
        name: proposal.eventName,
        parameters: proposal.parameters.flatMap((suggestion) => {
          if (!includedClasses.has(suggestion.classification) || !suggestion.valueCandidateId) {
            return [];
          }
          const value = values.get(suggestion.valueCandidateId);
          return value ? [{
            name: suggestion.name,
            requirement: suggestion.requirement,
            value,
          }] : [];
        }),
      },
      firingPolicyIds: proposal.firingPolicyCandidateIds.map((id) => policies.get(id)!.id),
    }],
    firingPolicies: proposal.firingPolicyCandidateIds.map((id) => policies.get(id)!),
    verification: {
      positive: grounding.verification.positive,
      negative: grounding.verification.negative.map((expectation) =>
        expectation.type === "tag_fired"
          ? { ...expectation, tagActionId: actionId }
          : expectation),
    },
  };
  assertTrackingSetup(setup);
  return setup;
}

export async function authorTrackingSetup(
  provider: SetupAuthoringProvider,
  input: SetupAuthoringInputV1,
  grounding: SetupAuthoringGroundingV1,
  context: { signal: AbortSignal },
): Promise<SetupAuthoringResultV1> {
  const safeInput = structuredClone(input);
  if (validateAuthoringInput(safeInput).length > 0) {
    throw new Error("Setup authoring input is invalid.");
  }

  let result: { proposal: unknown; usage: SetupAuthoringUsageV1 };
  try {
    result = await provider.propose(safeInput, context);
  } catch {
    throw new Error("Setup authoring provider request failed.");
  }
  if (!validUsage(result.usage)
    || validateAuthoringProposal(safeInput, grounding, result.proposal).length > 0) {
    throw new Error("Setup authoring provider output is invalid.");
  }
  const proposal = structuredClone(result.proposal) as SetupAuthoringProposalV1;
  return {
    schemaVersion: SETUP_AUTHORING_SCHEMA_VERSION,
    providerId: provider.id,
    proposal,
    suggestions: proposal.parameters,
    setup: assembleSetup(safeInput, grounding, proposal),
    usage: structuredClone(result.usage),
  };
}
