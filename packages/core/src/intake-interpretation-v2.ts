import {
  interpretConversationIntent,
  selectConversationSuccess,
  type ConversationIntakeResult,
  type ConversationInteraction,
  type ConversationPageContext,
} from "./conversation.js";

export const INTAKE_INTERPRETATION_V2_SCHEMA_VERSION = 2 as const;

export type IntakeAmbiguityV2 =
  | "interaction"
  | "conversion_outcome"
  | "target"
  | "success_evidence"
  | "missing_target"
  | "cross_origin_target"
  | "unsupported_interaction"
  | "multiple_measurements"
  | "confirmation_required";

export type IntakePageCandidateKindV2 =
  | "navigation"
  | "form"
  | "cta"
  | "phone"
  | "email"
  | "outbound_link"
  | "file_download"
  | "booking";

export interface IntakePageCandidateV2 {
  id: string;
  label: string;
  kind: IntakePageCandidateKindV2;
  position: "header" | "main" | "footer" | "modal" | "unknown";
  crossOrigin: boolean;
}

export interface IntakeSuccessEvidenceCandidateV2 {
  id: string;
  targetId: string;
  label: string;
  type: "visible_element" | "thank_you_url" | "data_layer_event" | "same_page_success";
}

export interface IntakeInterpretationInputV2 {
  schemaVersion: typeof INTAKE_INTERPRETATION_V2_SCHEMA_VERSION;
  messages: string[];
  pageCandidates: IntakePageCandidateV2[];
  successEvidenceCandidates: IntakeSuccessEvidenceCandidateV2[];
  privacy: {
    redactedValueCount: number;
    truncatedCandidateLabelIds: string[];
  };
}

export interface IntakeMeasurementV2 {
  id: string;
  conversionOutcome: string;
  interactionCandidate: ConversationInteraction;
  groundedTargetCandidateIds: string[];
  groundedSuccessEvidenceCandidateIds: string[];
}

export interface IntakeInterpretationV2 {
  schemaVersion: typeof INTAKE_INTERPRETATION_V2_SCHEMA_VERSION;
  statedOutcome: string;
  measurements: IntakeMeasurementV2[];
  ambiguities: IntakeAmbiguityV2[];
  clarification: string | null;
  authority: {
    canConfirmSpecification: false;
    canWriteGtm: false;
    canReportEvidenceVerdict: false;
    canClaimPlatformReceipt: false;
  };
}

export type IntakeAdoptionResult =
  | { status: "accepted"; intake: ConversationIntakeResult }
  | {
      status: "focus_required";
      statedOutcome: string;
      measurementCount: number;
      question: string;
    }
  | { status: "rejected" };

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const INTERACTIONS = new Set<ConversationInteraction>([
  "navigation_click",
  "form_submission",
  "page_view",
  "scroll",
  "site_search",
  "video_engagement",
  "file_download",
  "outbound_click",
  "cta_click",
  "phone_click",
  "email_click",
  "calendly_booking",
  "unknown",
]);
const AMBIGUITIES = new Set<IntakeAmbiguityV2>([
  "interaction",
  "conversion_outcome",
  "target",
  "success_evidence",
  "missing_target",
  "cross_origin_target",
  "unsupported_interaction",
  "multiple_measurements",
  "confirmation_required",
]);
const CANDIDATE_KINDS = new Set<IntakePageCandidateKindV2>([
  "navigation",
  "form",
  "cta",
  "phone",
  "email",
  "outbound_link",
  "file_download",
  "booking",
]);
const INTERACTION_TARGET_KINDS: Partial<Record<
  ConversationInteraction,
  IntakePageCandidateKindV2
