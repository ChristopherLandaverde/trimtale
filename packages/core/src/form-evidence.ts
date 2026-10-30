import { assertTrackingRunEvidence, type SuccessEvidence, type TrackingRunEvidenceV1 } from "./contracts.js";

export interface RawFormRunObservation {
  runId: string;
  specificationId: string;
  startedAt: string;
  transport: "native" | "redirect" | "ajax" | "spa" | "unobservable";
  targetId: string;
  submitAttempted: boolean;
  submissionResult: "success" | "validation_error" | "server_error" | "unknown";
  outcomeObserved: boolean;
  outcomeObservable: boolean;
  outcomeEvidenceType?: SuccessEvidence["type"];
  dataLayerEvents: unknown[];
  tagFired: boolean | null;
  networkUrls: string[];
  consent: "granted" | "denied" | "unknown";
}

const safeEventName = /^[A-Za-z][A-Za-z0-9_]{0,79}$/;
const safeIdentifier = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const allowedRequestParameters = new Set(["v", "tid", "en", "ep.form_id", "ep.form_name", "ep.page_location", "dl", "gcs"]);

function safeDataLayerEvents(events: unknown[]): unknown[] {
  return events.flatMap((value) => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return [];
    const source = value as Record<string, unknown>;
    if (typeof source.event !== "string" || !safeEventName.test(source.event)) return [];
    const result: Record<string, string> = { event: source.event };
    for (const key of ["form_id", "form_name"]) {
      if (typeof source[key] === "string" && safeIdentifier.test(source[key])) result[key] = source[key];
    }
    return [result];
  });
}

export function safeRequestUrl(value: string): string | undefined {
  try {
    const source = new URL(value);
    if (!/(?:^|\.)google-analytics\.com$|(?:^|\.)analytics\.google\.com$/.test(source.hostname) && source.hostname !== "127.0.0.1") return undefined;
    if (!source.pathname.endsWith("/g/collect")) return undefined;
    const output = new URL(`${source.protocol}//${source.host}${source.pathname}`);
    for (const [key, parameter] of source.searchParams) {
      if (!allowedRequestParameters.has(key)) continue;
      let safeParameter = parameter;
      if (key === "ep.page_location" || key === "dl") {
        try {
          const page = new URL(parameter);
          safeParameter = `${page.origin}${page.pathname}`;
        } catch {
          continue;
        }
      }
      if (safeParameter.length <= 256) output.searchParams.append(key, safeParameter);
    }
    return output.toString();
  } catch {
    return undefined;
  }
}

export function normalizeFormRunEvidence(
  raw: RawFormRunObservation,
  verdict: TrackingRunEvidenceV1["verdict"],
): TrackingRunEvidenceV1 {
  const evidence: TrackingRunEvidenceV1 = {
    schemaVersion: 1,
    runId: raw.runId,
    specificationId: raw.specificationId,
    startedAt: raw.startedAt,
    observations: {
      interaction: { type: "form_submission", targetId: raw.targetId, attempted: raw.submitAttempted, submissionResult: raw.submissionResult },
      outcome: {
        observed: raw.outcomeObserved,
        observable: raw.outcomeObservable,
        ...(raw.outcomeEvidenceType ? { evidenceType: raw.outcomeEvidenceType } : {}),
      },
      dataLayer: { matchingEvents: safeDataLayerEvents(raw.dataLayerEvents) },
      tagFired: raw.tagFired,
      network: {
        ga4Requests: raw.networkUrls.flatMap((url) => {
          const safeUrl = safeRequestUrl(url);
          return safeUrl ? [{ url: safeUrl, observedAt: raw.startedAt }] : [];
        }),
      },
      consent: { analyticsStorage: raw.consent },
    },
    verdict,
  };
  assertTrackingRunEvidence(evidence);
  return evidence;
}

export class LocalRunEvidenceStore {
  readonly #items = new Map<string, TrackingRunEvidenceV1>();

  save(evidence: TrackingRunEvidenceV1): void {
    assertTrackingRunEvidence(evidence);
    this.#items.set(evidence.runId, structuredClone(evidence));
  }

  get(runId: string): TrackingRunEvidenceV1 | undefined {
    const item = this.#items.get(runId);
    return item ? structuredClone(item) : undefined;
  }
}
