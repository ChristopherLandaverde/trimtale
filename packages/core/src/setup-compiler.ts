import { GTM_MANAGED_ENTITY_NOTE } from "./change-plan.js";
import {
  assertTrackingSetup,
  type FiringConditionV1,
  type FiringPolicyV1,
  type TagActionV1,
  type TemplateFieldV1,
  type TemplateValueV1,
  type TrackingSetupV1,
  type ValueSourceV1,
  type VariableSourceV1,
} from "./setup-contract.js";
import type {
  ContainerContext,
  GtmContainerExport,
  GtmParameter,
} from "./types.js";

export const SETUP_COMPILER_VERSION = 1 as const;

export type SetupEntityKind = "builtInVariable" | "variable" | "trigger" | "tag";

export interface SetupDependencyNodeV1 {
  kind: SetupEntityKind;
  id: string;
  dependsOn: string[];
}

export interface CompiledTrackingSetupV1 {
  schemaVersion: typeof SETUP_COMPILER_VERSION;
  setupId: string;
  fingerprint: string;
  dependencyOrder: SetupDependencyNodeV1[];
  containerFile: GtmContainerExport;
}

interface VariableCollection {
  builtIns: Map<string, string>;
  dataLayer: Map<string, string>;
  constants: Map<string, string | number | boolean>;
}

interface CompiledPolicy {
  policy: FiringPolicyV1;
  firingId: string;
  blockingId?: string;
  firingNode: string;
  blockingNode?: string;
  triggers: Record<string, unknown>[];
  nodes: SetupDependencyNodeV1[];
}

const GTM_ID = /^GTM-[A-Z0-9]+$/i;
const BUILT_IN_TYPES = new Map([
  ["Page URL", "PAGE_URL"],
  ["Page Hostname", "PAGE_HOSTNAME"],
  ["Page Path", "PAGE_PATH"],
  ["Referrer", "REFERRER"],
  ["Click Element", "CLICK_ELEMENT"],
  ["Click Classes", "CLICK_CLASSES"],
  ["Click ID", "CLICK_ID"],
  ["Click Target", "CLICK_TARGET"],
  ["Click Text", "CLICK_TEXT"],
  ["Click URL", "CLICK_URL"],
  ["Form Element", "FORM_ELEMENT"],
  ["Form Classes", "FORM_CLASSES"],
  ["Form ID", "FORM_ID"],
  ["Form Target", "FORM_TARGET"],
  ["Form Text", "FORM_TEXT"],
  ["Form URL", "FORM_URL"],
  ["History Source", "HISTORY_SOURCE"],
  ["New History Fragment", "NEW_HISTORY_FRAGMENT"],
  ["Old History Fragment", "OLD_HISTORY_FRAGMENT"],
  ["New History State", "NEW_HISTORY_STATE"],
  ["Old History State", "OLD_HISTORY_STATE"],
]);
const TRIGGER_TYPES = new Map([
  ["page_view", "PAGEVIEW"],
  ["dom_ready", "DOM_READY"],
  ["window_loaded", "WINDOW_LOADED"],
  ["history_change", "HISTORY_CHANGE"],
  ["click", "CLICK"],
  ["form_submission", "FORM_SUBMISSION"],
  ["element_visibility", "ELEMENT_VISIBILITY"],
  ["custom_data_layer", "CUSTOM_EVENT"],
]);
const CONDITION_TYPES = new Map([
  ["equals", "EQUALS"],
  ["contains", "CONTAINS"],
  ["starts_with", "STARTS_WITH"],
  ["ends_with", "ENDS_WITH"],
  ["matches_regex", "MATCH_REGEX"],
]);
const FIRING_OPTIONS = new Map([
  ["once_per_event", "ONCE_PER_EVENT"],
  ["once_per_page", "ONCE_PER_PAGE"],
  ["unlimited", "UNLIMITED"],
]);
const AUTO_EVENT_SOURCES = new Set(["click", "form_submission", "element_visibility"]);

