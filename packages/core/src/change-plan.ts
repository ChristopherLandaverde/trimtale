import type { GtmContainerExport } from "./types.js";

export type GtmEntityKind = "tag" | "trigger" | "variable" | "builtInVariable";

export const GTM_MANAGED_ENTITY_NOTE = "Managed by GTM Observability";

export interface GtmEntitySet {
  tag?: unknown[];
  trigger?: unknown[];
  variable?: unknown[];
  builtInVariable?: unknown[];
}

export interface ContainerInventoryV1 {
  schemaVersion: 1;
  fingerprint: string;
  totalEntityCount: number;
  managedEntityCount: number;
  counts: Record<GtmEntityKind, number>;
}

export type TrackingChangeAction = {
  kind: GtmEntityKind;
  generatedName: string;
  entitySignature: string;
  existingId?: string;
} & (
  | { action: "create" | "reuse" | "no_op" }
  | { action: "update"; existingId: string }
  | { action: "conflict"; reason: "ambiguous_equivalent" | "name_collision" | "malformed_generated_entity" }
);

export interface TrackingChangePlan {
  schemaVersion: 1;
  status: "ready" | "conflict";
  fingerprint: string;
  actions: TrackingChangeAction[];
}

type CanonicalMode = "exact" | "semantic";
type JsonRecord = Record<string, unknown>;

const kinds: GtmEntityKind[] = ["trigger", "tag", "variable", "builtInVariable"];
const volatileKeys = new Set([
  "accountId",
  "containerId",
  "containerVersionId",
  "fingerprint",
  "notes",
  "parentFolderId",
  "path",
  "tagManagerUrl",
  "workspaceId",
]);
const identityKeys = new Set(["tagId", "triggerId", "variableId"]);
const emptyDefaultParameterKeys = new Set(["uniqueTriggerId", "waitForTagsTimeout"]);
const propertyAliases = new Map([
  ["autoEventFilter", "filter"],
]);
const parameterKeyAliases = new Map([
  ["measurementId", "measurementIdOverride"],
  ["eventParameters", "eventSettingsTable"],
  ["name", "parameter"],
  ["value", "parameterValue"],
]);
const gtmValueAliases = new Map([
  ["BOOLEAN", "boolean"],
  ["CLICK_TEXT", "clickText"],
  ["CLICK_URL", "clickUrl"],
  ["CLICK_ELEMENT", "clickElement"],
  ["CSS_SELECTOR", "cssSelector"],
  ["CUSTOM_EVENT", "customEvent"],
  ["ELEMENT_VISIBILITY", "elementVisibility"],
  ["EQUALS", "equals"],
  ["JUST_LINKS", "linkClick"],
  ["LIST", "list"],
  ["MAP", "map"],
  ["MATCH_REGEX", "matchRegex"],
  ["NOT_SET", "notSet"],
  ["ONCE_PER_EVENT", "oncePerEvent"],
  ["ONCE_PER_PAGE", "oncePerPage"],
  ["PAGE_URL", "pageUrl"],
  ["PAGEVIEW", "pageview"],
  ["TEMPLATE", "template"],
]);

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stableJson(value: unknown): string {
  return JSON.stringify(value);
}

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

export function fingerprintTrackingChangeActions(actions: TrackingChangeAction[]): string {
  const input = actions.map(({ existingId: _existingId, ...action }) => action);
  return `plan_${shortHash(stableJson(input))}`;
}

function canonicalize(
  value: unknown,
  mode: CanonicalMode,
  triggerSignatures: Map<string, string>,
  key?: string,
): unknown {
  if (Array.isArray(value)) {
    const items = key === "firingTriggerId" && mode === "semantic"
      ? value.map((item) => {
          const id = String(item);
          return triggerSignatures.get(id) ?? `unresolved-trigger:${id}`;
        })
      : value.map((item) => canonicalize(item, mode, triggerSignatures));
    return items.sort((left, right) => stableJson(left).localeCompare(stableJson(right)));
  }
  if (!isRecord(value)) {
    if (typeof value !== "string") return value;
    if (key === "key") return parameterKeyAliases.get(value) ?? value;
    return gtmValueAliases.get(value) ?? value;
  }

  const result: JsonRecord = {};
  for (const [childKey, childValue] of Object.entries(value).sort(([left], [right]) =>
    (propertyAliases.get(left) ?? left).localeCompare(propertyAliases.get(right) ?? right))) {
    if (volatileKeys.has(childKey)) continue;
    if (emptyDefaultParameterKeys.has(childKey) && emptyTemplateParameter(childValue)) continue;
    if ((childKey === "map" || childKey === "list")
      && Array.isArray(childValue) && childValue.length === 0) continue;
    if (mode === "semantic" && (childKey === "name" || identityKeys.has(childKey))) continue;
    const canonicalKey = propertyAliases.get(childKey) ?? childKey;
    result[canonicalKey] = canonicalize(childValue, mode, triggerSignatures, childKey);
  }
  return result;
}

function emptyTemplateParameter(value: unknown): boolean {
  if (!isRecord(value) || !["TEMPLATE", "template"].includes(String(value.type))) return false;
  return Object.entries(value).every(([key, child]) => key === "type" || child === "" || child === undefined);
}

function entityName(kind: GtmEntityKind, entity: JsonRecord): string {
  if (typeof entity.name === "string" && entity.name.trim()) return entity.name.trim();
  if (kind === "builtInVariable" && typeof entity.type === "string") return entity.type;
  return "Unnamed entity";
}

function entityId(kind: GtmEntityKind, entity: JsonRecord): string | undefined {
  const key = kind === "tag" ? "tagId" : kind === "trigger" ? "triggerId" : kind === "variable" ? "variableId" : undefined;
  const value = key ? entity[key] : undefined;
  return typeof value === "string" ? value : undefined;
}

