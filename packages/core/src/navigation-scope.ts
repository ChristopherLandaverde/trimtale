import type { NavigationArea, NavigationElement } from "./types.js";

export const NAVIGATION_SCOPE_SCHEMA_VERSION = 1 as const;

export interface NavigationTargetGroupV1 {
  id: string;
  label: string;
  area: NavigationArea;
  targetIds: string[];
  targetCount: number;
}

export interface NavigationScopeV1 {
  schemaVersion: typeof NAVIGATION_SCOPE_SCHEMA_VERSION;
  includedGroupIds: string[];
  excludedGroupIds: string[];
  targetIds: string[];
  practitionerConfirmed: true;
}

export interface NavigationScopeModelGroupV1 {
  id: string;
  label: string;
  area: NavigationArea;
  targetCount: number;
}

export interface NavigationScopeInterpretationInputV1 {
  schemaVersion: typeof NAVIGATION_SCOPE_SCHEMA_VERSION;
  messages: string[];
  groups: NavigationScopeModelGroupV1[];
}

export type NavigationScopeAmbiguity = "scope" | "missing_target" | "confirmation_required";

export interface NavigationScopeInterpretationV1 {
  schemaVersion: typeof NAVIGATION_SCOPE_SCHEMA_VERSION;
  candidateGroupIds: string[];
  ambiguities: NavigationScopeAmbiguity[];
  clarification: string | null;
  authority: {
    canConfirmScope: false;
    canWriteGtm: false;
    canOutputSelectors: false;
  };
}

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const areaOrder: NavigationArea[] = ["header", "nav", "footer", "unknown"];

function unsafeGroupLabel(value: string): boolean {
  return /[<>\u0000-\u001f\u007f]/.test(value)
    || /\b(?:ignore|disregard|override)\b.{0,40}\b(?:instruction|prompt|system|developer)\b/i.test(value);
}

function normalizedText(value: string, fallback: string): string {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > 0 && !unsafeGroupLabel(text) ? text.slice(0, 120) : fallback;
}

function fallbackGroup(area: NavigationArea): { id: string; label: string } {
  return {
    id: `navigation_area_${area}`,
    label: area === "header" ? "Header navigation"
      : area === "footer" ? "Footer navigation"
        : area === "nav" ? "Navigation"
          : "Unclassified navigation",
  };
}

export function sanitizeNavigationScopeMessage(value: string): string {
  return value
    .replace(/\bhttps?:\/\/\S+/gi, "[redacted]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted]")
    .replace(/\b(?:sk-|AIza|ya29\.)[A-Za-z0-9._-]{10,}\b/g, "[redacted]")
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, "[redacted]")
    .replace(/\b\d{7,}\b/g, "[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1_000);
}

export function discoverNavigationTargetGroups(
  navigation: readonly NavigationElement[],
): NavigationTargetGroupV1[] {
  const groups = new Map<string, NavigationTargetGroupV1>();
  for (const target of navigation) {
    const fallback = fallbackGroup(target.area);
    const requestedId = target.groupId?.trim();
    const id = requestedId && IDENTIFIER.test(requestedId) ? requestedId : fallback.id;
    const label = normalizedText(target.groupLabel ?? "", fallback.label);
    const current = groups.get(id);
    if (!current) {
      groups.set(id, { id, label, area: target.area, targetIds: [target.id], targetCount: 1 });
      continue;
    }
    if (!current.targetIds.includes(target.id)) current.targetIds.push(target.id);
    current.targetCount = current.targetIds.length;
  }
  return [...groups.values()]
    .map((group) => ({ ...group, targetIds: [...group.targetIds].sort() }))
    .sort((left, right) => areaOrder.indexOf(left.area) - areaOrder.indexOf(right.area)
      || left.label.localeCompare(right.label)
      || left.id.localeCompare(right.id));
}