function shortHash(value: string): string {
  let first = 2166136261;
  let second = 2246822519;
  for (const character of value) {
    const code = character.charCodeAt(0);
    first = Math.imul(first ^ code, 16777619);
    second = Math.imul(second ^ code, 3266489917);
  }
  return `${(first >>> 0).toString(16)}${(second >>> 0).toString(16)}`.slice(0, 12);
}

function template(key: string | undefined, value: string): GtmParameter {
  return { type: "TEMPLATE", ...(key ? { key } : {}), value };
}

function booleanParam(key: string | undefined, value: boolean): GtmParameter {
  return { type: "BOOLEAN", ...(key ? { key } : {}), value: String(value) };
}

function scalarParam(
  value: string | number | boolean,
  key?: string,
): GtmParameter {
  if (typeof value === "boolean") {
    return booleanParam(key, value);
  }
  if (typeof value === "number" && Number.isInteger(value)) {
    return { type: "INTEGER", ...(key ? { key } : {}), value: String(value) };
  }
  return template(key, String(value));
}

function variableNode(source: VariableSourceV1): string {
  return source.type === "built_in_variable"
    ? `builtInVariable:${source.name}`
    : `variable:${source.name}`;
}

function variableText(source: VariableSourceV1): string {
  return `{{${source.name}}}`;
}

function addVariable(
  source: VariableSourceV1,
  collection: VariableCollection,
): void {
  if (source.type === "built_in_variable") {
    const type = BUILT_IN_TYPES.get(source.name);
    if (!type) {
      throw new Error(`Unsupported built-in variable ${source.name}.`);
    }
    collection.builtIns.set(source.name, type);
    return;
  }

  if (source.type === "data_layer_variable") {
    const existing = collection.dataLayer.get(source.name);
    if (existing !== undefined && existing !== source.key) {
      throw new Error(`Variable ${source.name} has conflicting definitions.`);
    }
    collection.dataLayer.set(source.name, source.key);
    return;
  }

  const existing = collection.constants.get(source.name);
  if (existing !== undefined && existing !== source.value) {
    throw new Error(`Variable ${source.name} has conflicting definitions.`);
  }
  collection.constants.set(source.name, source.value);
}

function collectValue(
  value: TemplateValueV1,
  collection: VariableCollection,
): void {
  if (value.type === "built_in_variable" || value.type === "data_layer_variable" || value.type === "constant") {
    addVariable(value, collection);
    return;
  }
  if (value.type === "list") {
    value.items.forEach((item) => collectValue(item, collection));
    return;
  }
  if (value.type === "map") {
    value.entries.forEach((entry) => collectValue(entry.value, collection));
  }
}

function collectFields(
  fields: TemplateFieldV1[],
  collection: VariableCollection,
): void {
  fields.forEach((field) => collectValue(field.value, collection));
}

function collectVariables(setup: TrackingSetupV1): VariableCollection {
  const collection: VariableCollection = {
    builtIns: new Map(),
    dataLayer: new Map(),
    constants: new Map(),
  };

  for (const action of setup.tagActions) {
    if (action.execution.type === "template") {
      collectFields(action.execution.fields, collection);
    }
    action.event?.parameters.forEach((parameter) => collectValue(parameter.value, collection));
  }
  for (const policy of setup.firingPolicies) {
    [...policy.include, ...policy.exclude].forEach((condition) => {
      addVariable(condition.variable, collection);
    });
    if (policy.source.selector && policy.source.type === "click") {
      addVariable({ type: "built_in_variable", name: "Click Element" }, collection);
    }
    if (policy.source.selector && policy.source.type === "form_submission") {
      addVariable({ type: "built_in_variable", name: "Form Element" }, collection);
    }
  }

  return collection;
}

function compileValue(
  value: TemplateValueV1,
  key?: string,
): GtmParameter {
  if (value.type === "literal") {
    return scalarParam(value.value, key);
  }
  if (value.type === "built_in_variable" || value.type === "data_layer_variable" || value.type === "constant") {
    return template(key, variableText(value));
  }
  if (value.type === "list") {
    return { type: "LIST", ...(key ? { key } : {}), list: value.items.map((item) => compileValue(item)) };
  }
  return {
    type: "MAP",
    ...(key ? { key } : {}),
    map: value.entries.map((entry) => compileValue(entry.value, entry.name)),
  };
}