>> = {
  navigation_click: "navigation",
  form_submission: "form",
  file_download: "file_download",
  outbound_click: "outbound_link",
  cta_click: "cta",
  phone_click: "phone",
  email_click: "email",
  calendly_booking: "booking",
};
const POSITIONS = new Set(["header", "main", "footer", "modal", "unknown"]);
const EVIDENCE_TYPES = new Set([
  "visible_element",
  "thank_you_url",
  "data_layer_event",
  "same_page_success",
]);
const PRIVATE_VALUE = /(?:[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\+?\d[\d\s().-]{7,}\d)/iu;
const PRIVATE_INPUT_PATTERNS = [
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu,
  /\+?\d[\d\s().-]{7,}\d/gu,
];
const MAXIMUM_CANDIDATES = 50;
const MAXIMUM_EVIDENCE = 100;
const MAXIMUM_MEASUREMENTS = 12;

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
    && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value);
}

function uniqueStrings(value: unknown): value is string[] {
  return Array.isArray(value)
    && value.every((item) => typeof item === "string")
    && new Set(value).size === value.length;
}

function redactText(value: string): { value: string; count: number } {
  let safe = value;
  let count = 0;
  for (const pattern of PRIVATE_INPUT_PATTERNS) {
    safe = safe.replace(pattern, () => {
      count += 1;
      return "[redacted]";
    });
  }
  return { value: safe, count };
}

function safeLabel(
  value: string,
  id: string,
  truncated: string[],
  privacy: { redactedValueCount: number },
): string {
  const redacted = redactText(value);
  privacy.redactedValueCount += redacted.count;
  const normalized = redacted.value
    .replace(/[\u0000-\u001f\u007f]/gu, " ").replace(/\s+/gu, " ").trim()
    || "Unlabelled page candidate";
  if (normalized.length <= 120) {
    return normalized;
  }
  truncated.push(id);
  return normalized.slice(0, 120);
}

function redactMessage(message: string): { message: string; count: number } {
  const redacted = redactText(message.slice(0, 500));
  return { message: redacted.value, count: redacted.count };
}

function addAggregateCandidate(
  candidates: IntakePageCandidateV2[],
  count: number | undefined,
  candidate: IntakePageCandidateV2,
): void {
  if (Number.isSafeInteger(count) && Number(count) > 0 && candidates.length < MAXIMUM_CANDIDATES) {
    candidates.push(candidate);
  }
}

export function createIntakeInterpretationInputV2(
  message: string,
  page: ConversationPageContext,
): IntakeInterpretationInputV2 {
  const redacted = redactMessage(message);
  const privacy = { redactedValueCount: redacted.count };
  const truncatedCandidateLabelIds: string[] = [];
  const pageCandidates: IntakePageCandidateV2[] = [];
  const successEvidenceCandidates: IntakeSuccessEvidenceCandidateV2[] = [];

  for (const [formIndex, form] of page.forms.slice(0, MAXIMUM_CANDIDATES).entries()) {
    const id = `form_${formIndex + 1}`;
    pageCandidates.push({
      id,
      label: safeLabel(form.label, id, truncatedCandidateLabelIds, privacy),
      kind: "form",
      position: "unknown",
      crossOrigin: false,
    });
    for (const [evidenceIndex, evidence] of form.successSignals
      .slice(0, MAXIMUM_EVIDENCE - successEvidenceCandidates.length).entries()) {
      const evidenceId = `${id}_evidence_${evidenceIndex + 1}`;
      successEvidenceCandidates.push({
        id: evidenceId,
        targetId: id,
        label: safeLabel(evidence.label, evidenceId, truncatedCandidateLabelIds, privacy),
        type: evidence.type,
      });
    }
  }

  if (page.navigationCount > 0 && pageCandidates.length < MAXIMUM_CANDIDATES) {
    pageCandidates.push({
      id: "navigation_on_page",
      label: "Navigation links on this page",
      kind: "navigation",
      position: "unknown",
      crossOrigin: false,
    });
  }
  addAggregateCandidate(pageCandidates, page.interactionCounts?.phone_click, {
    id: "phone_on_page",
    label: "Phone links on this page",
    kind: "phone",
    position: "unknown",
    crossOrigin: false,
  });
  addAggregateCandidate(pageCandidates, page.interactionCounts?.email_click, {
    id: "email_on_page",
    label: "Email links on this page",
    kind: "email",
    position: "unknown",
    crossOrigin: false,
  });
  addAggregateCandidate(pageCandidates, page.interactionCounts?.outbound_click, {
    id: "outbound_on_page",
    label: "Outbound links on this page",
    kind: "outbound_link",
    position: "unknown",
    crossOrigin: false,
  });
  addAggregateCandidate(pageCandidates, page.interactionCounts?.file_download, {
    id: "downloads_on_page",
    label: "Downloadable file links on this page",
    kind: "file_download",
    position: "unknown",
    crossOrigin: false,
  });
  addAggregateCandidate(pageCandidates, page.calendlyEmbedCount, {
    id: "booking_on_page",
    label: "Calendly booking embed on this page",
    kind: "booking",
    position: "unknown",
    crossOrigin: true,
  });

  return {
    schemaVersion: INTAKE_INTERPRETATION_V2_SCHEMA_VERSION,
    messages: [redacted.message],
    pageCandidates,
    successEvidenceCandidates,
    privacy: {
      redactedValueCount: privacy.redactedValueCount,
      truncatedCandidateLabelIds,
    },
  };
}

