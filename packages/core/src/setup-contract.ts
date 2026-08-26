export const TRACKING_SETUP_SCHEMA_VERSION = 1 as const;

export type TrackingSetupStatus = "draft" | "confirmed";
export type ParameterRequirement = "required" | "recommended" | "optional";
export type SetupScalar = string | number | boolean;
export type VariableSourceV1 =
  | { type: "built_in_variable"; name: string }
  | { type: "data_layer_variable"; name: string; key: string }
  | { type: "constant"; name: string; value: SetupScalar };
export type ValueSourceV1 =
  | VariableSourceV1
  | { type: "literal"; value: SetupScalar };

export interface EventParameterV1 {
  name: string;
  requirement: ParameterRequirement;
  value: ValueSourceV1;
}

export interface TemplateFieldV1 {
  name: string;
  value: TemplateValueV1;
}

export type TemplateValueV1 =
  | ValueSourceV1
  | { type: "list"; items: TemplateValueV1[] }
  | { type: "map"; entries: TemplateFieldV1[] };

export type TagExecutionV1 =
  | { type: "template"; templateId: string; fields: TemplateFieldV1[] }
  | { type: "custom_html"; html: string };

export type TagDestinationV1 =
  | { type: "ga4"; measurementId: string }
  | { type: "external"; identifier: string };

export interface TagActionV1 {
  id: string;
  name: string;
  execution: TagExecutionV1;
  destination: TagDestinationV1;
  event?: {
    name: string;
    parameters: EventParameterV1[];
  };
  firingPolicyIds: string[];
}

export type TriggerSourceType =
  | "page_view"
  | "dom_ready"
  | "window_loaded"
  | "history_change"
  | "click"
  | "form_submission"
  | "element_visibility"
  | "custom_data_layer";

export interface TriggerSourceV1 {
  type: TriggerSourceType;
  selector?: string;
  eventName?: string;
  clickMode?: "links" | "all_elements";
  visibilityFrequency?: "once_per_page" | "once_per_element" | "every_time";
}

export type ConditionOperator =
  | "equals"
  | "contains"
  | "starts_with"
  | "ends_with"
  | "matches_regex";

export interface FiringConditionV1 {
  variable: VariableSourceV1;
  operator: ConditionOperator;
  value: string;
}

export type ConsentType =
  | "analytics_storage"
  | "ad_storage"
  | "ad_user_data"
  | "ad_personalization"
  | "functionality_storage"
  | "personalization_storage"
  | "security_storage";

export interface FiringPolicyV1 {
  id: string;
  source: TriggerSourceV1;
  include: FiringConditionV1[];
  exclude: FiringConditionV1[];
  frequency: "once_per_event" | "once_per_page" | "unlimited";
  consent: {
    required: ConsentType[];
    whenDenied: "block";
  };
}

export type VerificationExpectationV1 =
  | { type: "tag_fired"; tagActionId: string; scenario?: string }
  | { type: "network_request"; destination: string; eventName?: string; scenario?: string }
  | { type: "data_layer_event"; eventName: string; scenario?: string }
  | { type: "page_error"; messagePattern: string; scenario?: string };

export interface TrackingSetupV1 {
  schemaVersion: typeof TRACKING_SETUP_SCHEMA_VERSION;
  id: string;
  status: TrackingSetupStatus;
  intent: {
    statement: string;
    businessOutcome: string;
  };
  tagActions: TagActionV1[];
  firingPolicies: FiringPolicyV1[];
  verification: {
    positive: VerificationExpectationV1[];
    negative: VerificationExpectationV1[];
  };
}

const EVENT_NAME = /^[a-z][a-z0-9_]{0,39}$/;
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const MEASUREMENT_ID = /^G-[A-Z0-9]{4,20}$/;
const MAX_TEXT_LENGTH = 2_000;
const MAX_SELECTOR_LENGTH = 512;
const MAX_CUSTOM_HTML_LENGTH = 100_000;
const MAX_FIELD_ITEMS = 100;
const MAX_FIELD_DEPTH = 5;