function compileVariables(
  collection: VariableCollection,
  accountId: string,
  containerId: string,
): { variables: unknown[]; builtIns: unknown[]; nodes: SetupDependencyNodeV1[] } {
  const builtIns = [...collection.builtIns.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, type]) => ({ accountId, containerId, type, name }));
  const dataLayer = [...collection.dataLayer.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, key], index) => ({
      accountId,
      containerId,
      variableId: String(300001 + index),
      name,
      type: "v",
      notes: GTM_MANAGED_ENTITY_NOTE,
      parameter: [
        template("name", key),
        { type: "INTEGER", key: "dataLayerVersion", value: "2" } satisfies GtmParameter,
      ],
    }));
  const constants = [...collection.constants.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value], index) => ({
      accountId,
      containerId,
      variableId: String(310001 + index),
      name,
      type: "c",
      notes: GTM_MANAGED_ENTITY_NOTE,
      parameter: [scalarParam(value, "value")],
    }));
  const nodes: SetupDependencyNodeV1[] = [
    ...builtIns.map(({ name }) => ({ kind: "builtInVariable" as const, id: `builtInVariable:${name}`, dependsOn: [] })),
    ...[...dataLayer, ...constants].map(({ name }) => ({ kind: "variable" as const, id: `variable:${name}`, dependsOn: [] })),
  ];

  return { variables: [...dataLayer, ...constants], builtIns, nodes };
}

function conditionFilter(condition: FiringConditionV1): Record<string, unknown> {
  return {
    type: CONDITION_TYPES.get(condition.operator),
    parameter: [
      template("arg0", variableText(condition.variable)),
      template("arg1", condition.value),
      booleanParam("ignore_case", false),
    ],
  };
}

function selectorFilter(policy: FiringPolicyV1): Record<string, unknown> | undefined {
  if (!policy.source.selector
    || (policy.source.type !== "click" && policy.source.type !== "form_submission")) {
    return undefined;
  }
  const variable = policy.source.type === "form_submission" ? "Form Element" : "Click Element";
  return {
    type: "MATCH_CSS_SELECTOR",
    parameter: [
      template("arg0", `{{${variable}}}`),
      template("arg1", policy.source.selector),
    ],
  };
}

function triggerDependencies(
  policy: FiringPolicyV1,
  conditions: FiringConditionV1[],
): string[] {
  const dependencies = conditions.map((condition) => variableNode(condition.variable));
  if (policy.source.selector && policy.source.type === "click") {
    dependencies.push("builtInVariable:Click Element");
  }
  if (policy.source.selector && policy.source.type === "form_submission") {
    dependencies.push("builtInVariable:Form Element");
  }
  return [...new Set(dependencies)].sort();
}

function compileTrigger(
  policy: FiringPolicyV1,
  conditions: FiringConditionV1[],
  triggerId: string,
  name: string,
  accountId: string,
  containerId: string,
): Record<string, unknown> {
  const trigger: Record<string, unknown> = {
    accountId,
    containerId,
    triggerId,
    name,
    type: policy.source.type === "click" && policy.source.clickMode === "links"
      ? "JUST_LINKS"
      : TRIGGER_TYPES.get(policy.source.type),
    notes: GTM_MANAGED_ENTITY_NOTE,
  };
  const filters = conditions.map(conditionFilter);
  const selector = selectorFilter(policy);
  if (selector) {
    filters.push(selector);
  }
  if (filters.length > 0) {
    trigger[AUTO_EVENT_SOURCES.has(policy.source.type) ? "autoEventFilter" : "filter"] = filters;
  }
  if (policy.source.type === "custom_data_layer") {
    trigger.customEventFilter = [{
      type: "EQUALS",
      parameter: [
        template("arg0", "{{_event}}"),
        template("arg1", policy.source.eventName ?? ""),
      ],
    }];
  }
  if (policy.source.type === "element_visibility") {
    trigger.parameter = [
      template("selector", policy.source.selector ?? ""),
      template("selectionMethod", "CSS_SELECTOR"),
      template("minimumPercentVisible", "1"),
      template("onScreenDuration", "0"),
      template("firingFrequency", policy.source.visibilityFrequency === "every_time"
        ? "MANY_PER_ELEMENT"
        : policy.source.visibilityFrequency === "once_per_element"
          ? "ONCE_PER_ELEMENT"
          : "ONCE_PER_PAGE"),
    ];
  }
  if (policy.source.type === "click") {
    trigger.waitForTags = booleanParam(undefined, false);
    trigger.checkValidation = booleanParam(undefined, true);
  }

  return trigger;
}

