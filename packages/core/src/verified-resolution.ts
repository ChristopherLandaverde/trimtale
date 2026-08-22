import type { ScenarioVerdictCode } from "./contracts.js";

export const VERIFIED_RESOLUTION_SCHEMA_VERSION = 1 as const;

export const verifiedResolutionCauses = [
  "listener_only_handles_native_submit",
] as const;

export const verifiedResolutionActions = [
  "observe_confirmed_ajax_success",
] as const;

export type VerifiedResolutionCause = typeof verifiedResolutionCauses[number];
export type VerifiedResolutionAction = typeof verifiedResolutionActions[number];

export interface VerifiedResolutionEnvironmentV1 {
  interactionType: "navigation_click" | "form_submission";
  submissionResult: "success" | "validation_error" | "server_error" | "unknown";
  analyticsStorage: "granted" | "denied" | "unknown";
}

export interface VerifiedResolutionV1 {
  schemaVersion: typeof VERIFIED_RESOLUTION_SCHEMA_VERSION;
  id: string;
  confirmedAt: string;
  humanConfirmed: true;
  confirmedCause: VerifiedResolutionCause;
  correctiveAction: VerifiedResolutionAction;
  beforeEvidenceId: string;
  beforeVerdict: Exclude<ScenarioVerdictCode, "browser_verified">;
  afterEvidenceId: string;
  afterVerdict: "browser_verified";
  environment: VerifiedResolutionEnvironmentV1;
}

const identifier = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const nonPassingVerdicts = new Set<ScenarioVerdictCode>([
  "expected_non_conversion",
  "outcome_observed_event_missing",
  "datalayer_event_observed_tag_not_firing",
  "tag_fired_request_missing",
  "missing_parameter",
  "duplicate_fire",
  "consent_limited",
  "submission_failed",
  "insufficient_observable_evidence",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateVerifiedResolution(value: unknown): string[] {
  if (!isRecord(value)) return ["verified resolution must be an object"];
  const errors: string[] = [];
  if (value.schemaVersion !== VERIFIED_RESOLUTION_SCHEMA_VERSION) errors.push("schemaVersion must be 1");
  if (typeof value.id !== "string" || !identifier.test(value.id)) errors.push("id is invalid");
  if (typeof value.confirmedAt !== "string" || Number.isNaN(Date.parse(value.confirmedAt))) errors.push("confirmedAt must be an ISO date");
  if (value.humanConfirmed !== true) errors.push("humanConfirmed must be true");
  if (!verifiedResolutionCauses.includes(value.confirmedCause as VerifiedResolutionCause)) errors.push("confirmedCause is unsupported");
  if (!verifiedResolutionActions.includes(value.correctiveAction as VerifiedResolutionAction)) errors.push("correctiveAction is unsupported");
  if (typeof value.beforeEvidenceId !== "string" || !identifier.test(value.beforeEvidenceId)) errors.push("beforeEvidenceId is invalid");
  if (typeof value.afterEvidenceId !== "string" || !identifier.test(value.afterEvidenceId)) errors.push("afterEvidenceId is invalid");
  if (!nonPassingVerdicts.has(value.beforeVerdict as ScenarioVerdictCode)) errors.push("beforeVerdict must be non-passing");
  if (value.afterVerdict !== "browser_verified") errors.push("afterVerdict must be browser_verified");

  const environment = isRecord(value.environment) ? value.environment : undefined;
  if (!environment) {
    errors.push("environment is required");
  } else {
    if (environment.interactionType !== "navigation_click" && environment.interactionType !== "form_submission") errors.push("environment.interactionType is invalid");
    if (!["success", "validation_error", "server_error", "unknown"].includes(String(environment.submissionResult))) errors.push("environment.submissionResult is invalid");
    if (!["granted", "denied", "unknown"].includes(String(environment.analyticsStorage))) errors.push("environment.analyticsStorage is invalid");
  }
  return errors;
}

export function assertVerifiedResolution(value: unknown): asserts value is VerifiedResolutionV1 {
  const errors = validateVerifiedResolution(value);
  if (errors.length > 0) throw new Error(errors.join(" "));
}
