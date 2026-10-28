import { fingerprintDraftValue } from "./draft-verification.js";

export const GA4_CONFIGURATION_SCHEMA_VERSION = 1 as const;
export const GA4_APPROVAL_LIFETIME_MS = 30 * 60 * 1_000;

export type EnhancedMeasurementFeature =
  | "stream"
  | "page_views"
  | "scrolls"
  | "outbound_clicks"
  | "site_search"
  | "video_engagement"
  | "file_downloads"
  | "form_interactions";

export type Ga4MeasurementUnit =
  | "STANDARD"
  | "CURRENCY"
  | "FEET"
  | "METERS"
  | "KILOMETERS"
  | "MILES"
  | "MILLISECONDS"
  | "SECONDS"
  | "MINUTES"
  | "HOURS";

export type Ga4ConfigurationActionV1 =
  | {
    id: string;
    type: "enhanced_measurement";
    feature: EnhancedMeasurementFeature;
    enabled: boolean;
  }
  | {
    id: string;
    type: "custom_dimension";
    parameterName: string;
    displayName: string;
    description: string;
    scope: "EVENT";
  }
  | {
    id: string;
    type: "custom_metric";
    parameterName: string;
    displayName: string;
    description: string;
    measurementUnit: Ga4MeasurementUnit;
    scope: "EVENT";
    restrictedMetricTypes: Array<"COST_DATA" | "REVENUE_DATA">;
  }
  | {
    id: string;
    type: "key_event";
    eventName: string;
    countingMethod: "ONCE_PER_EVENT" | "ONCE_PER_SESSION";
    defaultValue?: { numericValue: number; currencyCode: string };
  };

export interface Ga4ConfigurationPlanV1 {
  schemaVersion: typeof GA4_CONFIGURATION_SCHEMA_VERSION;
  id: string;
  status: "draft" | "approved";
  target: {
    propertyId: string;
    propertyName: string;
    measurementId: string;
    streamId: string;
    streamName: string;
  };
  providerStateFingerprint: string;
  actions: Ga4ConfigurationActionV1[];
  planFingerprint: string;
  approval?: {
    approvedAt: string;
    approvedBy: string;
    planFingerprint: string;
    providerStateFingerprint: string;
  };
}

export interface Ga4ActionReceiptV1 {
  schemaVersion: typeof GA4_CONFIGURATION_SCHEMA_VERSION;
  planId: string;
  planFingerprint: string;
  actionId: string;
  actionType: Ga4ConfigurationActionV1["type"];
  propertyId: string;
  status: "created" | "updated" | "already_current";
  resourceName: string;
  providerFingerprintAfter: string;
  completedAt: string;
}

