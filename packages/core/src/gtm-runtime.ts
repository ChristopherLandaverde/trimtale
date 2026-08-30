export type GtmRuntimeObservation =
  | { status: "detected"; containerIds: string[] }
  | { status: "not_detected"; containerIds: [] }
  | { status: "inconclusive"; containerIds: []; reason: string };

export interface GtmRuntimeSignals {
  inspectionAvailable: boolean;
  scriptUrls: string[];
  runtimeKeys?: string[];
}

const containerIdPattern = /\bGTM-[A-Z0-9]+\b/gi;

export function observeGtmRuntime(signals: GtmRuntimeSignals): GtmRuntimeObservation {
  if (!signals.inspectionAvailable) {
    return { status: "inconclusive", containerIds: [], reason: "Page runtime could not be inspected" };
  }
  const containerIds = new Set<string>();
  for (const value of [...signals.scriptUrls, ...(signals.runtimeKeys ?? [])]) {
    for (const match of value.matchAll(containerIdPattern)) containerIds.add(match[0].toUpperCase());
  }
  return containerIds.size > 0
    ? { status: "detected", containerIds: [...containerIds].sort() }
    : { status: "not_detected", containerIds: [] };
}