const EXECUTION_TYPES = new Set(["template", "custom_html"]);
const DESTINATION_TYPES = new Set(["ga4", "external"]);
const REQUIREMENTS = new Set(["required", "recommended", "optional"]);
const VALUE_SOURCE_TYPES = new Set([
  "built_in_variable",
  "data_layer_variable",
  "constant",
  "literal",
]);
const TEMPLATE_VALUE_TYPES = new Set([...VALUE_SOURCE_TYPES, "list", "map"]);
const TRIGGER_SOURCES = new Set<TriggerSourceType>([
  "page_view",
  "dom_ready",
  "window_loaded",
  "history_change",
  "click",
  "form_submission",
  "element_visibility",
  "custom_data_layer",
]);
const CONDITION_OPERATORS = new Set<ConditionOperator>([
  "equals",
  "contains",
  "starts_with",
  "ends_with",
  "matches_regex",
]);
const FIRING_FREQUENCIES = new Set(["once_per_event", "once_per_page", "unlimited"]);
const CONSENT_TYPES = new Set<ConsentType>([
  "analytics_storage",
  "ad_storage",
  "ad_user_data",
  "ad_personalization",
  "functionality_storage",
  "personalization_storage",
  "security_storage",
]);
const EXPECTATION_TYPES = new Set([
  "tag_fired",
  "network_request",
  "data_layer_event",
  "page_error",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isScalar(value: unknown): value is SetupScalar {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function validText(value: unknown, maxLength = MAX_TEXT_LENGTH): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}

function validSelector(value: unknown): value is string {
  return validText(value, MAX_SELECTOR_LENGTH) && !/[<>\0]/.test(value);
}

function pushDuplicateIds(
  values: unknown[],
  path: string,
  errors: string[],
): Set<string> {
  const ids = new Set<string>();

  for (const value of values) {
    if (!isRecord(value) || typeof value.id !== "string" || !IDENTIFIER.test(value.id)) {
      continue;
    }
    if (ids.has(value.id)) {
      errors.push(`${path} contains duplicate id ${value.id}`);
    }
    ids.add(value.id);
  }

  return ids;
}

function validateValue(
  value: unknown,
  path: string,
  errors: string[],
): void {
  if (!isRecord(value)) {
    errors.push(`${path} is invalid`);
    return;
  }
  if (typeof value.type !== "string" || !VALUE_SOURCE_TYPES.has(value.type)) {
    errors.push(`${path}.type is unsupported`);
    return;
  }
  if (["built_in_variable", "data_layer_variable", "constant"].includes(value.type)
    && !validText(value.name, 128)) {
    errors.push(`${path}.name is required`);
  }
  if (value.type === "data_layer_variable" && !validText(value.key, 256)) {
    errors.push(`${path}.key is required`);
  }
  if (value.type === "constant" && !isScalar(value.value)) {
    errors.push(`${path}.value must be a string, number, or boolean`);
  }
  if (value.type === "literal" && !isScalar(value.value)) {
    errors.push(`${path}.value must be a string, number, or boolean`);
  }
}

function validateFieldValue(
  value: unknown,
  path: string,
  errors: string[],
  depth = 0,
): void {
  if (!isRecord(value)) {
    errors.push(`${path} is invalid`);
    return;
  }
  if (typeof value.type !== "string" || !TEMPLATE_VALUE_TYPES.has(value.type)) {
    errors.push(`${path}.type is unsupported`);
    return;
  }
  if (VALUE_SOURCE_TYPES.has(value.type)) {
    validateValue(value, path, errors);
    return;
  }
  if (depth >= MAX_FIELD_DEPTH) {
    errors.push(`${path} exceeds maximum nesting depth`);
    return;
  }

  const collection = value.type === "list" ? value.items : value.entries;
  const collectionPath = value.type === "list" ? `${path}.items` : `${path}.entries`;
  if (!Array.isArray(collection) || collection.length > MAX_FIELD_ITEMS) {
    errors.push(`${collectionPath} must contain at most ${MAX_FIELD_ITEMS} items`);
    return;
  }

  const names = new Set<string>();
  collection.forEach((item, index) => {
    const itemPath = `${collectionPath}[${index}]`;
    if (value.type === "list") {
      validateFieldValue(item, itemPath, errors, depth + 1);
      return;
    }
    if (!isRecord(item)) {
      errors.push(`${itemPath} is invalid`);
      return;
    }
    if (typeof item.name !== "string" || !IDENTIFIER.test(item.name)) {
      errors.push(`${itemPath}.name is invalid`);
    } else if (names.has(item.name)) {
      errors.push(`${collectionPath} contains duplicate name ${item.name}`);
    } else {
      names.add(item.name);
    }
    validateFieldValue(item.value, `${itemPath}.value`, errors, depth + 1);
  });
}

function validateParameters(
  value: unknown,
  path: string,
  errors: string[],
): void {
  if (!Array.isArray(value)) {
    errors.push(`${path} must be an array`);
    return;
  }

  const names = new Set<string>();
  value.forEach((parameter, index) => {
    const itemPath = `${path}[${index}]`;
    if (!isRecord(parameter)) {
      errors.push(`${itemPath} is invalid`);
      return;
    }
    if (typeof parameter.name !== "string" || !EVENT_NAME.test(parameter.name)) {
      errors.push(`${itemPath}.name is invalid`);
    } else if (names.has(parameter.name)) {
      errors.push(`${path} contains duplicate name ${parameter.name}`);
    } else {
      names.add(parameter.name);
    }
    if (typeof parameter.requirement !== "string" || !REQUIREMENTS.has(parameter.requirement)) {
      errors.push(`${itemPath}.requirement is unsupported`);
    }
    validateValue(parameter.value, `${itemPath}.value`, errors);
  });
}

function validateExecution(
  value: unknown,
  path: string,
  errors: string[],
): void {
  if (!isRecord(value)) {
    errors.push(`${path} is invalid`);
    return;
  }
  if (typeof value.type !== "string" || !EXECUTION_TYPES.has(value.type)) {
    errors.push(`${path}.type is unsupported`);
    return;
  }
  if (value.type === "template" && (typeof value.templateId !== "string" || !IDENTIFIER.test(value.templateId))) {
    errors.push(`${path}.templateId is invalid`);
  }
  if (value.type === "template") {
    if (!Array.isArray(value.fields)) {
      errors.push(`${path}.fields must be an array`);
    } else {
      const fieldNames = new Set<string>();
      value.fields.forEach((field, index) => {
        const fieldPath = `${path}.fields[${index}]`;
        if (!isRecord(field)) {
          errors.push(`${fieldPath} is invalid`);
          return;
        }
        if (typeof field.name !== "string" || !IDENTIFIER.test(field.name)) {
          errors.push(`${fieldPath}.name is invalid`);
        } else if (fieldNames.has(field.name)) {
          errors.push(`${path}.fields contains duplicate name ${field.name}`);
        } else {
          fieldNames.add(field.name);
        }
        validateFieldValue(field.value, `${fieldPath}.value`, errors);
      });
    }
  }
  if (value.type === "custom_html" && !validText(value.html, MAX_CUSTOM_HTML_LENGTH)) {
    errors.push(`${path}.html is required`);
  }
}

function validateDestination(
  value: unknown,
  path: string,
  errors: string[],
): void {
  if (!isRecord(value)) {
    errors.push(`${path} is invalid`);
    return;
  }
  if (typeof value.type !== "string" || !DESTINATION_TYPES.has(value.type)) {
    errors.push(`${path}.type is unsupported`);
    return;
  }
  if (value.type === "ga4" && (typeof value.measurementId !== "string" || !MEASUREMENT_ID.test(value.measurementId))) {
    errors.push(`${path}.measurementId is invalid`);
  }
  if (value.type === "external" && !validText(value.identifier, 256)) {
    errors.push(`${path}.identifier is required`);
  }
}

function validateEvent(
  value: unknown,
  path: string,
  errors: string[],
): void {
  if (!isRecord(value)) {
    errors.push(`${path} is invalid`);
    return;
  }
  if (typeof value.name !== "string" || !EVENT_NAME.test(value.name)) {
    errors.push(`${path}.name is invalid`);
  }
  validateParameters(value.parameters, `${path}.parameters`, errors);
}

function validateActions(
  value: unknown,
  errors: string[],
): { actions: unknown[]; ids: Set<string> } {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push("at least one tag action is required");
    return { actions: [], ids: new Set() };
  }

  value.forEach((action, index) => {
    const path = `tagActions[${index}]`;
    if (!isRecord(action)) {
      errors.push(`${path} is invalid`);
      return;
    }
    if (typeof action.id !== "string" || !IDENTIFIER.test(action.id)) {
      errors.push(`${path}.id is invalid`);
    }
    if (!validText(action.name)) {
      errors.push(`${path}.name is required`);
    }
    validateExecution(action.execution, `${path}.execution`, errors);
    validateDestination(action.destination, `${path}.destination`, errors);
    if (action.event !== undefined) {
      validateEvent(action.event, `${path}.event`, errors);
    }
    if (!Array.isArray(action.firingPolicyIds) || action.firingPolicyIds.length === 0) {
      errors.push(`${path}.firingPolicyIds requires an id`);
    } else if (action.firingPolicyIds.some((id) => typeof id !== "string" || !IDENTIFIER.test(id))) {
      errors.push(`${path}.firingPolicyIds contains an invalid id`);
    }
  });

  return { actions: value, ids: pushDuplicateIds(value, "tagActions", errors) };
}

function validateSource(
  value: unknown,
  path: string,
  errors: string[],
): void {
  if (!isRecord(value)) {
    errors.push(`${path} is invalid`);
    return;
  }
  if (typeof value.type !== "string" || !TRIGGER_SOURCES.has(value.type as TriggerSourceType)) {
    errors.push(`${path}.type is unsupported`);
    return;
  }
  if (value.selector !== undefined && !validSelector(value.selector)) {
    errors.push(`${path}.selector is invalid`);
  }
  if (value.clickMode !== undefined
    && (value.type !== "click" || !["links", "all_elements"].includes(String(value.clickMode)))) {
    errors.push(`${path}.clickMode is unsupported`);
  }
  if (value.visibilityFrequency !== undefined
    && (value.type !== "element_visibility"
      || !["once_per_page", "once_per_element", "every_time"].includes(String(value.visibilityFrequency)))) {
    errors.push(`${path}.visibilityFrequency is unsupported`);
  }
  if (value.type === "element_visibility" && !validSelector(value.selector)) {
    errors.push(`${path}.selector is required`);
  }
  if (value.type === "custom_data_layer" && (typeof value.eventName !== "string" || !EVENT_NAME.test(value.eventName))) {
    errors.push(`${path}.eventName is required`);
  }
}

function validRegex(value: string): boolean {
  try {
    new RegExp(value);
    return true;
  } catch {
    return false;
  }
}

function safeRegex(value: string): boolean {
  if (value.length > 512 || /\\[1-9]/.test(value) || /\(\?<([=!])/.test(value)) return false;
  // Reject quantified groups that already contain an unescaped repetition. These are
  // the most common catastrophic-backtracking shape and are unnecessary for GTM scopes.
  if (/\((?:\\.|[^)])*(?<!\\)[+*](?:\\.|[^)])*\)(?:[+*]|\{\d*,?\d*\})/.test(value)) return false;
  return true;
}

