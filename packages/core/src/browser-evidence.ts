import type { ScenarioVerdictCode, TrackingRunEvidenceV1 } from "./contracts.js";

export const BROWSER_EVIDENCE_SCHEMA_VERSION = 1 as const;

export type BrowserEvidenceInteractionV1 = TrackingRunEvidenceV1["observations"]["interaction"]["type"];
export type BrowserOutcomeEvidenceTypeV1 = NonNullable<TrackingRunEvidenceV1["observations"]["outcome"]["evidenceType"]>;
export type BrowserNegativeExpectationV1 = "matching_page_error";

export interface BrowserEvidenceContractV1 {
  schemaVersion: typeof BROWSER_EVIDENCE_SCHEMA_VERSION;
  id: string;
  interaction: BrowserEvidenceInteractionV1;
  outcome: {
    required: boolean;
    allowedEvidenceTypes: BrowserOutcomeEvidenceTypeV1[];
    whenAbsent: "expected_non_conversion" | "insufficient_observable_evidence";
  };
  request: {
    destination: "ga4";
    eventName: string;
    requiredParameters: string[];
  };
  permittedAutomaticEvents: string[];
  duplicatePolicy: { minimum: number; maximum: number };
  dataLayerEvent: string | null;
  tagActionId: string;
  negativeExpectations: BrowserNegativeExpectationV1[];
}

export interface BrowserEvidenceObservationsV1 {
  attempted: boolean;
  result: "success" | "validation_error" | "server_error" | "unknown";
  outcomeObserved: boolean;
  outcomeObservable: boolean;
  outcomeEvidenceType?: BrowserOutcomeEvidenceTypeV1;
  consent: "granted" | "denied" | "unknown";
  dataLayerEvents: string[];
  tagFired: boolean | null;
  requests: Array<{
    destination: "ga4";
    eventName: string;
    parameters: string[];
  }>;
  negativeExpectations: BrowserNegativeExpectationV1[];
}

const EVENT_NAME = /^[a-z][a-z0-9_]{0,39}$/;
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const INTERACTIONS = new Set<BrowserEvidenceInteractionV1>([
  "navigation_click",
  "form_submission",
  "phone_click",
  "email_click",
  "outbound_click",
  "file_download",
]);
const OUTCOMES = new Set<BrowserOutcomeEvidenceTypeV1>([
  "visible_element",
  "thank_you_url",
  "data_layer_event",
  "same_page_success",
  "navigation_click",
  "phone_click",
  "email_click",
  "outbound_click",
  "file_download",
]);

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function eventNames(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string" && EVENT_NAME.test(item));
}

export function validateBrowserEvidenceContract(value: unknown, path = "browserEvidence"): string[] {
  if (!record(value)) return [`${path} is invalid`];
  const errors: string[] = [];
  if (value.schemaVersion !== BROWSER_EVIDENCE_SCHEMA_VERSION) errors.push(`${path}.schemaVersion must be 1`);
  if (typeof value.id !== "string" || !IDENTIFIER.test(value.id)) errors.push(`${path}.id is invalid`);
  if (typeof value.interaction !== "string" || !INTERACTIONS.has(value.interaction as BrowserEvidenceInteractionV1)) {
    errors.push(`${path}.interaction is unsupported`);
  }
  if (!record(value.outcome)) {
    errors.push(`${path}.outcome is required`);
  } else {
    if (typeof value.outcome.required !== "boolean") errors.push(`${path}.outcome.required is invalid`);
    if (value.outcome.whenAbsent !== "expected_non_conversion"
      && value.outcome.whenAbsent !== "insufficient_observable_evidence") {
      errors.push(`${path}.outcome.whenAbsent is invalid`);
    }
    if (!Array.isArray(value.outcome.allowedEvidenceTypes)
      || value.outcome.allowedEvidenceTypes.length === 0
      || value.outcome.allowedEvidenceTypes.some((item) => typeof item !== "string" || !OUTCOMES.has(item as BrowserOutcomeEvidenceTypeV1))) {
      errors.push(`${path}.outcome.allowedEvidenceTypes is invalid`);
    }
  }
  if (!record(value.request)) {
    errors.push(`${path}.request is required`);
  } else {
    if (value.request.destination !== "ga4") errors.push(`${path}.request.destination must be ga4`);
    if (typeof value.request.eventName !== "string" || !EVENT_NAME.test(value.request.eventName)) {
      errors.push(`${path}.request.eventName is invalid`);
    }
    if (!eventNames(value.request.requiredParameters)) errors.push(`${path}.request.requiredParameters is invalid`);
  }
  if (!eventNames(value.permittedAutomaticEvents)) errors.push(`${path}.permittedAutomaticEvents is invalid`);
  if (record(value.request) && typeof value.request.eventName === "string"
    && Array.isArray(value.permittedAutomaticEvents) && value.permittedAutomaticEvents.includes(value.request.eventName)) {
    errors.push(`${path}.permittedAutomaticEvents cannot include the required event`);
  }
  if (!record(value.duplicatePolicy)
    || !Number.isInteger(value.duplicatePolicy.minimum)
    || !Number.isInteger(value.duplicatePolicy.maximum)
    || Number(value.duplicatePolicy.minimum) < 1
    || Number(value.duplicatePolicy.maximum) < Number(value.duplicatePolicy.minimum)) {
    errors.push(`${path}.duplicatePolicy is invalid`);
  }
  if (value.dataLayerEvent !== null
    && (typeof value.dataLayerEvent !== "string" || !EVENT_NAME.test(value.dataLayerEvent))) {
    errors.push(`${path}.dataLayerEvent is invalid`);
  }
  if (typeof value.tagActionId !== "string" || !IDENTIFIER.test(value.tagActionId)) {
    errors.push(`${path}.tagActionId is invalid`);
  }
  if (!Array.isArray(value.negativeExpectations)
    || value.negativeExpectations.some((item) => item !== "matching_page_error")) {
    errors.push(`${path}.negativeExpectations is invalid`);
  }
  return [...new Set(errors)];
}

