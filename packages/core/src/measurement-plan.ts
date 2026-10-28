import { agentTurnForIntake, type AgentTurnContext } from "./agent-turn.js";
import type {
  ConversationIntakeResult,
  ConversationInteraction,
  ConversationPageContext,
} from "./conversation.js";
import {
  adoptIntakeInterpretation,
  validateIntakeInterpretationV2,
  type IntakeInterpretationInputV2,
  type IntakeInterpretationV2,
} from "./intake-interpretation-v2.js";
import { knownInteractionDefinition } from "./interaction-authoring.js";

export const MEASUREMENT_PLAN_SCHEMA_VERSION = 1 as const;

export type MeasurementPlanItemStatus =
  | "ready"
  | "already_covered"
  | "needs_clarification"
  | "unsupported";

export interface MeasurementPlanItemV1 {
  id: string;
  conversionOutcome: string;
  interaction: ConversationInteraction;
  targetLabels: string[];
  successEvidenceLabels: string[];
  status: MeasurementPlanItemStatus;
  summary: string;
  action: "start" | "none";
}

export interface MeasurementPlanV1 {
  schemaVersion: typeof MEASUREMENT_PLAN_SCHEMA_VERSION;
  statedOutcome: string;
  recommendedItemId: string | null;
  items: MeasurementPlanItemV1[];
  authority: {
    canConfirmSpecification: false;
    canWriteGtm: false;
    canReportEvidenceVerdict: false;
    canClaimPlatformReceipt: false;
  };
}

export interface MeasurementPlanCreation {
  plan: MeasurementPlanV1;
  selections: ReadonlyMap<string, ConversationIntakeResult>;
}

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const PRIVATE_VALUE = /(?:[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\+?\d[\d\s().-]{7,}\d)/iu;
const ITEM_STATUSES = new Set<MeasurementPlanItemStatus>([
  "ready",
  "already_covered",
  "needs_clarification",
  "unsupported",
]);
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function boundedText(value: unknown, maximum: number): value is string {
  return typeof value === "string"
    && value.trim().length > 0
    && value.length <= maximum
    && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value);
}

function uniqueStrings(value: unknown, maximum: number): value is string[] {
  return Array.isArray(value)
    && value.length <= maximum
    && value.every((item) => boundedText(item, 120))
    && new Set(value).size === value.length;
}

function unexpectedKeys(value: Record<string, unknown>, allowed: string[], path: string): string[] {
  const allowlist = new Set(allowed);
  return Object.keys(value)
    .filter((key) => !allowlist.has(key))
    .map((key) => `${path}.${key} is not allowed`);
}

