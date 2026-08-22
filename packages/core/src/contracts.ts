import type { NavigationElement } from "./types.js";

export const TRACKING_SCHEMA_VERSION = 1 as const;

export type InteractionType = "navigation_click" | "form_submission";
export type ConversionOutcomeType = "navigation" | "qualified_inquiry";
export type AnalyticsEventName = "navigation_click" | "generate_lead";
export type TrackingSpecificationStatus = "draft" | "confirmed";

export type SuccessEvidence =
  | { type: "visible_element"; selector: string }
  | { type: "thank_you_url"; urlPattern: string }
  | { type: "data_layer_event"; eventName: string }
  | { type: "same_page_success"; signal: string };

export interface TrackingSpecificationV1 {
  schemaVersion: typeof TRACKING_SCHEMA_VERSION;
  id: string;
  status: TrackingSpecificationStatus;
  originalIntent: string;
  interaction: { type: InteractionType };
  conversionOutcome: {
    type: ConversionOutcomeType;
    practitionerConfirmed: boolean;
  };
  event: {
    name: AnalyticsEventName;
    requiredParameters: string[];
    optionalParameters: string[];
  };
  targets: Array<{
    id: string;
    label: string;
    selector: string;
    pageUrl: string;
    href?: string;
  }>;
  successEvidence: SuccessEvidence[];
}

export type ScenarioVerdictCode =
  | "expected_non_conversion"
  | "browser_verified"
  | "outcome_observed_event_missing"
  | "datalayer_event_observed_tag_not_firing"
  | "tag_fired_request_missing"
  | "missing_parameter"
  | "duplicate_fire"
  | "consent_limited"
  | "submission_failed"
  | "insufficient_observable_evidence";

export interface TrackingScenarioV1 {
  schemaVersion: typeof TRACKING_SCHEMA_VERSION;
  id: string;
  specificationFixture: string;
  siteFixture: string;
  environment: {
    submissionResult: "success" | "validation_error" | "server_error";
    transport: "native" | "redirect" | "ajax" | "spa";
    consent: "granted" | "denied" | "unknown";
    trackingState:
      | "correct"
      | "event_missing"
      | "tag_not_firing"
      | "request_missing"
      | "missing_parameter"
      | "duplicate_fire";
  };
  journey: Array<Record<string, unknown>>;
  expectedVerdict: ScenarioVerdictCode;
}

export interface TrackingRunEvidenceV1 {
  schemaVersion: typeof TRACKING_SCHEMA_VERSION;
  runId: string;
  specificationId: string;
  startedAt: string;
  observations: {
    interaction: {
      type: InteractionType;
      targetId: string;
      attempted: boolean;
    };
    outcome: {
      observed: boolean;
      evidenceType?: SuccessEvidence["type"] | "navigation_click";
    };
    dataLayer: { matchingEvents: unknown[] };
    network: { ga4Requests: Array<{ url: string; observedAt: string }> };
    consent: { analyticsStorage: "granted" | "denied" | "unknown" };
  };
  verdict: {
    code: ScenarioVerdictCode;
    browserVerification: "passed" | "failed" | "inconclusive";
    platformConfirmation: "unverified";
  };
}

const PARAMETER_NAME = /^[a-z][a-z0-9_]{0,39}$/;
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validHttpUrl(value: unknown): boolean {
  if (typeof value !== "string") return false;
  try {
    return /^https?:$/.test(new URL(value).protocol);
  } catch {
    return false;
  }
}

export function validateTrackingSpecification(value: unknown): string[] {
  if (!isRecord(value)) return ["tracking specification must be an object"];
  const errors: string[] = [];
  if (value.schemaVersion !== TRACKING_SCHEMA_VERSION) errors.push("schemaVersion must be 1");
  if (typeof value.id !== "string" || !IDENTIFIER.test(value.id)) errors.push("id is invalid");
  if (value.status !== "draft" && value.status !== "confirmed") errors.push("status is invalid");
  if (typeof value.originalIntent !== "string" || value.originalIntent.trim().length === 0) errors.push("originalIntent is required");

  const interaction = isRecord(value.interaction) ? value.interaction.type : undefined;
  const outcome = isRecord(value.conversionOutcome) ? value.conversionOutcome : undefined;
  const event = isRecord(value.event) ? value.event : undefined;
  if (interaction !== "navigation_click" && interaction !== "form_submission") errors.push("interaction.type is unsupported");
  if (!outcome || (outcome.type !== "navigation" && outcome.type !== "qualified_inquiry")) errors.push("conversionOutcome.type is unsupported");
  if (!outcome || typeof outcome.practitionerConfirmed !== "boolean") errors.push("conversionOutcome.practitionerConfirmed is required");
  if (!event || (event.name !== "navigation_click" && event.name !== "generate_lead")) errors.push("event.name is unsupported");

  const expectedCombination = interaction === "navigation_click"
    ? outcome?.type === "navigation" && event?.name === "navigation_click"
    : interaction === "form_submission"
      ? outcome?.type === "qualified_inquiry" && event?.name === "generate_lead"
      : false;
  if (!expectedCombination) errors.push("interaction, conversion outcome, and event are incompatible");

  for (const key of ["requiredParameters", "optionalParameters"] as const) {
    const parameters = event?.[key];
    if (!Array.isArray(parameters) || parameters.some((item) => typeof item !== "string" || !PARAMETER_NAME.test(item))) {
      errors.push(`event.${key} contains an invalid parameter name`);
    }
  }

  if (!Array.isArray(value.targets) || value.targets.length === 0) {
    errors.push("at least one target is required");
  } else {
    value.targets.forEach((target, index) => {
      if (!isRecord(target)) {
        errors.push(`targets[${index}] is invalid`);
        return;
      }
      if (typeof target.id !== "string" || !IDENTIFIER.test(target.id)) errors.push(`targets[${index}].id is invalid`);
      if (typeof target.label !== "string" || target.label.trim().length === 0) errors.push(`targets[${index}].label is required`);
      if (typeof target.selector !== "string" || target.selector.trim().length === 0 || target.selector.length > 512) errors.push(`targets[${index}].selector is invalid`);
      if (!validHttpUrl(target.pageUrl)) errors.push(`targets[${index}].pageUrl is invalid`);
      if (target.href !== undefined && !validHttpUrl(target.href)) errors.push(`targets[${index}].href is invalid`);
    });
  }

  if (!Array.isArray(value.successEvidence)) {
    errors.push("successEvidence must be an array");
  } else if (interaction === "form_submission" && value.successEvidence.length === 0) {
    errors.push("form submissions require success evidence");
  } else {
    value.successEvidence.forEach((evidence, index) => {
      if (!isRecord(evidence)) {
        errors.push(`successEvidence[${index}] is invalid`);
        return;
      }
      const property = evidence.type === "visible_element" ? "selector"
        : evidence.type === "thank_you_url" ? "urlPattern"
          : evidence.type === "data_layer_event" ? "eventName"
            : evidence.type === "same_page_success" ? "signal"
              : undefined;
      if (!property || typeof evidence[property] !== "string" || evidence[property].trim().length === 0) {
        errors.push(`successEvidence[${index}] is invalid`);
      }
    });
  }
  if (value.status === "confirmed" && outcome?.practitionerConfirmed !== true) {
    errors.push("confirmed specifications require practitioner confirmation");
  }
  return [...new Set(errors)];
}

