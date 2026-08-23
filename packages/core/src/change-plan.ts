import type { GtmContainerExport } from "./types.js";

export type GtmEntityKind = "tag" | "trigger" | "variable" | "builtInVariable";

export const GTM_MANAGED_ENTITY_NOTE = "Managed by GTM Observability";

export interface GtmEntitySet {
  tag?: unknown[];
  trigger?: unknown[];
  variable?: unknown[];
  builtInVariable?: unknown[];
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
  if (!isRecord(value)) return value;

  const result: JsonRecord = {};
  for (const [childKey, childValue] of Object.entries(value).sort(([left], [right]) => left.localeCompare(right))) {
    if (volatileKeys.has(childKey)) continue;
    if (mode === "semantic" && (childKey === "name" || identityKeys.has(childKey))) continue;
    result[childKey] = canonicalize(childValue, mode, triggerSignatures, childKey);
  }
  return result;
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

function actionForEntity(
  kind: GtmEntityKind,
  generated: JsonRecord,
  current: JsonRecord[],
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
  const equivalents = current.filter(
    (candidate) => signature(candidate, "semantic", currentTriggers) === semantic,
  );
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
  const sameName = current.filter((candidate) => entityName(kind, candidate) === generatedName);
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
  const currentTriggers = triggerSignatureMap(currentEntities);
  const actions = kinds.flatMap((kind) =>
    rawEntities(generatedEntities, kind).map((generated) =>
      actionForEntity(
        kind,
        generated,
        rawEntities(currentEntities, kind),
        generatedTriggers,
        currentTriggers,
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