function rawEntities(set: GtmEntitySet, kind: GtmEntityKind): JsonRecord[] {
  return (set[kind] ?? []).filter(isRecord);
}

function triggerSignatureMap(set: GtmEntitySet): Map<string, string> {
  const signatures = new Map<string, string>();
  for (const trigger of rawEntities(set, "trigger")) {
    const id = entityId("trigger", trigger);
    if (!id) continue;
    signatures.set(id, stableJson(canonicalize(trigger, "semantic", new Map())));
  }
  return signatures;
}

function signature(
  entity: JsonRecord,
  mode: CanonicalMode,
  triggerSignatures: Map<string, string>,
): string {
  return stableJson(canonicalize(entity, mode, triggerSignatures));
}

interface IndexedEntityKind {
  bySemanticSignature: Map<string, JsonRecord[]>;
  byName: Map<string, JsonRecord[]>;
}

interface IndexedContainer {
  summary: ContainerInventoryV1;
  triggerSignatures: Map<string, string>;
  kinds: Map<GtmEntityKind, IndexedEntityKind>;
}

function indexContainer(currentEntities: GtmEntitySet): IndexedContainer {
  const triggers = triggerSignatureMap(currentEntities);
  const counts = Object.fromEntries(
    kinds.map((kind) => [kind, rawEntities(currentEntities, kind).length]),
  ) as Record<GtmEntityKind, number>;
  const canonicalEntities = kinds.flatMap((kind) => rawEntities(currentEntities, kind)
    .map((entity) => `${kind}:${signature(entity, "exact", triggers)}`)
    .sort());
  const all = kinds.flatMap((kind) => rawEntities(currentEntities, kind));
  const summary: ContainerInventoryV1 = {
    schemaVersion: 1,
    fingerprint: `inventory_${shortHash(stableJson(canonicalEntities))}`,
    totalEntityCount: Object.values(counts).reduce((total, count) => total + count, 0),
    managedEntityCount: all.filter((entity) => entity.notes === GTM_MANAGED_ENTITY_NOTE).length,
    counts,
  };
  const indexedKinds = new Map<GtmEntityKind, IndexedEntityKind>();
  for (const kind of kinds) {
    const entities = rawEntities(currentEntities, kind);
    const bySemanticSignature = new Map<string, JsonRecord[]>();
    const byName = new Map<string, JsonRecord[]>();
    for (const entity of entities) {
      const semantic = signature(entity, "semantic", triggers);
      bySemanticSignature.set(semantic, [...(bySemanticSignature.get(semantic) ?? []), entity]);
      const name = entityName(kind, entity);
      byName.set(name, [...(byName.get(name) ?? []), entity]);
    }
    indexedKinds.set(kind, { bySemanticSignature, byName });
  }
  return { summary, triggerSignatures: triggers, kinds: indexedKinds };
}

export function createContainerInventory(currentEntities: GtmEntitySet): ContainerInventoryV1 {
  return indexContainer(currentEntities).summary;
}

function actionForEntity(
  kind: GtmEntityKind,
  generated: JsonRecord,
  current: IndexedEntityKind,
  generatedTriggers: Map<string, string>,
  currentTriggers: Map<string, string>,
): TrackingChangeAction {
  const generatedName = entityName(kind, generated);
  if (typeof generated.type !== "string") {
    return {
      kind,
      generatedName,
      action: "conflict",
      reason: "malformed_generated_entity",
      entitySignature: shortHash(stableJson(generated)),
    };
  }

  const semantic = signature(generated, "semantic", generatedTriggers);
  const exact = signature(generated, "exact", generatedTriggers);
  const equivalents = current.bySemanticSignature.get(semantic) ?? [];
  const common = { kind, generatedName, entitySignature: shortHash(semantic) };

  if (equivalents.length > 1) {
    return { ...common, action: "conflict", reason: "ambiguous_equivalent" };
  }
  const equivalent = equivalents[0];
  if (equivalent) {
    const existingId = entityId(kind, equivalent);
    const action = signature(equivalent, "exact", currentTriggers) === exact ? "no_op" : "reuse";
    return { ...common, action, ...(existingId ? { existingId } : {}) };
  }
  const sameName = current.byName.get(generatedName) ?? [];
  if (sameName.length === 1 && kind !== "builtInVariable"
    && sameName[0]?.notes === GTM_MANAGED_ENTITY_NOTE) {
    const existingId = entityId(kind, sameName[0]);
    if (existingId) return { ...common, action: "update", existingId };
  }
  if (sameName.length > 0) {
    return { ...common, action: "conflict", reason: "name_collision" };
  }
  return { ...common, action: "create" };
}

export function createTrackingChangePlan(
  generatedSetup: GtmContainerExport,
  currentEntities: GtmEntitySet,
): TrackingChangePlan {
  const generatedEntities = generatedSetup.containerVersion;
  const generatedTriggers = triggerSignatureMap(generatedEntities);
  const current = indexContainer(currentEntities);
  const actions = kinds.flatMap((kind) =>
    rawEntities(generatedEntities, kind).map((generated) =>
      actionForEntity(
        kind,
        generated,
        current.kinds.get(kind)!,
        generatedTriggers,
        current.triggerSignatures,
      )),
  ).sort((left, right) =>
    kinds.indexOf(left.kind) - kinds.indexOf(right.kind)
      || left.generatedName.localeCompare(right.generatedName)
      || left.entitySignature.localeCompare(right.entitySignature));

  return {
    schemaVersion: 1,
    status: actions.some(({ action }) => action === "conflict") ? "conflict" : "ready",
    fingerprint: fingerprintTrackingChangeActions(actions),
    actions,
  };
}
