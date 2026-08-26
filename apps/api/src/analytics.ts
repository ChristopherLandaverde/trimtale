import { randomUUID } from "node:crypto";
import {
  createGa4ConfigurationPlan,
  fingerprintDraftValue,
  ga4ConfigurationApprovalCurrent,
  validateGa4ConfigurationPlan,
  type Ga4ActionReceiptV1,
  type Ga4ConfigurationActionV1,
  type Ga4ConfigurationPlanV1,
} from "@gtm-observability/core";

const analyticsAdminEndpoint = "https://analyticsadmin.googleapis.com/v1beta";
const analyticsAdminAlphaEndpoint = "https://analyticsadmin.googleapis.com/v1alpha";
const analyticsDataEndpoint = "https://analyticsdata.googleapis.com/v1beta";
const verificationLifetimeMs = 10 * 60 * 1_000;
const maximumPendingVerifications = 100;
const measurementIdPattern = /^G-[A-Z0-9]+$/;
const eventNamePattern = /^[a-z][a-z0-9_]{0,39}$/;

type Fetch = typeof fetch;

export const ANALYTICS_READONLY_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
export const ANALYTICS_EDIT_SCOPE = "https://www.googleapis.com/auth/analytics.edit";

export enum AnalyticsAccess {
  None = "none",
  Read = "read",
  Edit = "edit",
}

export type AnalyticsIntegrationErrorCode =
  | "invalid_request"
  | "reads_disabled"
  | "writes_disabled"
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