export function assertTrackingSpecification(value: unknown): asserts value is TrackingSpecificationV1 {
  const errors = validateTrackingSpecification(value);
  if (errors.length > 0) throw new Error(errors.join(" "));
}

const VERDICT_CODES = new Set<ScenarioVerdictCode>([
  "expected_non_conversion",
  "browser_verified",
  "outcome_observed_event_missing",
  "datalayer_event_observed_tag_not_firing",
  "tag_fired_request_missing",
  "missing_parameter",
  "duplicate_fire",
  "consent_limited",
  "submission_failed",
  "insufficient_observable_evidence",
]);

export function validateTrackingScenario(value: unknown): string[] {
  if (!isRecord(value)) return ["tracking scenario must be an object"];
  const errors: string[] = [];
  if (value.schemaVersion !== TRACKING_SCHEMA_VERSION) errors.push("schemaVersion must be 1");
  for (const key of ["id", "specificationFixture", "siteFixture"] as const) {
    if (typeof value[key] !== "string" || value[key].trim().length === 0) errors.push(`${key} is required`);
  }
  if (!isRecord(value.environment)) errors.push("environment is required");
  if (!Array.isArray(value.journey) || value.journey.length === 0 || value.journey.some((step) => !isRecord(step))) errors.push("journey must contain object steps");
  if (typeof value.expectedVerdict !== "string" || !VERDICT_CODES.has(value.expectedVerdict as ScenarioVerdictCode)) errors.push("expectedVerdict is unsupported");
  return errors;
}

export function assertTrackingScenario(value: unknown): asserts value is TrackingScenarioV1 {
  const errors = validateTrackingScenario(value);
  if (errors.length > 0) throw new Error(errors.join(" "));
}

export function validateTrackingRunEvidence(value: unknown): string[] {
  if (!isRecord(value)) return ["run evidence must be an object"];
  const errors: string[] = [];
  if (value.schemaVersion !== TRACKING_SCHEMA_VERSION) errors.push("schemaVersion must be 1");
  if (typeof value.runId !== "string" || !IDENTIFIER.test(value.runId)) errors.push("runId is invalid");
  if (typeof value.specificationId !== "string" || !IDENTIFIER.test(value.specificationId)) errors.push("specificationId is invalid");
  if (typeof value.startedAt !== "string" || Number.isNaN(Date.parse(value.startedAt))) errors.push("startedAt must be an ISO date");
  if (!isRecord(value.observations)) errors.push("observations are required");
  const verdict = isRecord(value.verdict) ? value.verdict : undefined;
  if (!verdict || typeof verdict.code !== "string" || !VERDICT_CODES.has(verdict.code as ScenarioVerdictCode)) errors.push("verdict.code is unsupported");
  if (!verdict || !["passed", "failed", "inconclusive"].includes(String(verdict.browserVerification))) errors.push("verdict.browserVerification is invalid");
  if (!verdict || verdict.platformConfirmation !== "unverified") errors.push("verdict.platformConfirmation must be unverified");
  return errors;
}

export function assertTrackingRunEvidence(value: unknown): asserts value is TrackingRunEvidenceV1 {
  const errors = validateTrackingRunEvidence(value);
  if (errors.length > 0) throw new Error(errors.join(" "));
}

export function navigationSpecification(
  id: string,
  intent: string,
  pageUrl: string,
  navigation: NavigationElement[],
): TrackingSpecificationV1 {
  const specification: TrackingSpecificationV1 = {
    schemaVersion: TRACKING_SCHEMA_VERSION,
    id,
    status: "confirmed",
    originalIntent: intent,
    interaction: { type: "navigation_click" },
    conversionOutcome: { type: "navigation", practitionerConfirmed: true },
    event: {
      name: "navigation_click",
      requiredParameters: ["link_text", "link_url"],
      optionalParameters: ["page_location"],
    },
    targets: navigation.map((item) => ({
      id: item.id,
      label: item.text,
      selector: item.selector,
      pageUrl,
      href: item.href,
    })),
    successEvidence: [],
  };
  assertTrackingSpecification(specification);
  return specification;
}