const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const PROPERTY_ID = /^\d+$/;
const STREAM_ID = /^\d+$/;
const MEASUREMENT_ID = /^G-[A-Z0-9]{4,20}$/;
const PARAMETER_NAME = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;
const DISPLAY_NAME = /^[A-Za-z][A-Za-z0-9 _]{0,81}$/;
const EVENT_NAME = /^[a-z][a-z0-9_]{0,39}$/;
const CURRENCY_CODE = /^[A-Z]{3}$/;
const STATE_FINGERPRINT = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/;
const ENHANCED_FEATURES = new Set<EnhancedMeasurementFeature>([
  "stream", "page_views", "scrolls", "outbound_clicks", "site_search",
  "video_engagement", "file_downloads", "form_interactions",
]);
const MEASUREMENT_UNITS = new Set<Ga4MeasurementUnit>([
  "STANDARD", "CURRENCY", "FEET", "METERS", "KILOMETERS", "MILES",
  "MILLISECONDS", "SECONDS", "MINUTES", "HOURS",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validText(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maximum;
}

function validateAction(value: unknown, index: number, errors: string[]): void {
  const path = `actions[${index}]`;
  if (!isRecord(value)) {
    errors.push(`${path} is invalid`);
    return;
  }
  if (typeof value.id !== "string" || !ID.test(value.id)) errors.push(`${path}.id is invalid`);
  if (value.type === "enhanced_measurement") {
    if (typeof value.feature !== "string" || !ENHANCED_FEATURES.has(value.feature as EnhancedMeasurementFeature)) {
      errors.push(`${path}.feature is unsupported`);
    }
    if (typeof value.enabled !== "boolean") errors.push(`${path}.enabled is required`);
    return;
  }
  if (value.type === "custom_dimension") {
    if (typeof value.parameterName !== "string" || !PARAMETER_NAME.test(value.parameterName)) errors.push(`${path}.parameterName is invalid`);
    if (typeof value.displayName !== "string" || !DISPLAY_NAME.test(value.displayName)) errors.push(`${path}.displayName is invalid`);
    if (typeof value.description !== "string" || value.description.length > 150) errors.push(`${path}.description is invalid`);
    if (value.scope !== "EVENT") errors.push(`${path}.scope must be EVENT`);
    return;
  }
  if (value.type === "custom_metric") {
    if (typeof value.parameterName !== "string" || !PARAMETER_NAME.test(value.parameterName)) errors.push(`${path}.parameterName is invalid`);
    if (typeof value.displayName !== "string" || !DISPLAY_NAME.test(value.displayName)) errors.push(`${path}.displayName is invalid`);
    if (typeof value.description !== "string" || value.description.length > 150) errors.push(`${path}.description is invalid`);
    if (typeof value.measurementUnit !== "string" || !MEASUREMENT_UNITS.has(value.measurementUnit as Ga4MeasurementUnit)) {
      errors.push(`${path}.measurementUnit is unsupported`);
    }
    if (value.scope !== "EVENT") errors.push(`${path}.scope must be EVENT`);
    if (!Array.isArray(value.restrictedMetricTypes)
      || value.restrictedMetricTypes.some((item) => item !== "COST_DATA" && item !== "REVENUE_DATA")
      || new Set(value.restrictedMetricTypes).size !== value.restrictedMetricTypes.length) {
      errors.push(`${path}.restrictedMetricTypes is invalid`);
    } else if (value.measurementUnit === "CURRENCY" && value.restrictedMetricTypes.length === 0) {
      errors.push(`${path}.currency metric requires a restricted metric type`);
    } else if (value.measurementUnit !== "CURRENCY" && value.restrictedMetricTypes.length > 0) {
      errors.push(`${path}.restricted metric types require CURRENCY`);
    }
    return;
  }
  if (value.type === "key_event") {
    if (typeof value.eventName !== "string" || !EVENT_NAME.test(value.eventName)) errors.push(`${path}.eventName is invalid`);
    if (value.countingMethod !== "ONCE_PER_EVENT" && value.countingMethod !== "ONCE_PER_SESSION") {
      errors.push(`${path}.countingMethod is unsupported`);
    }
    if (value.defaultValue !== undefined) {
      if (!isRecord(value.defaultValue)
        || typeof value.defaultValue.numericValue !== "number"
        || !Number.isFinite(value.defaultValue.numericValue)
        || typeof value.defaultValue.currencyCode !== "string"
        || !CURRENCY_CODE.test(value.defaultValue.currencyCode)) {
        errors.push(`${path}.defaultValue is invalid`);
      }
    }
    return;
  }
  errors.push(`${path}.type is unsupported`);
}

function fingerprintInput(plan: Omit<Ga4ConfigurationPlanV1, "planFingerprint" | "approval">): unknown {
  return {
    schemaVersion: plan.schemaVersion,
    id: plan.id,
    target: plan.target,
    providerStateFingerprint: plan.providerStateFingerprint,
    actions: plan.actions,
  };
}

export function validateGa4ConfigurationPlan(value: unknown): string[] {
  if (!isRecord(value)) return ["GA4 configuration plan must be an object"];
  const errors: string[] = [];
  if (value.schemaVersion !== GA4_CONFIGURATION_SCHEMA_VERSION) errors.push("schemaVersion must be 1");
  if (typeof value.id !== "string" || !ID.test(value.id)) errors.push("id is invalid");
  if (value.status !== "draft" && value.status !== "approved") errors.push("status is invalid");
  const target = isRecord(value.target) ? value.target : undefined;
  if (!target
    || typeof target.propertyId !== "string" || !PROPERTY_ID.test(target.propertyId)
    || !validText(target.propertyName, 256)
    || typeof target.measurementId !== "string" || !MEASUREMENT_ID.test(target.measurementId)
    || typeof target.streamId !== "string" || !STREAM_ID.test(target.streamId)
    || !validText(target.streamName, 256)) {
    errors.push("target is invalid");
  }
  if (typeof value.providerStateFingerprint !== "string" || !STATE_FINGERPRINT.test(value.providerStateFingerprint)) {
    errors.push("providerStateFingerprint is invalid");
  }
  if (!Array.isArray(value.actions) || value.actions.length === 0 || value.actions.length > 50) {
    errors.push("actions must contain between 1 and 50 actions");
  } else {
    value.actions.forEach((action, index) => validateAction(action, index, errors));
    const ids = value.actions.flatMap((action) => isRecord(action) && typeof action.id === "string" ? [action.id] : []);
    if (new Set(ids).size !== ids.length) errors.push("action ids must be unique");
  }
  if (typeof value.planFingerprint !== "string" || !/^ga4_plan_[a-f0-9]{12}$/.test(value.planFingerprint)) {
    errors.push("planFingerprint is invalid");
  } else if (target && Array.isArray(value.actions)
    && typeof value.id === "string" && typeof value.providerStateFingerprint === "string") {
    const expected = fingerprintDraftValue("ga4_plan", fingerprintInput({
      schemaVersion: GA4_CONFIGURATION_SCHEMA_VERSION,
      id: value.id,
      status: value.status === "approved" ? "approved" : "draft",
      target: target as unknown as Ga4ConfigurationPlanV1["target"],
      providerStateFingerprint: value.providerStateFingerprint,
      actions: value.actions as Ga4ConfigurationActionV1[],
    }));
    if (value.planFingerprint !== expected) errors.push("planFingerprint does not match the plan");
  }
  const approval = isRecord(value.approval) ? value.approval : undefined;
  if (value.status === "approved" && !approval) errors.push("approved plan requires approval");
  if (approval) {
    if (!validText(approval.approvedBy, 256)
      || typeof approval.approvedAt !== "string" || Number.isNaN(Date.parse(approval.approvedAt))
      || approval.planFingerprint !== value.planFingerprint
      || approval.providerStateFingerprint !== value.providerStateFingerprint) {
      errors.push("approval is invalid or stale");
    }
  }
  return [...new Set(errors)];
}

export function createGa4ConfigurationPlan(
  input: Omit<Ga4ConfigurationPlanV1, "schemaVersion" | "status" | "planFingerprint" | "approval">,
): Ga4ConfigurationPlanV1 {
  const base = {
    schemaVersion: GA4_CONFIGURATION_SCHEMA_VERSION,
    id: input.id,
    status: "draft" as const,
    target: structuredClone(input.target),
    providerStateFingerprint: input.providerStateFingerprint,
    actions: structuredClone(input.actions),
  };
  const plan: Ga4ConfigurationPlanV1 = {
    ...base,
    planFingerprint: fingerprintDraftValue("ga4_plan", fingerprintInput(base)),
  };
  const errors = validateGa4ConfigurationPlan(plan);
  if (errors.length > 0) throw new Error(errors.join(" "));
  return plan;
}

export function approveGa4ConfigurationPlan(
  plan: Ga4ConfigurationPlanV1,
  approvedBy: string,
  approvedAt = new Date().toISOString(),
): Ga4ConfigurationPlanV1 {
  const errors = validateGa4ConfigurationPlan(plan);
  if (errors.length > 0) throw new Error(errors.join(" "));
  if (plan.status !== "draft") throw new Error("Only a draft GA4 plan can be approved.");
  if (!validText(approvedBy, 256)) throw new Error("GA4 approval requires an approver.");
  if (Number.isNaN(Date.parse(approvedAt))) throw new Error("GA4 approval timestamp is invalid.");
  const approved: Ga4ConfigurationPlanV1 = {
    ...structuredClone(plan),
    status: "approved",
    approval: {
      approvedAt,
      approvedBy: approvedBy.trim(),
      planFingerprint: plan.planFingerprint,
      providerStateFingerprint: plan.providerStateFingerprint,
    },
  };
  const approvedErrors = validateGa4ConfigurationPlan(approved);
  if (approvedErrors.length > 0) throw new Error(approvedErrors.join(" "));
  return approved;
}

export function ga4ConfigurationApprovalCurrent(
  plan: Ga4ConfigurationPlanV1,
  freshProviderStateFingerprint: string,
  now = Date.now(),
): boolean {
  const approvedAt = plan.approval ? Date.parse(plan.approval.approvedAt) : Number.NaN;
  return plan.status === "approved"
    && plan.approval?.planFingerprint === plan.planFingerprint
    && plan.approval.providerStateFingerprint === plan.providerStateFingerprint
    && freshProviderStateFingerprint === plan.providerStateFingerprint
    && Number.isFinite(approvedAt)
    && now >= approvedAt
    && now - approvedAt <= GA4_APPROVAL_LIFETIME_MS;
}

export function validateGa4ActionReceipt(value: unknown): string[] {
  if (!isRecord(value)) return ["GA4 action receipt must be an object"];
  const errors: string[] = [];
  if (value.schemaVersion !== GA4_CONFIGURATION_SCHEMA_VERSION) errors.push("schemaVersion must be 1");
  for (const field of ["planId", "actionId"] as const) {
    if (typeof value[field] !== "string" || !ID.test(value[field])) errors.push(`${field} is invalid`);
  }
  if (typeof value.planFingerprint !== "string" || !/^ga4_plan_[a-f0-9]{12}$/.test(value.planFingerprint)) errors.push("planFingerprint is invalid");
  if (!["enhanced_measurement", "custom_dimension", "custom_metric", "key_event"].includes(String(value.actionType))) errors.push("actionType is unsupported");
  if (typeof value.propertyId !== "string" || !PROPERTY_ID.test(value.propertyId)) errors.push("propertyId is invalid");
  if (!["created", "updated", "already_current"].includes(String(value.status))) errors.push("status is unsupported");
  if (!validText(value.resourceName, 512)) errors.push("resourceName is required");
  if (typeof value.providerFingerprintAfter !== "string" || !STATE_FINGERPRINT.test(value.providerFingerprintAfter)) errors.push("providerFingerprintAfter is invalid");
  if (typeof value.completedAt !== "string" || Number.isNaN(Date.parse(value.completedAt))) errors.push("completedAt is invalid");
  return errors;
}