export function googleAnalyticsWritesEnabled(
  environment: NodeJS.ProcessEnv = process.env,
): boolean {
  return environment.GOOGLE_ANALYTICS_WRITES_ENABLED === "true";
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

interface EnhancedMeasurementResponse {
  streamEnabled?: unknown;
  scrollsEnabled?: unknown;
  outboundClicksEnabled?: unknown;
  siteSearchEnabled?: unknown;
  videoEngagementEnabled?: unknown;
  fileDownloadsEnabled?: unknown;
  pageChangesEnabled?: unknown;
  formInteractionsEnabled?: unknown;
}

interface CustomDimensionResource {
  name?: unknown;
  parameterName?: unknown;
  displayName?: unknown;
  description?: unknown;
  scope?: unknown;
}

interface CustomMetricResource extends CustomDimensionResource {
  measurementUnit?: unknown;
  restrictedMetricType?: unknown;
}

interface KeyEventResource {
  name?: unknown;
  eventName?: unknown;
  countingMethod?: unknown;
  defaultValue?: unknown;
}

interface Ga4ConfigurationState {
  target: {
    propertyId: string;
    propertyName: string;
    measurementId: string;
    streamId: string;
    streamName: string;
  };
  enhancedMeasurement: Awaited<ReturnType<GoogleAnalyticsReadClient["enhancedMeasurement"]>>["settings"];
  customDimensions: Array<Record<string, unknown>>;
  customMetrics: Array<Record<string, unknown>>;
  keyEvents: Array<Record<string, unknown>>;
  fingerprint: string;
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

function protoBoolean(value: unknown): boolean {
  if (value === undefined) {
    return false;
  }
  if (typeof value === "boolean") {
    return value;
  }

  throw new AnalyticsIntegrationError(
    "Google Analytics returned malformed enhanced-measurement settings.",
    502,
    "malformed_provider_response",
  );
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

  async enhancedMeasurement(rawMeasurementId: string) {
    this.assertEnabled();
    const measurementId = normalizeMeasurementId(rawMeasurementId);
    const match = await this.resolveProperty(measurementId);
    const url = new URL(
      `${analyticsAdminAlphaEndpoint}/properties/${match.propertyId}/dataStreams/${match.streamId}/enhancedMeasurementSettings`,
    );
    const response = await this.getJson<EnhancedMeasurementResponse>(url);
    const settings = {
      stream: protoBoolean(response.streamEnabled),
      pageViews: protoBoolean(response.pageChangesEnabled),
      scrolls: protoBoolean(response.scrollsEnabled),
      outboundClicks: protoBoolean(response.outboundClicksEnabled),
      siteSearch: protoBoolean(response.siteSearchEnabled),
      videoEngagement: protoBoolean(response.videoEngagementEnabled),
      fileDownloads: protoBoolean(response.fileDownloadsEnabled),
      formInteractions: protoBoolean(response.formInteractionsEnabled),
    };

    return {
      measurementId,
      property: { propertyId: match.propertyId, name: match.propertyName },
      stream: { streamId: match.streamId, name: match.streamName },
      settings,
    };
  }

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

export class GoogleAnalyticsWriteClient {
  constructor(
    private readonly reader: GoogleAnalyticsReadClient,
    private readonly getAccessToken: () => Promise<string>,
    private readonly fetcher: Fetch = fetch,
    private readonly access = AnalyticsAccess.None,
  ) {}

  async enableMeasurement(rawMeasurementId: string) {
    if (this.access !== AnalyticsAccess.Edit) {
      throw new AnalyticsIntegrationError(
        "Google Analytics writes are disabled on this backend.",
        403,
        "writes_disabled",
      );
    }

    // Re-resolve immediately before mutation so a stale UI cannot select the stream.
    const audit = await this.reader.enhancedMeasurement(rawMeasurementId);
    if (audit.settings.stream) {
      return { status: "already_enabled" as const, audit };
    }

    const name = `properties/${audit.property.propertyId}/dataStreams/${audit.stream.streamId}/enhancedMeasurementSettings`;
    const url = new URL(`${analyticsAdminAlphaEndpoint}/${name}`);
    url.searchParams.set("updateMask", "stream_enabled");
    const response = await this.fetcher(url, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${await this.getAccessToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, streamEnabled: true }),
    });
    const result = await this.responseJson(response);
    if (!isRecord(result) || result.streamEnabled !== true) {
      throw new AnalyticsIntegrationError(
        "Google Analytics returned malformed enhanced-measurement settings.",
        502,
        "malformed_provider_response",
      );
    }

    return {
      status: "enabled" as const,
      audit: { ...audit, settings: { ...audit.settings, stream: true } },
    };
  }

  async planConfiguration(input: {
    id: string;
    measurementId: string;
    actions: Ga4ConfigurationActionV1[];
  }): Promise<Ga4ConfigurationPlanV1> {
    this.assertEditAccess();
    const state = await this.configurationState(input.measurementId);
    return createGa4ConfigurationPlan({
      id: input.id,
      target: state.target,
      providerStateFingerprint: state.fingerprint,
      actions: input.actions,
    });
  }

  async applyConfiguration(plan: Ga4ConfigurationPlanV1): Promise<{
    status: "applied";
    receipts: Ga4ActionReceiptV1[];
    providerStateFingerprint: string;
  }> {
    this.assertEditAccess();
    const errors = validateGa4ConfigurationPlan(plan);
    if (errors.length > 0) {
      throw new AnalyticsIntegrationError("The GA4 configuration plan is invalid.", 400, "invalid_request");
    }
    let state = await this.configurationState(plan.target.measurementId);
    if (!sameTarget(state.target, plan.target)) {
      throw new AnalyticsIntegrationError("The approved GA4 property or stream target changed.", 409, "invalid_request");
    }
    if (!ga4ConfigurationApprovalCurrent(plan, state.fingerprint)) {
      throw new AnalyticsIntegrationError("GA4 configuration requires current approval for the fresh property state.", 409, "invalid_request");
    }

    const receipts: Ga4ActionReceiptV1[] = [];
    for (const action of plan.actions) {
      const result = await this.applyConfigurationAction(plan, action, state);
      state = await this.configurationState(plan.target.measurementId);
      receipts.push({
        schemaVersion: 1,
        planId: plan.id,
        planFingerprint: plan.planFingerprint,
        actionId: action.id,
        actionType: action.type,
        propertyId: plan.target.propertyId,
        status: result.status,
        resourceName: result.resourceName,
        providerFingerprintAfter: state.fingerprint,
        completedAt: new Date().toISOString(),
      });
    }
    return { status: "applied", receipts, providerStateFingerprint: state.fingerprint };
  }

  private assertEditAccess(): void {
    if (this.access !== AnalyticsAccess.Edit) {
      throw new AnalyticsIntegrationError(
        "Google Analytics writes are disabled on this backend.",
        403,
        "writes_disabled",
      );
    }
  }

  private async configurationState(rawMeasurementId: string): Promise<Ga4ConfigurationState> {
    const audit = await this.reader.enhancedMeasurement(rawMeasurementId);
    const propertyPath = `properties/${audit.property.propertyId}`;
    const [customDimensions, customMetrics, keyEvents] = await Promise.all([
      this.listResources<CustomDimensionResource>(`${analyticsAdminEndpoint}/${propertyPath}/customDimensions`, "customDimensions"),
      this.listResources<CustomMetricResource>(`${analyticsAdminEndpoint}/${propertyPath}/customMetrics`, "customMetrics"),
      this.listResources<KeyEventResource>(`${analyticsAdminEndpoint}/${propertyPath}/keyEvents`, "keyEvents"),
    ]);
    const target = {
      propertyId: audit.property.propertyId,
      propertyName: audit.property.name,
      measurementId: audit.measurementId,
      streamId: audit.stream.streamId,
      streamName: audit.stream.name,
    };
    const normalized = {
      target,
      enhancedMeasurement: audit.settings,
      customDimensions: customDimensions.map(normalizeCustomDimension).sort(resourceOrder),
      customMetrics: customMetrics.map(normalizeCustomMetric).sort(resourceOrder),
      keyEvents: keyEvents.map(normalizeKeyEvent).sort(resourceOrder),
    };
    return {
      ...normalized,
      fingerprint: fingerprintDraftValue("ga4_state", normalized),
    };
  }

  private async listResources<Resource>(
    endpoint: string,
    collectionName: string,
  ): Promise<Resource[]> {
    const output: Resource[] = [];
    let pageToken: string | undefined;
    for (let page = 0; page < 20; page += 1) {
      const url = new URL(endpoint);
      url.searchParams.set("pageSize", "200");
      if (pageToken) url.searchParams.set("pageToken", pageToken);
      const response = await this.authorizedJson(url, { method: "GET" });
      if (!isRecord(response)) throw malformedConfigurationResponse();
      const resources = response[collectionName];
      if (resources !== undefined && !Array.isArray(resources)) throw malformedConfigurationResponse();
      output.push(...((resources ?? []) as Resource[]));
      pageToken = typeof response.nextPageToken === "string" && response.nextPageToken
        ? response.nextPageToken
        : undefined;
      if (!pageToken) break;
    }
    return output;
  }

  private async applyConfigurationAction(
    plan: Ga4ConfigurationPlanV1,
    action: Ga4ConfigurationActionV1,
    state: Ga4ConfigurationState,
  ): Promise<{ status: Ga4ActionReceiptV1["status"]; resourceName: string }> {
    if (action.type === "enhanced_measurement") {
      const current = state.enhancedMeasurement[enhancedStateKey(action.feature)];
      const resourceName = `properties/${plan.target.propertyId}/dataStreams/${plan.target.streamId}/enhancedMeasurementSettings`;
      if (current === action.enabled) return { status: "already_current", resourceName };
      const field = enhancedProviderField(action.feature);
      const url = new URL(`${analyticsAdminAlphaEndpoint}/${resourceName}`);
      url.searchParams.set("updateMask", enhancedUpdateMask(action.feature));
      const response = await this.authorizedJson(url, {
        method: "PATCH",
        body: JSON.stringify({ name: resourceName, [field]: action.enabled }),
      });
      if (!isRecord(response) || response[field] !== action.enabled) throw malformedConfigurationResponse();
      return { status: "updated", resourceName };
    }

    const collection = action.type === "custom_dimension"
      ? state.customDimensions
      : action.type === "custom_metric"
        ? state.customMetrics
        : state.keyEvents;
    const identityKey = action.type === "key_event" ? "eventName" : "parameterName";
    const identityValue = action.type === "key_event" ? action.eventName : action.parameterName;
    const existing = collection.find((resource) => resource[identityKey] === identityValue);
    const desired = desiredResource(action);
    if (existing) {
      if (sameConfigurationResource(existing, desired)) {
        return { status: "already_current", resourceName: String(existing.name) };
      }
      throw new AnalyticsIntegrationError(
        `The GA4 ${action.type.replaceAll("_", " ")} already exists with different settings.`,
        409,
        "invalid_request",
      );
    }
    const collectionName = action.type === "custom_dimension"
      ? "customDimensions"
      : action.type === "custom_metric"
        ? "customMetrics"
        : "keyEvents";
    const response = await this.authorizedJson(
      new URL(`${analyticsAdminEndpoint}/properties/${plan.target.propertyId}/${collectionName}`),
      { method: "POST", body: JSON.stringify(desired) },
    );
    if (!isRecord(response) || typeof response.name !== "string" || !response.name.startsWith(`properties/${plan.target.propertyId}/`)) {
      throw malformedConfigurationResponse();
    }
    return { status: "created", resourceName: response.name };
  }

  private async authorizedJson(url: URL, init: RequestInit): Promise<unknown> {
    const response = await this.fetcher(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${await this.getAccessToken()}`,
        ...(init.method !== "GET" ? { "Content-Type": "application/json" } : {}),
      },
    });
    return this.responseJson(response);
  }

  private async responseJson(response: Response): Promise<unknown> {
    if (!response.ok) {
      const forbidden = response.status === 401 || response.status === 403;
      throw new AnalyticsIntegrationError(
        forbidden
          ? "Google Analytics denied the write. Reconnect with Analytics edit access."
          : `Google Analytics write failed with HTTP ${response.status}.`,
        forbidden ? 502 : response.status,
        forbidden ? "provider_forbidden" : "provider_unavailable",
      );
    }
    try {
      return await response.json() as unknown;
    } catch {
      throw new AnalyticsIntegrationError(
        "Google Analytics returned malformed JSON.",
        502,
        "malformed_provider_response",
      );
    }
  }
}

function sameTarget(left: Ga4ConfigurationPlanV1["target"], right: Ga4ConfigurationPlanV1["target"]): boolean {
  return left.propertyId === right.propertyId
    && left.measurementId === right.measurementId
    && left.streamId === right.streamId;
}

function resourceOrder(left: Record<string, unknown>, right: Record<string, unknown>): number {
  return String(left.name ?? "").localeCompare(String(right.name ?? ""));
}

function normalizeCustomDimension(value: CustomDimensionResource): Record<string, unknown> {
  return normalizedResource(value, ["name", "parameterName", "displayName", "description", "scope"]);
}

function normalizeCustomMetric(value: CustomMetricResource): Record<string, unknown> {
  return normalizedResource(value, [
    "name", "parameterName", "displayName", "description", "measurementUnit", "scope", "restrictedMetricType",
  ]);
}

function normalizeKeyEvent(value: KeyEventResource): Record<string, unknown> {
  return normalizedResource(value, ["name", "eventName", "countingMethod", "defaultValue"]);
}

function normalizedResource(value: object, keys: string[]): Record<string, unknown> {
  const source = value as Record<string, unknown>;
  const output: Record<string, unknown> = {};
  for (const key of keys) {
    if (source[key] !== undefined) output[key] = source[key];
  }
  return output;
}

function desiredResource(action: Exclude<Ga4ConfigurationActionV1, { type: "enhanced_measurement" }>): Record<string, unknown> {
  if (action.type === "custom_dimension") {
    return {
      parameterName: action.parameterName,
      displayName: action.displayName,
      description: action.description,
      scope: action.scope,
    };
  }
  if (action.type === "custom_metric") {
    return {
      parameterName: action.parameterName,
      displayName: action.displayName,
      description: action.description,
      measurementUnit: action.measurementUnit,
      scope: action.scope,
      restrictedMetricType: action.restrictedMetricTypes,
    };
  }
  return {
    eventName: action.eventName,
    countingMethod: action.countingMethod,
    ...(action.defaultValue ? { defaultValue: action.defaultValue } : {}),
  };
}

function sameConfigurationResource(existing: Record<string, unknown>, desired: Record<string, unknown>): boolean {
  return Object.entries(desired).every(([key, value]) => JSON.stringify(existing[key]) === JSON.stringify(value));
}

type EnhancedFeature = Extract<Ga4ConfigurationActionV1, { type: "enhanced_measurement" }>["feature"];

function enhancedStateKey(feature: EnhancedFeature): keyof Ga4ConfigurationState["enhancedMeasurement"] {
  const keys = {
    stream: "stream",
    page_views: "pageViews",
    scrolls: "scrolls",
    outbound_clicks: "outboundClicks",
    site_search: "siteSearch",
    video_engagement: "videoEngagement",
    file_downloads: "fileDownloads",
    form_interactions: "formInteractions",
  } as const;
  return keys[feature];
}

function enhancedProviderField(feature: Parameters<typeof enhancedStateKey>[0]): string {
  const fields = {
    stream: "streamEnabled",
    page_views: "pageChangesEnabled",
    scrolls: "scrollsEnabled",
    outbound_clicks: "outboundClicksEnabled",
    site_search: "siteSearchEnabled",
    video_engagement: "videoEngagementEnabled",
    file_downloads: "fileDownloadsEnabled",
    form_interactions: "formInteractionsEnabled",
  } as const;
  return fields[feature];
}

function enhancedUpdateMask(feature: Parameters<typeof enhancedStateKey>[0]): string {
  const fields = {
    stream: "stream_enabled",
    page_views: "page_changes_enabled",
    scrolls: "scrolls_enabled",
    outbound_clicks: "outbound_clicks_enabled",
    site_search: "site_search_enabled",
    video_engagement: "video_engagement_enabled",
    file_downloads: "file_downloads_enabled",
    form_interactions: "form_interactions_enabled",
  } as const;
  return fields[feature];
}

function malformedConfigurationResponse(): AnalyticsIntegrationError {
  return new AnalyticsIntegrationError(
    "Google Analytics returned malformed configuration state.",
    502,
    "malformed_provider_response",
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