export function createNavigationScopeInterpretationInput(
  messages: readonly string[],
  groups: readonly NavigationTargetGroupV1[],
): NavigationScopeInterpretationInputV1 {
  const input = {
    schemaVersion: NAVIGATION_SCOPE_SCHEMA_VERSION,
    messages: messages.map(sanitizeNavigationScopeMessage).filter(Boolean),
    groups: groups.map(({ id, label, area, targetCount }) => ({ id, label, area, targetCount })),
  };
  const errors = validateNavigationScopeInterpretationInput(input);
  if (errors.length > 0) throw new Error(errors.join(" "));
  return input;
}

export function createConfirmedNavigationScope(
  groups: readonly NavigationTargetGroupV1[],
  includedGroupIds: readonly string[],
): NavigationScopeV1 {
  const known = new Map(groups.map((group) => [group.id, group]));
  const included = [...new Set(includedGroupIds)].sort();
  if (included.length === 0 || included.some((id) => !known.has(id))) {
    throw new Error("Navigation scope must reference observed target groups.");
  }
  return {
    schemaVersion: NAVIGATION_SCOPE_SCHEMA_VERSION,
    includedGroupIds: included,
    excludedGroupIds: groups.map(({ id }) => id).filter((id) => !included.includes(id)).sort(),
    targetIds: included.flatMap((id) => known.get(id)?.targetIds ?? []).filter((id, index, all) =>
      all.indexOf(id) === index).sort(),
    practitionerConfirmed: true,
  };
}

export function validateNavigationScope(
  value: unknown,
  groups?: readonly NavigationTargetGroupV1[],
): string[] {
  if (!isRecord(value)) return ["navigation scope must be an object"];
  const errors = unexpectedKeys(
    value,
    ["schemaVersion", "includedGroupIds", "excludedGroupIds", "targetIds", "practitionerConfirmed"],
    "navigationScope",
  );
  if (value.schemaVersion !== 1) errors.push("navigationScope.schemaVersion must be 1");
  const arrays = ["includedGroupIds", "excludedGroupIds", "targetIds"] as const;
  for (const key of arrays) {
    const items = value[key];
    if (!Array.isArray(items) || (key === "includedGroupIds" && items.length === 0)
      || items.some((item) => typeof item !== "string" || !IDENTIFIER.test(item))
      || new Set(items).size !== items.length) {
      errors.push(`navigationScope.${key} is invalid`);
    }
  }
  if (value.practitionerConfirmed !== true) errors.push("navigationScope requires practitioner confirmation");
  if (Array.isArray(value.includedGroupIds) && Array.isArray(value.excludedGroupIds)
    && value.includedGroupIds.some((id) => (value.excludedGroupIds as unknown[]).includes(id))) {
    errors.push("navigationScope included and excluded groups must be disjoint");
  }
  if (groups && errors.length === 0) {
    const expectedIds = groups.map(({ id }) => id).sort();
    const suppliedIds = [
      ...(value.includedGroupIds as string[]),
      ...(value.excludedGroupIds as string[]),
    ].sort();
    if (JSON.stringify(expectedIds) !== JSON.stringify(suppliedIds)) {
      errors.push("navigationScope must classify every observed group exactly once");
    }
    const included = new Set(value.includedGroupIds as string[]);
    const expectedTargets = groups.filter(({ id }) => included.has(id)).flatMap(({ targetIds }) => targetIds).sort();
    const suppliedTargets = [...(value.targetIds as string[])].sort();
    if (JSON.stringify(expectedTargets) !== JSON.stringify(suppliedTargets)) {
      errors.push("navigationScope targets must match included groups");
    }
  }
  return errors;
}