function compilePolicies(
  policies: FiringPolicyV1[],
  accountId: string,
  containerId: string,
): CompiledPolicy[] {
  return [...policies]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((policy, index) => {
      const firingId = String(100001 + index * 2);
      const firingNode = `trigger:${policy.id}`;
      const firing = compileTrigger(
        policy,
        policy.include,
        firingId,
        `Firing - ${policy.id}`,
        accountId,
        containerId,
      );
      const nodes: SetupDependencyNodeV1[] = [{
        kind: "trigger",
        id: firingNode,
        dependsOn: triggerDependencies(policy, policy.include),
      }];
      if (policy.exclude.length === 0) {
        return { policy, firingId, firingNode, triggers: [firing], nodes };
      }

      const blockingId = String(100002 + index * 2);
      const blockingNode = `trigger:${policy.id}:exclusion`;
      const blocking = compileTrigger(
        policy,
        policy.exclude,
        blockingId,
        `Exclusion - ${policy.id}`,
        accountId,
        containerId,
      );
      nodes.push({
        kind: "trigger",
        id: blockingNode,
        dependsOn: triggerDependencies(policy, policy.exclude),
      });
      return {
        policy,
        firingId,
        blockingId,
        firingNode,
        blockingNode,
        triggers: [firing, blocking],
        nodes,
      };
    });
}

function actionDependencies(action: TagActionV1): string[] {
  const dependencies: string[] = [];
  const collect = (value: TemplateValueV1): void => {
    if (value.type === "built_in_variable" || value.type === "data_layer_variable" || value.type === "constant") {
      dependencies.push(variableNode(value));
      return;
    }
    if (value.type === "list") {
      value.items.forEach(collect);
    } else if (value.type === "map") {
      value.entries.forEach((entry) => collect(entry.value));
    }
  };
  if (action.execution.type === "template") {
    action.execution.fields.forEach((field) => collect(field.value));
  }
  action.event?.parameters.forEach((parameter) => collect(parameter.value));
  return [...new Set(dependencies)].sort();
}

function consentSettings(policies: CompiledPolicy[]): Record<string, unknown> {
  const required = [...new Set(policies.flatMap(({ policy }) => policy.consent.required))].sort();
  if (required.length === 0) {
    return { consentStatus: "NOT_SET" };
  }
  return {
    consentStatus: "NEEDED",
    consentType: { type: "LIST", list: required.map((type) => template(undefined, type)) },
  };
}