export function validateIntakeInterpretationInputV2(value: unknown): string[] {
  if (!isRecord(value)) {
    return ["input must be an object"];
  }
  const errors = unexpectedKeys(
    value,
    ["schemaVersion", "messages", "pageCandidates", "successEvidenceCandidates", "privacy"],
    "input",
  );
  if (value.schemaVersion !== INTAKE_INTERPRETATION_V2_SCHEMA_VERSION) {
    errors.push("input.schemaVersion must be 2");
  }
  if (!Array.isArray(value.messages)
    || value.messages.length < 1
    || value.messages.length > 8
    || value.messages.some((message) => !validText(message, 500) || PRIVATE_VALUE.test(message))) {
    errors.push("input.messages must contain 1 to 8 privacy-filtered bounded messages");
  }

  const candidates = Array.isArray(value.pageCandidates) ? value.pageCandidates : [];
  if (!Array.isArray(value.pageCandidates) || candidates.length > MAXIMUM_CANDIDATES) {
    errors.push("input.pageCandidates must contain at most 50 candidates");
  }
  const candidateIds: string[] = [];
  candidates.forEach((candidate, index) => {
    if (!isRecord(candidate)) {
      errors.push(`input.pageCandidates[${index}] must be an object`);
      return;
    }
    const path = `input.pageCandidates[${index}]`;
    errors.push(...unexpectedKeys(candidate, ["id", "label", "kind", "position", "crossOrigin"], path));
    if (typeof candidate.id !== "string" || !IDENTIFIER.test(candidate.id)) {
      errors.push(`${path}.id is invalid`);
    } else {
      candidateIds.push(candidate.id);
    }
    if (!validText(candidate.label, 120) || PRIVATE_VALUE.test(String(candidate.label))) {
      errors.push(`${path}.label is invalid`);
    }
    if (!CANDIDATE_KINDS.has(candidate.kind as IntakePageCandidateKindV2)) {
      errors.push(`${path}.kind is invalid`);
    }
    if (!POSITIONS.has(String(candidate.position))) {
      errors.push(`${path}.position is invalid`);
    }
    if (typeof candidate.crossOrigin !== "boolean") {
      errors.push(`${path}.crossOrigin is required`);
    }
  });
  if (new Set(candidateIds).size !== candidateIds.length) {
    errors.push("input.pageCandidates ids must be unique");
  }

  const evidence = Array.isArray(value.successEvidenceCandidates)
    ? value.successEvidenceCandidates
    : [];
  if (!Array.isArray(value.successEvidenceCandidates) || evidence.length > MAXIMUM_EVIDENCE) {
    errors.push("input.successEvidenceCandidates must contain at most 100 candidates");
  }
  const evidenceIds: string[] = [];
  evidence.forEach((candidate, index) => {
    if (!isRecord(candidate)) {
      errors.push(`input.successEvidenceCandidates[${index}] must be an object`);
      return;
    }
    const path = `input.successEvidenceCandidates[${index}]`;
    errors.push(...unexpectedKeys(candidate, ["id", "targetId", "label", "type"], path));
    if (typeof candidate.id !== "string" || !IDENTIFIER.test(candidate.id)) {
      errors.push(`${path}.id is invalid`);
    } else {
      evidenceIds.push(candidate.id);
    }
    if (typeof candidate.targetId !== "string" || !candidateIds.includes(candidate.targetId)) {
      errors.push(`${path}.targetId is not grounded`);
    }
    if (!validText(candidate.label, 120) || PRIVATE_VALUE.test(String(candidate.label))) {
      errors.push(`${path}.label is invalid`);
    }
    if (!EVIDENCE_TYPES.has(String(candidate.type))) {
      errors.push(`${path}.type is invalid`);
    }
  });
  if (new Set(evidenceIds).size !== evidenceIds.length) {
    errors.push("input.successEvidenceCandidates ids must be unique");
  }

  if (!isRecord(value.privacy)) {
    errors.push("input.privacy is required");
  } else {
    errors.push(...unexpectedKeys(
      value.privacy,
      ["redactedValueCount", "truncatedCandidateLabelIds"],
      "input.privacy",
    ));
    if (!Number.isInteger(value.privacy.redactedValueCount)
      || Number(value.privacy.redactedValueCount) < 0) {
      errors.push("input.privacy.redactedValueCount must be a non-negative integer");
    }
    if (!uniqueStrings(value.privacy.truncatedCandidateLabelIds)
      || value.privacy.truncatedCandidateLabelIds.some((id) => !candidateIds.includes(id)
        && !evidenceIds.includes(id))) {
      errors.push("input.privacy.truncatedCandidateLabelIds must reference supplied candidates");
    }
  }

  return [...new Set(errors)];
}