function normalizedMessages(messages: readonly string[]): string {
  return messages.join(" ").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function shouldUseLocalNavigationScopeInterpretation(messages: readonly string[]): boolean {
  const message = normalizedMessages(messages);
  return /\b(top|bottom|main|primary|secondary|utility|legal|social|logo|sticky|desktop|mobile|hamburger|drawer|sidebar)\b/.test(message);
}

function excluded(message: string, term: string): boolean {
  return new RegExp(`\\b(?:not|exclude|excluding|without)\\s+(?:the\\s+)?${term}\\b`).test(message);
}

function joinedLabels(groups: readonly { label: string }[]): string {
  if (groups.length === 1) return groups[0]!.label;
  if (groups.length === 2) return `${groups[0]!.label}, ${groups[1]!.label}, or both`;
  return `${groups.slice(0, -1).map(({ label }) => label).join(", ")}, or ${groups.at(-1)!.label}`;
}

export function navigationScopeClarificationForCandidates(
  groups: readonly { id: string; label: string }[],
  candidateGroupIds: readonly string[],
): string {
  if (groups.length === 0) return "No observable navigation group is available.";
  const candidates = new Set(candidateGroupIds);
  const included = groups.filter(({ id }) => candidates.has(id));
  if (included.length === 0) return `Should this cover ${joinedLabels(groups)}?`;
  const excluded = groups.filter(({ id }) => !candidates.has(id));
  return excluded.length > 0
    ? `Confirm ${included.map(({ label }) => label).join(" and ")} and exclude ${excluded.map(({ label }) => label).join(" and ")}?`
    : `Confirm ${included.map(({ label }) => label).join(" and ")}?`;
}

export function interpretNavigationScopeDeterministically(
  messages: readonly string[],
  groups: readonly NavigationTargetGroupV1[],
): NavigationScopeInterpretationV1 {
  const authority = { canConfirmScope: false, canWriteGtm: false, canOutputSelectors: false } as const;
  if (groups.length === 0) {
    return {
      schemaVersion: 1,
      candidateGroupIds: [],
      ambiguities: ["missing_target"],
      clarification: null,
      authority,
    };
  }
  const message = normalizedMessages(messages);
  const explicitlyExcluded = groups.filter((group) =>
    excluded(message, group.area === "nav" ? "navigation" : group.area)
    || excluded(message, group.label.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()));
  let selected = groups.filter((group) => {
    if (explicitlyExcluded.some(({ id }) => id === group.id)) return false;
    const label = group.label.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    return message.includes(label)
      || (group.area !== "nav" && group.area !== "unknown" && new RegExp(`\\b${group.area}\\b`).test(message));
  });
  if (/\b(?:all|every|both)\b/.test(message)) {
    selected = groups.filter((group) => !explicitlyExcluded.some(({ id }) => id === group.id));
  }
  if (selected.length === 0 && groups.length === 1 && explicitlyExcluded.length === 0) selected = [groups[0]!];
  if (selected.length === 0) {
    return {
      schemaVersion: 1,
      candidateGroupIds: [],
      ambiguities: ["scope"],
      clarification: navigationScopeClarificationForCandidates(groups, []),
      authority,
    };
  }
  const included = selected.map(({ id }) => id).sort();
  return {
    schemaVersion: 1,
    candidateGroupIds: included,
    ambiguities: ["confirmation_required"],
    clarification: navigationScopeClarificationForCandidates(groups, included),
    authority,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unexpectedKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  path: string,
): string[] {
  const allowed = new Set(expected);
  return Object.keys(value).filter((key) => !allowed.has(key)).map((key) => `${path}.${key} is not allowed`);
}

export function validateNavigationScopeInterpretationInput(value: unknown): string[] {
  if (!isRecord(value)) return ["navigation scope interpretation input must be an object"];
  const errors = unexpectedKeys(value, ["schemaVersion", "messages", "groups"], "input");
  if (value.schemaVersion !== 1) errors.push("schemaVersion must be 1");
  if (!Array.isArray(value.messages)
    || value.messages.length < 1
    || value.messages.length > 8
    || value.messages.some((message) => typeof message !== "string"
      || message.trim().length === 0 || message.length > 1_000)) {
    errors.push("messages are invalid");
  } else if (value.messages.some((message) => {
    const normalized = message.replace(/\s+/g, " ").trim();
    return sanitizeNavigationScopeMessage(message) !== normalized;
  })) {
    errors.push("messages contain unredacted private values");
  }
  if (!Array.isArray(value.groups) || value.groups.length < 1 || value.groups.length > 20) {
    errors.push("groups must contain between 1 and 20 items");
  } else {
    const ids: string[] = [];
    value.groups.forEach((group, index) => {
      if (!isRecord(group)) {
        errors.push(`groups[${index}] is invalid`);
        return;
      }
      errors.push(...unexpectedKeys(group, ["id", "label", "area", "targetCount"], `groups[${index}]`));
      if (typeof group.id !== "string" || !IDENTIFIER.test(group.id)) errors.push(`groups[${index}].id is invalid`);
      else ids.push(group.id);
      if (typeof group.label !== "string" || group.label.trim().length === 0
        || group.label.length > 120 || unsafeGroupLabel(group.label)) {
        errors.push(`groups[${index}].label is invalid`);
      }
      if (!areaOrder.includes(group.area as NavigationArea)) errors.push(`groups[${index}].area is invalid`);
      if (!Number.isSafeInteger(group.targetCount) || Number(group.targetCount) < 1 || Number(group.targetCount) > 1_000) {
        errors.push(`groups[${index}].targetCount is invalid`);
      }
    });
    if (new Set(ids).size !== ids.length) errors.push("group IDs must be unique");
  }
  return errors;
}

export function validateNavigationScopeInterpretation(
  value: unknown,
  groups: readonly { id: string }[],
): string[] {
  if (!isRecord(value)) return ["navigation scope interpretation must be an object"];
  const errors = unexpectedKeys(
    value,
    ["schemaVersion", "candidateGroupIds", "ambiguities", "clarification", "authority"],
    "interpretation",
  );
  if (value.schemaVersion !== 1) errors.push("schemaVersion must be 1");
  const knownIds = new Set(groups.map(({ id }) => id));
  if (!Array.isArray(value.candidateGroupIds)
    || value.candidateGroupIds.length > groups.length
    || value.candidateGroupIds.some((id) => typeof id !== "string" || !knownIds.has(id))
    || new Set(value.candidateGroupIds).size !== value.candidateGroupIds.length) {
    errors.push("candidateGroupIds must reference supplied groups");
  }
  const validAmbiguities = new Set(["scope", "missing_target", "confirmation_required"]);
  if (!Array.isArray(value.ambiguities)
    || value.ambiguities.length > 3
    || value.ambiguities.some((item) => !validAmbiguities.has(String(item)))) {
    errors.push("ambiguities are invalid");
  }
  if (Array.isArray(value.candidateGroupIds) && Array.isArray(value.ambiguities)) {
    const hasCandidates = value.candidateGroupIds.length > 0;
    const hasUnresolvedScope = value.ambiguities.includes("scope") || value.ambiguities.includes("missing_target");
    const requiresConfirmation = value.ambiguities.includes("confirmation_required");
    if ((hasCandidates && (hasUnresolvedScope || !requiresConfirmation))
      || (!hasCandidates && requiresConfirmation)) {
      errors.push("candidate groups and ambiguities are contradictory");
    }
  }
  if (value.clarification !== null
    && (typeof value.clarification !== "string"
      || value.clarification.trim().length === 0
      || value.clarification.length > 240)) {
    errors.push("clarification is invalid");
  }
  if (!isRecord(value.authority)
    || value.authority.canConfirmScope !== false
    || value.authority.canWriteGtm !== false
    || value.authority.canOutputSelectors !== false) {
    errors.push("authority must remain non-authoritative");
  }
  return errors;
}

export function isNavigationScopeInterpretationV1(
  value: unknown,
  groups: readonly { id: string }[],
): value is NavigationScopeInterpretationV1 {
  return validateNavigationScopeInterpretation(value, groups).length === 0;
}
