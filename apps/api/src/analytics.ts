import { randomUUID } from "node:crypto";

const analyticsAdminEndpoint = "https://analyticsadmin.googleapis.com/v1beta";
const analyticsDataEndpoint = "https://analyticsdata.googleapis.com/v1beta";
const verificationLifetimeMs = 10 * 60 * 1_000;
const maximumPendingVerifications = 100;
const measurementIdPattern = /^G-[A-Z0-9]+$/;
const eventNamePattern = /^[a-z][a-z0-9_]{0,39}$/;

type Fetch = typeof fetch;

export const ANALYTICS_READONLY_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";

export type AnalyticsIntegrationErrorCode =
  | "invalid_request"
  | "reads_disabled"
  | "too_many_pending"
  | "verification_not_found"
  | "verification_expired"
  | "measurement_not_accessible"
  | "measurement_ambiguous"
  | "provider_forbidden"
  | "provider_unavailable"
  | "malformed_provider_response";

export function googleAnalyticsReadsEnabled(
  environment: NodeJS.ProcessEnv = process.env,
): boolean {
  return environment.GOOGLE_ANALYTICS_READS_ENABLED === "true";
}

export class AnalyticsIntegrationError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: AnalyticsIntegrationErrorCode,
  ) {
    super(message);
    this.name = "AnalyticsIntegrationError";
  }
}

interface PropertyMatch {
  propertyId: string;
  propertyName: string;
  streamId: string;
  streamName: string;
}

interface PendingVerification extends PropertyMatch {
  verificationId: string;
  measurementId: string;
  eventName: string;
  baselineEventCount: number;
  startedAtMs: number;
  expiresAtMs: number;
}

interface AccountSummariesResponse {
  accountSummaries?: Array<{
    displayName?: unknown;
    propertySummaries?: Array<{ property?: unknown; displayName?: unknown }>;
  }>;
  nextPageToken?: unknown;
}

interface DataStreamsResponse {
  dataStreams?: Array<{
    name?: unknown;
    displayName?: unknown;
    webStreamData?: { measurementId?: unknown };
  }>;
  nextPageToken?: unknown;
}

interface RealtimeResponse {
  rows?: Array<{
    dimensionValues?: Array<{ value?: unknown }>;
    metricValues?: Array<{ value?: unknown }>;
  }>;
}

function boundedName(value: unknown): string {
  return typeof value === "string" && value.trim() && value.length <= 256
    ? value.trim()
    : "Unnamed Analytics resource";
}

function normalizeMeasurementId(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (!measurementIdPattern.test(normalized)) {
    throw new AnalyticsIntegrationError("A GA4 measurement ID such as G-ABC123 is required.", 400, "invalid_request");
  }
  return normalized;
}

function normalizeEventName(value: string): string {
  const normalized = value.trim();
  if (!eventNamePattern.test(normalized)) {
    throw new AnalyticsIntegrationError("A valid GA4 event name is required.", 400, "invalid_request");
  }
  return normalized;
}

export class GoogleAnalyticsReadClient {
  private readonly pending = new Map<string, PendingVerification>();

  constructor(
    private readonly getAccessToken: () => Promise<string>,
    private readonly fetcher: Fetch = fetch,
    private readonly enabled = false,
    private readonly now: () => number = Date.now,
    private readonly createId: () => string = randomUUID,
  ) {}

  async start(input: { measurementId: string; eventName: string }) {
    this.assertEnabled();
    this.removeExpired();
    if (this.pending.size >= maximumPendingVerifications) {
      throw new AnalyticsIntegrationError("Too many Analytics verification runs are pending.", 429, "too_many_pending");
    }
    const measurementId = normalizeMeasurementId(input.measurementId);
    const eventName = normalizeEventName(input.eventName);
    const match = await this.resolveProperty(measurementId);
    const baselineEventCount = await this.realtimeEventCount(match.propertyId, eventName);
    const startedAtMs = this.now();
    const verification: PendingVerification = {
      verificationId: this.createId(),
      measurementId,
      eventName,
      baselineEventCount,
      startedAtMs,
      expiresAtMs: startedAtMs + verificationLifetimeMs,
      ...match,
    };
    this.pending.set(verification.verificationId, verification);
    return {
      status: "started" as const,
      verificationId: verification.verificationId,
      measurementId,
      eventName,
      baselineEventCount,
      startedAt: new Date(startedAtMs).toISOString(),
      expiresAt: new Date(verification.expiresAtMs).toISOString(),
      property: { propertyId: match.propertyId, name: match.propertyName },
      stream: { streamId: match.streamId, name: match.streamName },
    };
  }