export function assertIntakeInterpretationInputV2(
  value: unknown,
): asserts value is IntakeInterpretationInputV2 {
  const errors = validateIntakeInterpretationInputV2(value);
  if (errors.length > 0) {
    throw new Error(errors.join(" "));
  }
}

export function validateIntakeInterpretationV2(
  input: unknown,
  value: unknown,
): string[] {
  const errors = validateIntakeInterpretationInputV2(input);
  if (!isRecord(input)) {
    return errors;
  }
  if (!isRecord(value)) {
    return [...errors, "interpretation must be an object"];
  }
  errors.push(...unexpectedKeys(
    value,
    ["schemaVersion", "statedOutcome", "measurements", "ambiguities", "clarification", "authority"],
    "interpretation",
  ));
  if (value.schemaVersion !== INTAKE_INTERPRETATION_V2_SCHEMA_VERSION) {
    errors.push("interpretation.schemaVersion must be 2");
  }
  if (!validText(value.statedOutcome, 160)) {
    errors.push("interpretation.statedOutcome is invalid");
  }

  const suppliedTargets = Array.isArray(input.pageCandidates)
    ? input.pageCandidates.flatMap((candidate) => isRecord(candidate) && typeof candidate.id === "string"
      ? [candidate.id]
      : [])
    : [];
  const suppliedTargetKinds = new Map(
    Array.isArray(input.pageCandidates)
      ? input.pageCandidates.flatMap((candidate) => isRecord(candidate)
        && typeof candidate.id === "string"
        && CANDIDATE_KINDS.has(candidate.kind as IntakePageCandidateKindV2)
        ? [[candidate.id, candidate.kind as IntakePageCandidateKindV2] as const]
        : [])
      : [],
  );
  const suppliedEvidence = Array.isArray(input.successEvidenceCandidates)
    ? input.successEvidenceCandidates.filter(isRecord)
    : [];
  const suppliedEvidenceIds = suppliedEvidence.flatMap((candidate) => typeof candidate.id === "string"
    ? [candidate.id]
    : []);
  const measurements = Array.isArray(value.measurements) ? value.measurements : [];
  if (!Array.isArray(value.measurements)
    || measurements.length < 1
    || measurements.length > MAXIMUM_MEASUREMENTS) {
    errors.push("interpretation.measurements must contain 1 to 12 candidates");
  }
  const measurementIds: string[] = [];
  measurements.forEach((measurement, index) => {
    if (!isRecord(measurement)) {
      errors.push(`interpretation.measurements[${index}] must be an object`);
      return;
    }
    const path = `interpretation.measurements[${index}]`;
    errors.push(...unexpectedKeys(measurement, [
      "id",
      "conversionOutcome",
      "interactionCandidate",
      "groundedTargetCandidateIds",
      "groundedSuccessEvidenceCandidateIds",
    ], path));
    if (typeof measurement.id !== "string" || !IDENTIFIER.test(measurement.id)) {
      errors.push(`${path}.id is invalid`);
    } else {
      measurementIds.push(measurement.id);
    }
    if (!validText(measurement.conversionOutcome, 160)) {
      errors.push(`${path}.conversionOutcome is invalid`);
    }
    if (!INTERACTIONS.has(measurement.interactionCandidate as ConversationInteraction)) {
      errors.push(`${path}.interactionCandidate is invalid`);
    }
    if (!uniqueStrings(measurement.groundedTargetCandidateIds)
      || measurement.groundedTargetCandidateIds.some((id) => !suppliedTargets.includes(id))) {
      errors.push(`${path}.groundedTargetCandidateIds must reference supplied candidates`);
    } else {
      const expectedKind = INTERACTION_TARGET_KINDS[
        measurement.interactionCandidate as ConversationInteraction
      ];
      if (expectedKind
        && (measurement.groundedTargetCandidateIds.length === 0
          || measurement.groundedTargetCandidateIds.some(
            (id) => suppliedTargetKinds.get(id) !== expectedKind,
          ))) {
        errors.push(`${path}.groundedTargetCandidateIds must match the interaction candidate`);
      }
    }
    if (!uniqueStrings(measurement.groundedSuccessEvidenceCandidateIds)
      || measurement.groundedSuccessEvidenceCandidateIds.some((id) => !suppliedEvidenceIds.includes(id))) {
      errors.push(`${path}.groundedSuccessEvidenceCandidateIds must reference supplied candidates`);
    } else if (uniqueStrings(measurement.groundedTargetCandidateIds)) {
      for (const evidenceId of measurement.groundedSuccessEvidenceCandidateIds) {
        const evidence = suppliedEvidence.find((candidate) => candidate.id === evidenceId);
        if (typeof evidence?.targetId !== "string"
          || !measurement.groundedTargetCandidateIds.includes(evidence.targetId)) {
          errors.push(`${path} success evidence must belong to a grounded target`);
        }
      }
    }
  });
  if (new Set(measurementIds).size !== measurementIds.length) {
    errors.push("interpretation measurement ids must be unique");
  }

  if (!uniqueStrings(value.ambiguities)
    || value.ambiguities.some((ambiguity) => !AMBIGUITIES.has(ambiguity as IntakeAmbiguityV2))) {
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
    errors.push(...unexpectedKeys(value.authority, [
      "canConfirmSpecification",
      "canWriteGtm",
      "canReportEvidenceVerdict",
      "canClaimPlatformReceipt",
    ], "interpretation.authority"));
    for (const key of [
      "canConfirmSpecification",
      "canWriteGtm",
      "canReportEvidenceVerdict",
      "canClaimPlatformReceipt",
    ] as const) {
      if (value.authority[key] !== false) {
        errors.push(`interpretation.authority.${key} must be false`);
      }
    }
  }

  if (PRIVATE_VALUE.test(JSON.stringify(value))) {
    errors.push("interpretation contains a redacted private value");
  }

  return [...new Set(errors)];
}