function compileAction(
  action: TagActionV1,
  policies: CompiledPolicy[],
  index: number,
  accountId: string,
  containerId: string,
): { tag: Record<string, unknown>; node: SetupDependencyNodeV1 } {
  const policyById = new Map(policies.map((policy) => [policy.policy.id, policy]));
  const referenced = action.firingPolicyIds.map((id) => policyById.get(id));
  if (referenced.some((policy) => !policy)) {
    throw new Error(`Tag action ${action.id} has an unresolved firing policy.`);
  }
  const resolved = referenced as CompiledPolicy[];
  const frequencies = new Set(resolved.map(({ policy }) => policy.frequency));
  if (frequencies.size !== 1) {
    throw new Error(`Tag action ${action.id} references incompatible firing frequencies.`);
  }

  const parameters: GtmParameter[] = [];
  let type: string;
  if (action.execution.type === "custom_html") {
    type = "html";
    parameters.push(template("html", action.execution.html));
    parameters.push(booleanParam("supportDocumentWrite", false));
  } else {
    type = action.execution.templateId === "google.analytics.ga4_event"
      ? "gaawe"
      : action.execution.templateId;
    parameters.push(...action.execution.fields.map((field) => compileValue(field.value, field.name)));
  }

  if (action.execution.type === "template"
    && action.execution.templateId === "google.analytics.ga4_event") {
    if (!action.event || action.destination.type !== "ga4") {
      throw new Error(`GA4 event action ${action.id} requires an event and GA4 destination.`);
    }
    parameters.push(template("eventName", action.event.name));
    parameters.push(template("measurementId", action.destination.measurementId.toUpperCase()));
    parameters.push({
      type: "LIST",
      key: "eventParameters",
      list: action.event.parameters.map((parameter) => ({
        type: "MAP",
        map: [
          template("name", parameter.name),
          compileValue(parameter.value, "value"),
        ],
      })),
    });
  }

  const frequency = resolved[0]?.policy.frequency;
  const dependsOn = [
    ...actionDependencies(action),
    ...resolved.flatMap((policy) => [
      policy.firingNode,
      ...(policy.blockingNode ? [policy.blockingNode] : []),
    ]),
  ];
  return {
    tag: {
      accountId,
      containerId,
      tagId: String(200001 + index),
      name: action.name,
      type,
      parameter: parameters,
      firingTriggerId: resolved.map(({ firingId }) => firingId),
      blockingTriggerId: resolved.flatMap(({ blockingId }) => blockingId ? [blockingId] : []),
      tagFiringOption: FIRING_OPTIONS.get(frequency ?? "once_per_event"),
      monitoringMetadata: { type: "MAP", map: [] },
      consentSettings: consentSettings(resolved),
      notes: GTM_MANAGED_ENTITY_NOTE,
    },
    node: {
      kind: "tag",
      id: `tag:${action.id}`,
      dependsOn: [...new Set(dependsOn)].sort(),
    },
  };
}

function validateContainer(container: ContainerContext): void {
  if (!container.accountId || !container.containerId) {
    throw new Error("Container accountId and containerId are required.");
  }
  if (!GTM_ID.test(container.publicId)) {
    throw new Error("Container publicId must look like GTM-XXXXXXX.");
  }
}

export function compileTrackingSetup(
  setup: TrackingSetupV1,
  container: ContainerContext,
): CompiledTrackingSetupV1 {
  assertTrackingSetup(setup);
  if (setup.status !== "confirmed") {
    throw new Error("Compiler requires a confirmed tracking setup.");
  }
  validateContainer(container);

  const collection = collectVariables(setup);
  const compiledVariables = compileVariables(collection, container.accountId, container.containerId);
  const compiledPolicies = compilePolicies(setup.firingPolicies, container.accountId, container.containerId);
  const compiledActions = [...setup.tagActions]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((action, index) => compileAction(
      action,
      compiledPolicies,
      index,
      container.accountId,
      container.containerId,
    ));
  const base = `accounts/${container.accountId}/containers/${container.containerId}`;
  const fingerprint = `compiled_${shortHash(JSON.stringify({ setup, container }))}`;

  return {
    schemaVersion: SETUP_COMPILER_VERSION,
    setupId: setup.id,
    fingerprint,
    dependencyOrder: [
      ...compiledVariables.nodes,
      ...compiledPolicies.flatMap(({ nodes }) => nodes),
      ...compiledActions.map(({ node }) => node),
    ],
    containerFile: {
      exportFormatVersion: 2,
      exportTime: new Date().toISOString(),
      containerVersion: {
        path: `${base}/versions/0`,
        accountId: container.accountId,
        containerId: container.containerId,
        containerVersionId: "0",
        name: `GTM Observability - ${setup.id}`,
        description: `${GTM_MANAGED_ENTITY_NOTE}. ${setup.intent.statement}`,
        container: {
          path: base,
          accountId: container.accountId,
          containerId: container.containerId,
          name: container.name || "GTM Observability import",
          publicId: container.publicId,
          usageContext: ["WEB"],
        },
        tag: compiledActions.map(({ tag }) => tag),
        trigger: compiledPolicies.flatMap(({ triggers }) => triggers),
        variable: compiledVariables.variables,
        builtInVariable: compiledVariables.builtIns,
      },
    },
  };
}