  async confirm(verificationId: string) {
    this.assertEnabled();
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(verificationId)) {
      throw new AnalyticsIntegrationError("Analytics verification ID is malformed.", 400, "invalid_request");
    }
    const verification = this.pending.get(verificationId);
    if (!verification) throw new AnalyticsIntegrationError("Analytics verification was not found.", 404, "verification_not_found");
    if (verification.expiresAtMs <= this.now()) {
      this.pending.delete(verificationId);
      throw new AnalyticsIntegrationError("Analytics verification expired.", 410, "verification_expired");
    }
    const currentEventCount = await this.realtimeEventCount(
      verification.propertyId,
      verification.eventName,
    );
    const confirmed = currentEventCount > verification.baselineEventCount;
    if (confirmed) this.pending.delete(verificationId);
    return {
      status: confirmed ? "confirmed" as const : "pending" as const,
      verificationId,
      measurementId: verification.measurementId,
      eventName: verification.eventName,
      baselineEventCount: verification.baselineEventCount,
      currentEventCount,
      startedAt: new Date(verification.startedAtMs).toISOString(),
      checkedAt: new Date(this.now()).toISOString(),
      property: { propertyId: verification.propertyId, name: verification.propertyName },
      stream: { streamId: verification.streamId, name: verification.streamName },
      correlation: "aggregate_realtime_count_increase" as const,
    };
  }

  private assertEnabled(): void {
    if (!this.enabled) {
      throw new AnalyticsIntegrationError("Google Analytics reads are disabled on this backend.", 403, "reads_disabled");
    }
  }

  private removeExpired(): void {
    const now = this.now();
    for (const [id, item] of this.pending) {
      if (item.expiresAtMs <= now) this.pending.delete(id);
    }
  }

  private async resolveProperty(measurementId: string): Promise<PropertyMatch> {
    const properties: Array<{ propertyId: string; propertyName: string }> = [];
    let pageToken: string | undefined;
    for (let page = 0; page < 20; page += 1) {
      const url = new URL(`${analyticsAdminEndpoint}/accountSummaries`);
      url.searchParams.set("pageSize", "200");
      if (pageToken) url.searchParams.set("pageToken", pageToken);
      const response = await this.getJson<AccountSummariesResponse>(url);
      for (const account of response.accountSummaries ?? []) {
        for (const property of account.propertySummaries ?? []) {
          if (typeof property.property !== "string") continue;
          const match = /^properties\/(\d+)$/.exec(property.property);
          if (!match) continue;
          properties.push({ propertyId: match[1]!, propertyName: boundedName(property.displayName) });
        }
      }
      pageToken = typeof response.nextPageToken === "string" && response.nextPageToken
        ? response.nextPageToken
        : undefined;
      if (!pageToken) break;
    }

    const matches: PropertyMatch[] = [];
    for (const property of properties.slice(0, 500)) {
      let streamPageToken: string | undefined;
      for (let page = 0; page < 20; page += 1) {
        const url = new URL(`${analyticsAdminEndpoint}/properties/${property.propertyId}/dataStreams`);
        url.searchParams.set("pageSize", "200");
        if (streamPageToken) url.searchParams.set("pageToken", streamPageToken);
        const response = await this.getJson<DataStreamsResponse>(url);
        for (const stream of response.dataStreams ?? []) {
          if (stream.webStreamData?.measurementId !== measurementId || typeof stream.name !== "string") continue;
          const match = new RegExp(`^properties/${property.propertyId}/dataStreams/(\\d+)$`).exec(stream.name);
          if (!match) continue;
          matches.push({
            ...property,
            streamId: match[1]!,
            streamName: boundedName(stream.displayName),
          });
        }
        streamPageToken = typeof response.nextPageToken === "string" && response.nextPageToken
          ? response.nextPageToken
          : undefined;
        if (!streamPageToken) break;
      }
    }
    if (matches.length === 0) {
      throw new AnalyticsIntegrationError("The GA4 measurement ID is not accessible through the saved grant.", 404, "measurement_not_accessible");
    }
    if (matches.length > 1) {
      throw new AnalyticsIntegrationError("The GA4 measurement ID matched multiple accessible data streams.", 409, "measurement_ambiguous");
    }
    return matches[0]!;
  }

  private async realtimeEventCount(propertyId: string, eventName: string): Promise<number> {
    const response = await this.postJson<RealtimeResponse>(
      `${analyticsDataEndpoint}/properties/${propertyId}:runRealtimeReport`,
      {
        dimensions: [{ name: "eventName" }],
        metrics: [{ name: "eventCount" }],
        dimensionFilter: {
          filter: {
            fieldName: "eventName",
            stringFilter: { matchType: "EXACT", value: eventName, caseSensitive: true },
          },
        },
        limit: "1",
      },
    );
    const row = response.rows?.find((candidate) => candidate.dimensionValues?.[0]?.value === eventName);
    if (!row) return 0;
    const rawCount = row.metricValues?.[0]?.value;
    const count = typeof rawCount === "string" ? Number.parseInt(rawCount, 10) : Number.NaN;
    if (!Number.isSafeInteger(count) || count < 0) {
      throw new AnalyticsIntegrationError("Google Analytics returned malformed realtime evidence.", 502, "malformed_provider_response");
    }
    return count;
  }

  private async getJson<Result>(url: URL): Promise<Result> {
    const response = await this.fetcher(url, {
      headers: { Authorization: `Bearer ${await this.getAccessToken()}` },
    });
    return this.responseJson<Result>(response);
  }

  private async postJson<Result>(url: string, body: unknown): Promise<Result> {
    const response = await this.fetcher(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await this.getAccessToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    return this.responseJson<Result>(response);
  }

  private async responseJson<Result>(response: Response): Promise<Result> {
    if (!response.ok) {
      const forbidden = response.status === 401 || response.status === 403;
      throw new AnalyticsIntegrationError(
        forbidden
          ? "Google Analytics denied the read. Confirm the saved grant and Analytics Data API are enabled."
          : `Google Analytics read failed with HTTP ${response.status}.`,
        forbidden ? 502 : response.status,
        forbidden ? "provider_forbidden" : "provider_unavailable",
      );
    }
    try {
      return await response.json() as Result;
    } catch {
      throw new AnalyticsIntegrationError("Google Analytics returned malformed JSON.", 502, "malformed_provider_response");
    }
  }
}