export function validateMeasurementPlanV1(value: unknown): string[] {
  if (!isRecord(value)) {
    return ["plan must be an object"];
  }
  const errors = unexpectedKeys(
    value,
    ["schemaVersion", "statedOutcome", "recommendedItemId", "items", "authority"],
    "plan",
  );
  if (value.schemaVersion !== MEASUREMENT_PLAN_SCHEMA_VERSION) {
    errors.push("plan.schemaVersion must be 1");
  }
  if (!boundedText(value.statedOutcome, 160)) {
    errors.push("plan.statedOutcome is invalid");
  }

  const items = Array.isArray(value.items) ? value.items : [];
  if (!Array.isArray(value.items) || items.length < 2 || items.length > 12) {
    errors.push("plan.items must contain 2 to 12 items");
  }
  const itemIds: string[] = [];
  const startableIds: string[] = [];
  items.forEach((item, index) => {
    if (!isRecord(item)) {
      errors.push(`plan.items[${index}] must be an object`);
      return;
    }
    const path = `plan.items[${index}]`;
    errors.push(...unexpectedKeys(item, [
      "id",
      "conversionOutcome",
      "interaction",
      "targetLabels",
      "successEvidenceLabels",
      "status",
      "summary",
      "action",
    ], path));
    if (typeof item.id !== "string" || !IDENTIFIER.test(item.id)) {
      errors.push(`${path}.id is invalid`);
    } else {
      itemIds.push(item.id);
    }
    if (!boundedText(item.conversionOutcome, 160)) {
      errors.push(`${path}.conversionOutcome is invalid`);
    }
    if (!INTERACTIONS.has(item.interaction as ConversationInteraction)) {
      errors.push(`${path}.interaction is invalid`);
    }
    if (!uniqueStrings(item.targetLabels, 12)) {
      errors.push(`${path}.targetLabels is invalid`);
    }
    if (!uniqueStrings(item.successEvidenceLabels, 12)) {
      errors.push(`${path}.successEvidenceLabels is invalid`);
    }
    if (!ITEM_STATUSES.has(item.status as MeasurementPlanItemStatus)) {
      errors.push(`${path}.status is invalid`);
    }
    if (!boundedText(item.summary, 500)) {
      errors.push(`${path}.summary is invalid`);
    }
    const startable = item.status === "ready" || item.status === "already_covered";
    if (item.action !== (startable ? "start" : "none")) {
      errors.push(`${path}.action does not match its status`);
    }
    if (startable && typeof item.id === "string") {
      startableIds.push(item.id);
    }
  });
  if (new Set(itemIds).size !== itemIds.length) {
    errors.push("plan item ids must be unique");
  }
  if (value.recommendedItemId !== null
    && (typeof value.recommendedItemId !== "string"
      || !startableIds.includes(value.recommendedItemId))) {
    errors.push("plan.recommendedItemId must reference a startable item");
  }
  if (startableIds.length > 0 && value.recommendedItemId === null) {
    errors.push("plan.recommendedItemId is required when an item is startable");
  }

  if (!isRecord(value.authority)) {
    errors.push("plan.authority is required");
  } else {
    const authorityKeys = [
      "canConfirmSpecification",
      "canWriteGtm",
      "canReportEvidenceVerdict",
      "canClaimPlatformReceipt",
    ];
    errors.push(...unexpectedKeys(value.authority, authorityKeys, "plan.authority"));
    for (const key of authorityKeys) {
      if (value.authority[key] !== false) {
        errors.push(`plan.authority.${key} must be false`);
      }
    }
  }

  if (PRIVATE_VALUE.test(JSON.stringify(value))) {
    errors.push("plan contains a redacted private value");
  }
  return [...new Set(errors)];
}

export function isMeasurementPlanV1(value: unknown): value is MeasurementPlanV1 {
  return validateMeasurementPlanV1(value).length === 0;
}

function labelsFor(
  ids: string[],
  candidates: Array<{ id: string; label: string }>,
): string[] {
  return ids.flatMap((id) => {
    const candidate = candidates.find((item) => item.id === id);
    return candidate ? [candidate.label] : [];
  });
}

function planItem(
  input: IntakeInterpretationInputV2,
  interpretation: IntakeInterpretationV2,
  measurement: IntakeInterpretationV2["measurements"][number],
  page: ConversationPageContext,
  context: AgentTurnContext,
): { item: MeasurementPlanItemV1; intake?: ConversationIntakeResult } {
  const targetLabels = labelsFor(measurement.groundedTargetCandidateIds, input.pageCandidates);
  const successEvidenceLabels = labelsFor(
    measurement.groundedSuccessEvidenceCandidateIds,
    input.successEvidenceCandidates,
  );
  if (measurement.interactionCandidate === "unknown") {
    return {
      item: {
        id: measurement.id,
        conversionOutcome: measurement.conversionOutcome,
        interaction: measurement.interactionCandidate,
        targetLabels,
        successEvidenceLabels,
        status: "unsupported",
        summary: "The requested activity does not match a supported observable interaction.",
        action: "none",
      },
    };
  }

  const remainingAmbiguities = interpretation.ambiguities.filter(
    (ambiguity) => ambiguity !== "multiple_measurements",
  );
  if (remainingAmbiguities.length > 0) {
    return {
      item: {
        id: measurement.id,
        conversionOutcome: measurement.conversionOutcome,
        interaction: measurement.interactionCandidate,
        targetLabels,
        successEvidenceLabels,
        status: "needs_clarification",
        summary: interpretation.clarification ?? "This activity needs one clarification before it can start.",
        action: "none",
      },
    };
  }

  const single: IntakeInterpretationV2 = {
    ...interpretation,
    measurements: [measurement],
    ambiguities: [],
    clarification: null,
  };
  const adoption = adoptIntakeInterpretation(input, single, page);
  if (adoption.status !== "accepted") {
    return {
      item: {
        id: measurement.id,
        conversionOutcome: measurement.conversionOutcome,
        interaction: measurement.interactionCandidate,
        targetLabels,
        successEvidenceLabels,
        status: "needs_clarification",
        summary: adoption.status === "focus_required"
          ? adoption.question
          : "This activity cannot be grounded safely on the current page.",
        action: "none",
      },
    };
  }

  const turn = agentTurnForIntake(adoption.intake, context);
  const alreadyCovered = turn.task.status === "completed"
    && turn.task.goal.startsWith("Already covered");
  const unsupported = turn.task.status === "blocked" || turn.task.status === "unsupported";
  const status: MeasurementPlanItemStatus = alreadyCovered
    ? "already_covered"
    : unsupported ? "unsupported" : "ready";
  return {
    item: {
      id: measurement.id,
      conversionOutcome: measurement.conversionOutcome,
      interaction: measurement.interactionCandidate,
      targetLabels,
      successEvidenceLabels,
      status,
      summary: turn.task.summary,
      action: status === "ready" || status === "already_covered" ? "start" : "none",
    },
    ...(status === "ready" || status === "already_covered" ? { intake: adoption.intake } : {}),
  };
}