export function assertBrowserEvidenceContract(value: unknown): asserts value is BrowserEvidenceContractV1 {
  const errors = validateBrowserEvidenceContract(value);
  if (errors.length > 0) throw new Error(errors.join(" "));
}

export function createBrowserEvidenceContract(input: Omit<BrowserEvidenceContractV1, "schemaVersion">): BrowserEvidenceContractV1 {
  const contract: BrowserEvidenceContractV1 = { schemaVersion: BROWSER_EVIDENCE_SCHEMA_VERSION, ...input };
  assertBrowserEvidenceContract(contract);
  return contract;
}

export function leadFormBrowserEvidenceContract(): BrowserEvidenceContractV1 {
  return createBrowserEvidenceContract({
    id: "lead-form",
    interaction: "form_submission",
    outcome: {
      required: true,
      allowedEvidenceTypes: ["visible_element", "thank_you_url", "data_layer_event", "same_page_success"],
      whenAbsent: "expected_non_conversion",
    },
    request: {
      destination: "ga4",
      eventName: "generate_lead",
      requiredParameters: ["form_id", "form_name", "page_location"],
    },
    permittedAutomaticEvents: ["form_start", "page_view", "session_start"],
    duplicatePolicy: { minimum: 1, maximum: 1 },
    dataLayerEvent: "generate_lead",
    tagActionId: "tag_generate_lead",
    negativeExpectations: ["matching_page_error"],
  });
}

export function interactionBrowserEvidenceContract(
  interaction: Exclude<BrowserEvidenceInteractionV1, "form_submission">,
  requiredParameters: string[] = [],
): BrowserEvidenceContractV1 {
  return createBrowserEvidenceContract({
    id: interaction === "file_download" ? "download" : interaction === "phone_click" ? "phone-click" : interaction,
    interaction,
    outcome: {
      required: true,
      allowedEvidenceTypes: [interaction],
      whenAbsent: "insufficient_observable_evidence",
    },
    request: { destination: "ga4", eventName: interaction, requiredParameters },
    permittedAutomaticEvents: ["page_view", "session_start"],
    duplicatePolicy: { minimum: 1, maximum: 1 },
    dataLayerEvent: null,
    tagActionId: `tag_${interaction}`,
    negativeExpectations: ["matching_page_error"],
  });
}

const fixedNextActions: Partial<Record<ScenarioVerdictCode, string>> = {
  expected_non_conversion: "Correct the form input and submit again; do not count this attempt as a lead.",
  browser_verified: "No browser fix is needed; await platform confirmation.",
  tag_fired_request_missing: "Inspect the GA4 tag configuration, consent behavior, and browser delivery errors.",
  duplicate_fire: "Remove duplicate tags or overlapping triggers so the request fires once.",
  consent_limited: "Confirm the intended consent behavior before changing tracking configuration.",
  submission_failed: "Fix the interaction or page error, then rerun browser verification.",
  insufficient_observable_evidence: "Identify and confirm a browser-observable success signal before verification.",
};