function validateConditions(
  value: unknown,
  path: string,
  errors: string[],
): void {
  if (!Array.isArray(value)) {
    errors.push(`${path} must be an array`);
    return;
  }

  value.forEach((condition, index) => {
    const itemPath = `${path}[${index}]`;
    if (!isRecord(condition)) {
      errors.push(`${itemPath} is invalid`);
      return;
    }
    validateValue(condition.variable, `${itemPath}.variable`, errors);
    if (isRecord(condition.variable) && condition.variable.type === "literal") {
      errors.push(`${itemPath}.variable must reference a GTM variable`);
    }
    if (typeof condition.operator !== "string" || !CONDITION_OPERATORS.has(condition.operator as ConditionOperator)) {
      errors.push(`${itemPath}.operator is unsupported`);
    }
    if (typeof condition.value !== "string" || condition.value.length === 0 || condition.value.length > MAX_TEXT_LENGTH) {
      errors.push(`${itemPath}.value is invalid`);
    } else if (condition.operator === "matches_regex" && !validRegex(condition.value)) {
      errors.push(`${itemPath}.value is not a valid regular expression`);
    } else if (condition.operator === "matches_regex" && !safeRegex(condition.value)) {
      errors.push(`${itemPath}.value is not a safe regular expression`);
    }
  });
}