export function assertIntakeInterpretationV2(
  input: IntakeInterpretationInputV2,
  value: unknown,
): asserts value is IntakeInterpretationV2 {
  const errors = validateIntakeInterpretationV2(input, value);
  if (errors.length > 0) {
    throw new Error(errors.join(" "));
  }
}

const CANONICAL_INTENTS: Partial<Record<ConversationInteraction, string>> = {
  navigation_click: "Track navigation links",
  form_submission: "Track form submissions as leads",
  page_view: "Track page views",
  scroll: "Track scrolling",
  site_search: "Track site search",
  video_engagement: "Track video engagement",
  file_download: "Track downloads",
  outbound_click: "Track outbound links",
  phone_click: "Track phone calls",
  email_click: "Track email links",
  calendly_booking: "Track Calendly bookings",
};

function formIndex(candidateId: string): number | undefined {
  const match = /^form_(\d+)$/u.exec(candidateId);
  if (!match) {
    return undefined;
  }
  const index = Number(match[1]) - 1;
  return Number.isSafeInteger(index) && index >= 0 ? index : undefined;
}

function evidenceIndex(candidateId: string, targetId: string): number | undefined {
  const match = new RegExp(`^${targetId}_evidence_(\\d+)$`, "u").exec(candidateId);
  if (!match) {
    return undefined;
  }
  const index = Number(match[1]) - 1;
  return Number.isSafeInteger(index) && index >= 0 ? index : undefined;
}