function nextAction(code: ScenarioVerdictCode, contract: BrowserEvidenceContractV1): string {
  if (code === "outcome_observed_event_missing") {
    return `Add or repair the confirmed ${contract.dataLayerEvent ?? contract.request.eventName} data-layer event after success.`;
  }
  if (code === "datalayer_event_observed_tag_not_firing") {
    return `Check the GTM trigger conditions for the observed ${contract.dataLayerEvent ?? contract.request.eventName} event.`;
  }
  if (code === "missing_parameter") {
    return `Add the missing required ${contract.request.eventName} parameters to the GA4 tag.`;
  }
  return fixedNextActions[code] ?? "Review the browser evidence contract and retry.";
}

export function evaluateBrowserEvidence(
  contract: BrowserEvidenceContractV1,
  observations: BrowserEvidenceObservationsV1,
): TrackingRunEvidenceV1["verdict"] {
  assertBrowserEvidenceContract(contract);
  const matching = observations.requests.filter((request) =>
    request.destination === contract.request.destination && request.eventName === contract.request.eventName);
  const outcomeTypeAllowed = observations.outcomeEvidenceType === undefined
    || contract.outcome.allowedEvidenceTypes.includes(observations.outcomeEvidenceType);
  let code: ScenarioVerdictCode;
  if (!observations.attempted) {
    code = "insufficient_observable_evidence";
  } else if (observations.result === "validation_error") {
    code = "expected_non_conversion";
  } else if (observations.result === "server_error") {
    code = "submission_failed";
  } else if (contract.outcome.required && (!observations.outcomeObserved || !outcomeTypeAllowed)) {
    code = observations.outcomeObservable
      ? contract.outcome.whenAbsent
      : "insufficient_observable_evidence";
  } else if (observations.consent === "denied") {
    code = "consent_limited";
  } else if (observations.negativeExpectations.some((item) => contract.negativeExpectations.includes(item))) {
    code = "submission_failed";
  } else if (matching.length > contract.duplicatePolicy.maximum) {
    code = "duplicate_fire";
  } else if (matching.length >= contract.duplicatePolicy.minimum) {
    code = matching.every((request) =>
      contract.request.requiredParameters.every((parameter) => request.parameters.includes(parameter)))
      ? "browser_verified"
      : "missing_parameter";
  } else if (contract.dataLayerEvent !== null && !observations.dataLayerEvents.includes(contract.dataLayerEvent)) {
    code = "outcome_observed_event_missing";
  } else if (observations.tagFired === false) {
    code = "datalayer_event_observed_tag_not_firing";
  } else if (observations.tagFired === null) {
    code = "insufficient_observable_evidence";
  } else {
    code = "tag_fired_request_missing";
  }
  return {
    code,
    browserVerification: code === "browser_verified"
      ? "passed"
      : code === "insufficient_observable_evidence" || code === "consent_limited"
        ? "inconclusive"
        : "failed",
    platformConfirmation: "unverified",
    nextAction: nextAction(code, contract),
  };
}

function requestObservation(url: string): BrowserEvidenceObservationsV1["requests"][number] | undefined {
  try {
    const parsed = new URL(url);
    const parameters = new Set<string>();
    for (const key of parsed.searchParams.keys()) {
      if (key.startsWith("ep.")) parameters.add(key.slice(3));
      if (key === "dl") parameters.add("page_location");
    }
    return {
      destination: "ga4",
      eventName: parsed.searchParams.get("en") ?? "",
      parameters: [...parameters],
    };
  } catch {
    return undefined;
  }
}

export function browserObservationsFromRunEvidence(
  observations: TrackingRunEvidenceV1["observations"],
  negativeExpectations: BrowserNegativeExpectationV1[] = [],
): BrowserEvidenceObservationsV1 {
  return {
    attempted: observations.interaction.attempted,
    result: observations.interaction.submissionResult,
    outcomeObserved: observations.outcome.observed,
    outcomeObservable: observations.outcome.observable,
    ...(observations.outcome.evidenceType ? { outcomeEvidenceType: observations.outcome.evidenceType } : {}),
    consent: observations.consent.analyticsStorage,
    dataLayerEvents: observations.dataLayer.matchingEvents.flatMap((item) =>
      record(item) && typeof item.event === "string" ? [item.event] : []),
    tagFired: observations.tagFired,
    requests: observations.network.ga4Requests.flatMap(({ url }) => {
      const parsed = requestObservation(url);
      return parsed ? [parsed] : [];
    }),
    negativeExpectations,
  };
}