function validateConsent(
  value: unknown,
  path: string,
  errors: string[],
): void {
  if (!isRecord(value)) {
    errors.push(`${path} is invalid`);
    return;
  }
  if (!Array.isArray(value.required)) {
    errors.push(`${path}.required must be an array`);
  } else if (value.required.some((type) => typeof type !== "string" || !CONSENT_TYPES.has(type as ConsentType))) {
    errors.push(`${path}.required contains an unsupported consent type`);
  }
  if (value.whenDenied !== "block") {
    errors.push(`${path}.whenDenied must be block`);
  }
}

function validatePolicies(
  value: unknown,
  errors: string[],
): { policies: unknown[]; ids: Set<string> } {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push("at least one firing policy is required");
    return { policies: [], ids: new Set() };
  }

  value.forEach((policy, index) => {
    const path = `firingPolicies[${index}]`;
    if (!isRecord(policy)) {
      errors.push(`${path} is invalid`);
      return;
    }
    if (typeof policy.id !== "string" || !IDENTIFIER.test(policy.id)) {
      errors.push(`${path}.id is invalid`);
    }
    validateSource(policy.source, `${path}.source`, errors);
    validateConditions(policy.include, `${path}.include`, errors);
    validateConditions(policy.exclude, `${path}.exclude`, errors);
    if (typeof policy.frequency !== "string" || !FIRING_FREQUENCIES.has(policy.frequency)) {
      errors.push(`${path}.frequency is unsupported`);
    }
    validateConsent(policy.consent, `${path}.consent`, errors);
  });

  return { policies: value, ids: pushDuplicateIds(value, "firingPolicies", errors) };
}