function focusResult(interpretation: IntakeInterpretationV2): IntakeAdoptionResult {
  const count = interpretation.measurements.length;
  const question = interpretation.clarification
    ?? (count > 1
      ? `I found ${count} measurable activities. Which one should we start with?`
      : `What observable visitor action should represent ${interpretation.statedOutcome}?`);
  return {
    status: "focus_required",
    statedOutcome: interpretation.statedOutcome,
    measurementCount: count,
    question,
  };
}

export function adoptIntakeInterpretation(
  input: IntakeInterpretationInputV2,
  interpretation: unknown,
  page: ConversationPageContext,
): IntakeAdoptionResult {
  if (validateIntakeInterpretationV2(input, interpretation).length > 0
    || !isRecord(interpretation)) {
    return { status: "rejected" };
  }
  const safe = interpretation as unknown as IntakeInterpretationV2;
  if (safe.measurements.length !== 1 || safe.ambiguities.length > 0) {
    return focusResult(safe);
  }

  const measurement = safe.measurements[0]!;
  const canonical = CANONICAL_INTENTS[measurement.interactionCandidate];
  const expectedKind = INTERACTION_TARGET_KINDS[measurement.interactionCandidate];
  if (!canonical || !expectedKind || measurement.groundedTargetCandidateIds.length !== 1) {
    return focusResult(safe);
  }
  if (measurement.interactionCandidate === "form_submission") {
    if (measurement.groundedTargetCandidateIds.length !== 1
      || measurement.groundedSuccessEvidenceCandidateIds.length !== 1) {
      return focusResult(safe);
    }
    const targetAlias = measurement.groundedTargetCandidateIds[0]!;
    const targetPosition = formIndex(targetAlias);
    const target = targetPosition === undefined ? undefined : page.forms[targetPosition];
    const successPosition = evidenceIndex(
      measurement.groundedSuccessEvidenceCandidateIds[0]!,
      targetAlias,
    );
    const success = target && successPosition !== undefined
      ? target.successSignals[successPosition]
      : undefined;
    if (!target || !success) {
      return { status: "rejected" };
    }
    const initial = interpretConversationIntent(canonical, page);
    return {
      status: "accepted",
      intake: selectConversationSuccess(initial, target, success),
    };
  }

  const intake = interpretConversationIntent(canonical, page);
  if (intake.interaction !== measurement.interactionCandidate
    || intake.state === "awaiting_interaction"
    || intake.state === "unsupported"
    || intake.state === "insufficient_evidence") {
    return focusResult(safe);
  }
  return { status: "accepted", intake };
}