export function createMeasurementPlan(
  input: IntakeInterpretationInputV2,
  interpretation: unknown,
  page: ConversationPageContext,
  context: AgentTurnContext,
): MeasurementPlanCreation | undefined {
  if (validateIntakeInterpretationV2(input, interpretation).length > 0) {
    return undefined;
  }
  const safe = interpretation as IntakeInterpretationV2;
  if (safe.measurements.length < 2) {
    return undefined;
  }

  const selections = new Map<string, ConversationIntakeResult>();
  const items = safe.measurements.map((measurement) => {
    const result = planItem(input, safe, measurement, page, context);
    if (result.intake) {
      selections.set(measurement.id, result.intake);
    }
    return result.item;
  });
  const recommendedItemId = items.find((item) => item.status === "ready")?.id
    ?? items.find((item) => item.status === "already_covered")?.id
    ?? null;
  const plan: MeasurementPlanV1 = {
    schemaVersion: MEASUREMENT_PLAN_SCHEMA_VERSION,
    statedOutcome: safe.statedOutcome,
    recommendedItemId,
    items,
    authority: {
      canConfirmSpecification: false,
      canWriteGtm: false,
      canReportEvidenceVerdict: false,
      canClaimPlatformReceipt: false,
    },
  };
  return validateMeasurementPlanV1(plan).length === 0 ? { plan, selections } : undefined;
}

export function selectMeasurementPlanItem(
  creation: MeasurementPlanCreation,
  itemId: string,
  currentPage: ConversationPageContext,
): ConversationIntakeResult | undefined {
  const intake = creation.selections.get(itemId);
  if (!intake || validateMeasurementPlanV1(creation.plan).length > 0) {
    return undefined;
  }
  if (intake.interaction === "form_submission") {
    const target = intake.target;
    const success = intake.successSignal;
    const current = target
      ? currentPage.forms.find((form) => form.id === target.id
        && form.label === target.label
        && form.selector === target.selector
        && form.pageUrl === target.pageUrl)
      : undefined;
    const exactSuccess = current && success
      ? current.successSignals.some((signal) => signal.id === success.id
        && signal.label === success.label
        && signal.type === success.type
        && signal.value === success.value)
      : false;
    return current && exactSuccess ? structuredClone(intake) : undefined;
  }
  if (intake.interaction === "navigation_click") {
    return currentPage.navigationCount > 0 ? structuredClone(intake) : undefined;
  }
  if (intake.interaction === "calendly_booking") {
    return currentPage.calendlyEmbedCount === 1 ? structuredClone(intake) : undefined;
  }
  const known = knownInteractionDefinition(intake.interaction);
  const count = known ? currentPage.interactionCounts?.[known.interaction] : undefined;
  return Number.isSafeInteger(count) && Number(count) > 0
    ? structuredClone(intake)
    : undefined;
}