function validateExpectation(
  value: unknown,
  path: string,
  errors: string[],
): void {
  if (!isRecord(value)) {
    errors.push(`${path} is invalid`);
    return;
  }
  if (typeof value.type !== "string" || !EXPECTATION_TYPES.has(value.type)) {
    errors.push(`${path}.type is unsupported`);
    return;
  }
  if (value.scenario !== undefined && !validText(value.scenario, 128)) {
    errors.push(`${path}.scenario is invalid`);
  }
  if (value.type === "tag_fired" && (typeof value.tagActionId !== "string" || !IDENTIFIER.test(value.tagActionId))) {
    errors.push(`${path}.tagActionId is invalid`);
  }
  if (value.type === "network_request") {
    if (!validText(value.destination, 128)) {
      errors.push(`${path}.destination is required`);
    }
    if (value.eventName !== undefined && (typeof value.eventName !== "string" || !EVENT_NAME.test(value.eventName))) {
      errors.push(`${path}.eventName is invalid`);
    }
  }
  if (value.type === "data_layer_event" && (typeof value.eventName !== "string" || !EVENT_NAME.test(value.eventName))) {
    errors.push(`${path}.eventName is invalid`);
  }
  if (value.type === "page_error" && !validText(value.messagePattern, 256)) {
    errors.push(`${path}.messagePattern is required`);
  }
}

function validateVerification(
  value: unknown,
  errors: string[],
): { positive: unknown[]; negative: unknown[] } {
  if (!isRecord(value)) {
    errors.push("verification is required");
    return { positive: [], negative: [] };
  }

  const positive = Array.isArray(value.positive) ? value.positive : [];
  const negative = Array.isArray(value.negative) ? value.negative : [];
  if (!Array.isArray(value.positive) || value.positive.length === 0) {
    errors.push("verification.positive requires an expectation");
  }
  if (!Array.isArray(value.negative)) {
    errors.push("verification.negative must be an array");
  }
  positive.forEach((expectation, index) => {
    validateExpectation(expectation, `verification.positive[${index}]`, errors);
  });
  negative.forEach((expectation, index) => {
    validateExpectation(expectation, `verification.negative[${index}]`, errors);
  });

  return { positive, negative };
}

function validateReferences(
  actions: unknown[],
  actionIds: Set<string>,
  policyIds: Set<string>,
  expectations: { positive: unknown[]; negative: unknown[] },
  errors: string[],
): void {
  actions.forEach((action, index) => {
    if (!isRecord(action) || !Array.isArray(action.firingPolicyIds)) {
      return;
    }
    for (const policyId of action.firingPolicyIds) {
      if (typeof policyId === "string" && IDENTIFIER.test(policyId) && !policyIds.has(policyId)) {
        errors.push(`tagActions[${index}].firingPolicyIds references unknown ${policyId}`);
      }
    }
  });

  for (const polarity of ["positive", "negative"] as const) {
    expectations[polarity].forEach((expectation, index) => {
      if (!isRecord(expectation) || expectation.type !== "tag_fired") {
        return;
      }
      if (typeof expectation.tagActionId === "string" && IDENTIFIER.test(expectation.tagActionId)
        && !actionIds.has(expectation.tagActionId)) {
        errors.push(`verification.${polarity}[${index}].tagActionId references unknown ${expectation.tagActionId}`);
      }
    });
  }
}

export function validateTrackingSetup(value: unknown): string[] {
  if (!isRecord(value)) {
    return ["tracking setup must be an object"];
  }

  const errors: string[] = [];
  if (value.schemaVersion !== TRACKING_SETUP_SCHEMA_VERSION) {
    errors.push("schemaVersion must be 1");
  }
  if (typeof value.id !== "string" || !IDENTIFIER.test(value.id)) {
    errors.push("id is invalid");
  }
  if (value.status !== "draft" && value.status !== "confirmed") {
    errors.push("status is invalid");
  }

  if (!isRecord(value.intent)) {
    errors.push("intent is required");
  } else {
    if (!validText(value.intent.statement)) {
      errors.push("intent.statement is required");
    }
    if (!validText(value.intent.businessOutcome)) {
      errors.push("intent.businessOutcome is required");
    }
  }

  const actions = validateActions(value.tagActions, errors);
  const policies = validatePolicies(value.firingPolicies, errors);
  const expectations = validateVerification(value.verification, errors);
  validateReferences(actions.actions, actions.ids, policies.ids, expectations, errors);

  return [...new Set(errors)];
}

export function assertTrackingSetup(value: unknown): asserts value is TrackingSetupV1 {
  const errors = validateTrackingSetup(value);
  if (errors.length > 0) {
    throw new Error(errors.join(" "));
  }
}
