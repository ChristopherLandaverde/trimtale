import { randomBytes } from "node:crypto";
import { chmodSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export const GTM_READONLY_SCOPE = "https://www.googleapis.com/auth/tagmanager.readonly";
export const GTM_EDIT_CONTAINERS_SCOPE =
  "https://www.googleapis.com/auth/tagmanager.edit.containers";
export const GOOGLE_ANALYTICS_READONLY_SCOPE =
  "https://www.googleapis.com/auth/analytics.readonly";
export const GOOGLE_ANALYTICS_EDIT_SCOPE =
  "https://www.googleapis.com/auth/analytics.edit";

const authorizationEndpoint = "https://accounts.google.com/o/oauth2/v2/auth";
const tokenEndpoint = "https://oauth2.googleapis.com/token";
const tagManagerEndpoint = "https://tagmanager.googleapis.com/tagmanager/v2";
const analyticsAdminEndpoint = "https://analyticsadmin.googleapis.com";
const stateLifetimeMs = 10 * 60 * 1_000;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  containerWritesEnabled: boolean;
  workspaceWritesEnabled: boolean;
  workspaceContainerPath: string | undefined;
  entityWritesEnabled: boolean;
  entityWorkspacePath: string | undefined;
  trackingSetupWritesEnabled: boolean;
  trackingSetupContainerPath: string | undefined;
  analyticsDiscoveryEnabled: boolean;
  analyticsAccountProvisioningEnabled: boolean;
  analyticsProvisioningRedirectUri: string | undefined;
  analyticsSetupWritesEnabled: boolean;
  tokenFile: string | undefined;
}

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type: string;
}

interface StoredTokens {
  accessToken: string;
  expiresAt: number;
  refreshToken?: string;
}

export interface GtmAccount {
  accountId: string;
  name: string;
  path: string;
}

export interface GtmContainer {
  accountId: string;
  containerId: string;
  name: string;
  path: string;
  publicId: string;
  usageContext: string[];
  notes?: string;
}

export interface GtmAccountDiscovery extends GtmAccount {
  containers: GtmContainer[];
}

export interface GtmWorkspace {
  path: string;
  accountId: string;
  containerId: string;
  workspaceId: string;
  name: string;
  description?: string;
  fingerprint?: string;
}

export interface GtmContainerVersion {
  path?: string;
  accountId?: string;
  containerId?: string;
  containerVersionId?: string;
  name?: string;
  description?: string;
  fingerprint?: string;
  tag?: unknown[];
  trigger?: unknown[];
  variable?: unknown[];
  builtInVariable?: unknown[];
  folder?: unknown[];
}

export interface GtmContainerEntityContext {
  container: GtmContainer;
  workspaces: GtmWorkspace[];
  liveVersion: GtmContainerVersion;
}

type Fetch = typeof fetch;

export function googleOAuthConfig(
  environment: NodeJS.ProcessEnv = process.env,
): GoogleOAuthConfig | undefined {
  const clientId = environment.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = environment.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  const redirectUri = environment.GOOGLE_OAUTH_REDIRECT_URI?.trim();
  if (!clientId || !clientSecret || !redirectUri) return undefined;
  return {
    clientId,
    clientSecret,
    redirectUri,
    containerWritesEnabled: environment.GOOGLE_GTM_CONTAINER_WRITES_ENABLED === "true",
    workspaceWritesEnabled: environment.GOOGLE_GTM_WORKSPACE_WRITES_ENABLED === "true",
    workspaceContainerPath: environment.GOOGLE_GTM_WORKSPACE_CONTAINER_PATH?.trim(),
    entityWritesEnabled: environment.GOOGLE_GTM_ENTITY_WRITES_ENABLED === "true",
    entityWorkspacePath: environment.GOOGLE_GTM_ENTITY_WORKSPACE_PATH?.trim(),
    trackingSetupWritesEnabled: environment.GOOGLE_GTM_TRACKING_SETUP_WRITES_ENABLED === "true",
    trackingSetupContainerPath: environment.GOOGLE_GTM_TRACKING_SETUP_CONTAINER_PATH?.trim(),
    analyticsDiscoveryEnabled: environment.GOOGLE_ANALYTICS_DISCOVERY_ENABLED === "true",
    analyticsAccountProvisioningEnabled:
      environment.GOOGLE_ANALYTICS_ACCOUNT_PROVISIONING_ENABLED === "true",
    analyticsProvisioningRedirectUri:
      environment.GOOGLE_ANALYTICS_PROVISIONING_REDIRECT_URI?.trim(),
    analyticsSetupWritesEnabled: environment.GOOGLE_ANALYTICS_SETUP_WRITES_ENABLED === "true",
    tokenFile: environment.GOOGLE_OAUTH_TOKEN_FILE?.trim(),
  };
}

export class GoogleIntegrationError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function responseJson<T>(response: Response): Promise<T> {
  const value = (await response.json()) as T & { error?: unknown; error_description?: unknown };
  if (!response.ok) {
    const rawDetail = value.error_description ?? value.error ?? `HTTP ${response.status}`;
    const detail = typeof rawDetail === "string" ? rawDetail : JSON.stringify(rawDetail);
    throw new GoogleIntegrationError(`Google API request failed: ${detail}`, response.status);
  }
  return value;
}

export class GoogleOAuthSession {
  private readonly states = new Map<string, number>();
  private tokens: StoredTokens | undefined;

  constructor(
    private readonly config: GoogleOAuthConfig,
    private readonly fetcher: Fetch = fetch,
    private readonly now: () => number = Date.now,
  ) {
    this.tokens = this.loadPersistedTokens();
  }

  isConnected(): boolean {
    return this.tokens !== undefined;
  }

  authorizationUrl(): string {
    this.removeExpiredStates();
    const state = randomBytes(32).toString("base64url");
    this.states.set(state, this.now() + stateLifetimeMs);
    const url = new URL(authorizationEndpoint);
    const scopes = [GTM_READONLY_SCOPE];
    if (
      this.config.containerWritesEnabled ||
      this.config.workspaceWritesEnabled ||
      this.config.entityWritesEnabled
      || this.config.trackingSetupWritesEnabled
    ) {
      scopes.push(GTM_EDIT_CONTAINERS_SCOPE);
    }
    if (this.config.analyticsAccountProvisioningEnabled || this.config.analyticsSetupWritesEnabled) {
      scopes.push(GOOGLE_ANALYTICS_EDIT_SCOPE);
    } else if (this.config.analyticsDiscoveryEnabled) {
      scopes.push(GOOGLE_ANALYTICS_READONLY_SCOPE);
    }
    url.search = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: "code",
      scope: scopes.join(" "),
      access_type: "offline",
      include_granted_scopes: "true",
      prompt: "consent",
      state,
    }).toString();
    return url.toString();
  }

  async authorize(code: string, state: string): Promise<void> {
    const expiry = this.states.get(state);
    this.states.delete(state);
    if (!expiry || expiry < this.now()) {
      throw new GoogleIntegrationError("OAuth state is missing, expired, or already used.", 400);
    }
    const response = await this.fetcher(tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uri: this.config.redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const result = await responseJson<GoogleTokenResponse>(response);
    this.tokens = this.store(result);
  }

  async accessToken(): Promise<string> {
    if (!this.tokens) throw new GoogleIntegrationError("Google Tag Manager is not connected.", 401);
    if (this.tokens.expiresAt > this.now() + 30_000) return this.tokens.accessToken;
    if (!this.tokens.refreshToken) {
      this.tokens = undefined;
      throw new GoogleIntegrationError("Google authorization expired. Connect again.", 401);
    }
    const response = await this.fetcher(tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: this.tokens.refreshToken,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        grant_type: "refresh_token",
      }),
    });
    const result = await responseJson<GoogleTokenResponse>(response);
    this.tokens = this.store(result, this.tokens.refreshToken);
    return this.tokens.accessToken;
  }

  private store(result: GoogleTokenResponse, existingRefreshToken?: string): StoredTokens {
    if (!result.access_token || !Number.isFinite(result.expires_in)) {
      throw new GoogleIntegrationError("Google returned an invalid OAuth token response.", 502);
    }
    const refreshToken = result.refresh_token ?? existingRefreshToken;
    const tokens = {
      accessToken: result.access_token,
      expiresAt: this.now() + result.expires_in * 1_000,
      ...(refreshToken ? { refreshToken } : {}),
    };
    if (refreshToken) this.persistRefreshToken(refreshToken);
    return tokens;
  }

  private loadPersistedTokens(): StoredTokens | undefined {
    if (!this.config.tokenFile) return undefined;
    try {
      const parsed = JSON.parse(readFileSync(this.config.tokenFile, "utf8")) as { refreshToken?: unknown };
      if (typeof parsed.refreshToken !== "string" || parsed.refreshToken.length === 0) {
        throw new Error("refreshToken is missing");
      }
      return { accessToken: "", expiresAt: 0, refreshToken: parsed.refreshToken };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw new Error(`Unable to load the configured Google OAuth token file: ${error instanceof Error ? error.message : "invalid file"}`);
    }
  }

  private persistRefreshToken(refreshToken: string): void {
    const tokenFile = this.config.tokenFile;
    if (!tokenFile) return;
    const directory = dirname(tokenFile);
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    chmodSync(directory, 0o700);
    const temporaryFile = `${tokenFile}.${process.pid}.${randomBytes(8).toString("hex")}.tmp`;
    try {
      writeFileSync(temporaryFile, `${JSON.stringify({ refreshToken })}\n`, {
        encoding: "utf8",
        flag: "wx",
        mode: 0o600,
      });
      renameSync(temporaryFile, tokenFile);
      chmodSync(tokenFile, 0o600);
    } finally {
      rmSync(temporaryFile, { force: true });
    }
  }

  private removeExpiredStates(): void {
    for (const [state, expiry] of this.states) {
      if (expiry < this.now()) this.states.delete(state);
    }
  }
}

interface AccountListResponse {
  account?: GtmAccount[];
  nextPageToken?: string;
}

interface ContainerListResponse {
  container?: GtmContainer[];
  nextPageToken?: string;
}

interface WorkspaceListResponse {
  workspace?: GtmWorkspace[];
  nextPageToken?: string;
}

export interface AnalyticsWebStream {
  name: string;
  displayName: string;
  measurementId: string;
  defaultUri: string;
}

export interface AnalyticsPropertyDiscovery {
  property: string;
  displayName: string;
  webStreams: AnalyticsWebStream[];
}

export interface AnalyticsAccountDiscovery {
  account: string;
  displayName: string;
  properties: AnalyticsPropertyDiscovery[];
}

interface AnalyticsPropertySummary {
  property: string;
  displayName: string;
  propertyType?: string;
}

interface AnalyticsAccountSummary {
  account: string;
  displayName: string;
  propertySummaries?: AnalyticsPropertySummary[];
}

interface AnalyticsAccountSummaryResponse {
  accountSummaries?: AnalyticsAccountSummary[];
  nextPageToken?: string;
}

interface AnalyticsDataStream {
  name: string;
  type: string;
  displayName: string;
  webStreamData?: { measurementId?: string; defaultUri?: string };
}

interface AnalyticsDataStreamResponse {
  dataStreams?: AnalyticsDataStream[];
  nextPageToken?: string;
}

interface AnalyticsProperty {
  name?: string;
  parent?: string;
  displayName?: string;
  timeZone?: string;
  currencyCode?: string;
}

export interface CreatedAnalyticsSetup {
  property: {
    name: string;
    displayName: string;
    timeZone: string;
    currencyCode: string;
  };
  webStream: AnalyticsWebStream;
}

export class AnalyticsDiscoveryClient {
  constructor(
    private readonly getAccessToken: () => Promise<string>,
    private readonly fetcher: Fetch = fetch,
  ) {}

  async discover(): Promise<AnalyticsAccountDiscovery[]> {
    const accounts = await this.listAll<AnalyticsAccountSummary, AnalyticsAccountSummaryResponse>(
      "/v1alpha/accountSummaries",
      "accountSummaries",
    );
    return Promise.all(accounts.map(async (account) => ({
      account: account.account,
      displayName: account.displayName,
      properties: await Promise.all((account.propertySummaries ?? [])
        .filter((property) => property.propertyType !== "PROPERTY_TYPE_SUBPROPERTY")
        .map(async (property) => ({
          property: property.property,
          displayName: property.displayName,
          webStreams: (await this.listAll<AnalyticsDataStream, AnalyticsDataStreamResponse>(
            `/v1beta/${property.property}/dataStreams`,
            "dataStreams",
          )).filter((stream) => stream.type === "WEB_DATA_STREAM" && stream.webStreamData?.measurementId)
            .map((stream) => ({
              name: stream.name,
              displayName: stream.displayName,
              measurementId: stream.webStreamData!.measurementId!,
              defaultUri: stream.webStreamData?.defaultUri ?? "",
            })),
        }))),
    })));
  }

  async provisionAccountTicket(
    displayName: string,
    regionCode: string,
    redirectUri: string,
  ): Promise<{ accountTicketId: string; termsUrl: string }> {
    const normalizedName = displayName.replace(/\s+/g, " ").trim();
    if (normalizedName.length < 3 || normalizedName.length > 100) {
      throw new GoogleIntegrationError("Analytics account name must be between 3 and 100 characters.", 400);
    }
    const normalizedRegion = regionCode.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(normalizedRegion)) {
      throw new GoogleIntegrationError("Analytics region code must be a two-letter country code.", 400);
    }
    let redirect: URL;
    try {
      redirect = new URL(redirectUri);
      if (redirect.protocol !== "http:" && redirect.protocol !== "https:") throw new Error("Invalid protocol");
    } catch {
      throw new GoogleIntegrationError("Analytics provisioning redirect URI must be HTTP or HTTPS.", 400);
    }
    const response = await this.fetcher(
      `${analyticsAdminEndpoint}/v1beta/accounts:provisionAccountTicket`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await this.getAccessToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          account: { displayName: normalizedName, regionCode: normalizedRegion },
          redirectUri: redirect.toString(),
        }),
      },
    );
    const result = await responseJson<{ accountTicketId?: string }>(response);
    if (!result.accountTicketId) {
      throw new GoogleIntegrationError("Google did not return an Analytics account ticket.", 502);
    }
    return {
      accountTicketId: result.accountTicketId,
      termsUrl: `https://analytics.google.com/analytics/web/?provisioningSignup=false#/termsofservice/${encodeURIComponent(result.accountTicketId)}`,
    };
  }

  async createPropertyWithWebStream(
    account: string,
    propertyDisplayName: string,
    timeZone: string,
    currencyCode: string,
    streamDisplayName: string,
    defaultUri: string,
  ): Promise<CreatedAnalyticsSetup> {
    if (!/^accounts\/\d+$/.test(account)) {
      throw new GoogleIntegrationError("Analytics account must look like accounts/123.", 400);
    }
    const normalizedPropertyName = propertyDisplayName.replace(/\s+/g, " ").trim();
    const normalizedStreamName = streamDisplayName.replace(/\s+/g, " ").trim();
    if (normalizedPropertyName.length < 3 || normalizedPropertyName.length > 100) {
      throw new GoogleIntegrationError("Analytics property name must be between 3 and 100 characters.", 400);
    }
    if (normalizedStreamName.length < 3 || normalizedStreamName.length > 100) {
      throw new GoogleIntegrationError("Analytics web stream name must be between 3 and 100 characters.", 400);
    }
    const normalizedTimeZone = timeZone.trim();
    if (!/^[A-Za-z_+-]+(?:\/[A-Za-z0-9_+-]+)+$/.test(normalizedTimeZone)) {
      throw new GoogleIntegrationError("Analytics time zone must be an IANA name such as America/New_York.", 400);
    }
    const normalizedCurrency = currencyCode.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(normalizedCurrency)) {
      throw new GoogleIntegrationError("Analytics currency must be a three-letter code such as USD.", 400);
    }
    let website: URL;
    try {
      website = new URL(defaultUri);
      if (website.protocol !== "https:") throw new Error("HTTPS required");
    } catch {
      throw new GoogleIntegrationError("Analytics web stream URL must be a valid HTTPS URL.", 400);
    }

    const propertyResponse = await this.fetcher(`${analyticsAdminEndpoint}/v1beta/properties`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await this.getAccessToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        parent: account,
        displayName: normalizedPropertyName,
        timeZone: normalizedTimeZone,
        currencyCode: normalizedCurrency,
      }),
    });
    const property = await responseJson<AnalyticsProperty>(propertyResponse);
    if (!property.name || !/^properties\/\d+$/.test(property.name)) {
      throw new GoogleIntegrationError("Google did not return the created Analytics property.", 502);
    }

    let stream: AnalyticsDataStream;
    try {
      const streamResponse = await this.fetcher(
        `${analyticsAdminEndpoint}/v1beta/${property.name}/dataStreams`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${await this.getAccessToken()}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: "WEB_DATA_STREAM",
            displayName: normalizedStreamName,
            webStreamData: { defaultUri: website.toString() },
          }),
        },
      );
      stream = await responseJson<AnalyticsDataStream>(streamResponse);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "unknown Google error";
      throw new GoogleIntegrationError(
        `Analytics property ${property.name} was created and retained, but its web data stream failed: ${detail}`,
        error instanceof GoogleIntegrationError ? error.status : 502,
      );
    }
    if (!stream.name || !stream.webStreamData?.measurementId) {
      throw new GoogleIntegrationError(
        `Analytics property ${property.name} was created and retained, but Google did not return a measurement ID.`,
        502,
      );
    }
    return {
      property: {
        name: property.name,
        displayName: property.displayName ?? normalizedPropertyName,
        timeZone: property.timeZone ?? normalizedTimeZone,
        currencyCode: property.currencyCode ?? normalizedCurrency,
      },
      webStream: {
        name: stream.name,
        displayName: stream.displayName,
        measurementId: stream.webStreamData.measurementId,
        defaultUri: stream.webStreamData.defaultUri ?? website.toString(),
      },
    };
  }

  private async listAll<T, R extends { nextPageToken?: string }>(
    path: string,
    key: keyof R,
  ): Promise<T[]> {
    const values: T[] = [];
    let pageToken: string | undefined;
    do {
      const url = new URL(`${analyticsAdminEndpoint}${path}`);
      url.searchParams.set("pageSize", "200");
      if (pageToken) url.searchParams.set("pageToken", pageToken);
      const response = await this.fetcher(url, {
        headers: { Authorization: `Bearer ${await this.getAccessToken()}` },
      });
      const body = await responseJson<R>(response);
      const page = body[key];
      if (Array.isArray(page)) values.push(...page as T[]);
      pageToken = body.nextPageToken;
    } while (pageToken);
    return values;
  }
}

export interface GtmWorkspaceStatus {
  workspaceChange?: unknown[];
  mergeConflict?: unknown[];
}

interface GtmBuiltInVariableCreateResponse {
  builtInVariable?: unknown[];
}

export interface GtmCreatedTrigger {
  triggerId: string;
  name: string;
  path?: string;
}

export interface GtmCreatedTag {
  tagId: string;
  name: string;
  path?: string;
}

export interface GtmNavigationSetupResult {
  builtInVariables: unknown[];
  googleTag: GtmCreatedTag;
  trigger: GtmCreatedTrigger;
  tag: GtmCreatedTag;
}

export interface GtmWorkspaceSelection {
  workspace: GtmWorkspace;
  selection: "reused-default" | "reused-isolated" | "created-isolated";
}

export class GtmDiscoveryClient {
  constructor(
    private readonly getAccessToken: () => Promise<string>,
    private readonly fetcher: Fetch = fetch,
  ) {}

  async discover(): Promise<GtmAccountDiscovery[]> {
    const accounts = await this.listAll<GtmAccount, AccountListResponse>(
      "/accounts",
      "account",
    );
    return Promise.all(
      accounts.map(async (account) => ({
        ...account,
        containers: await this.listAll<GtmContainer, ContainerListResponse>(
          `/${account.path}/containers`,
          "container",
        ),
      })),
    );
  }

  async containerEntityContext(
    accountId: string,
    containerId: string,
  ): Promise<GtmContainerEntityContext> {
    if (!/^\d+$/.test(accountId) || !/^\d+$/.test(containerId)) {
      throw new GoogleIntegrationError("GTM account and container IDs must be numeric.", 400);
    }
    const parent = `/accounts/${accountId}/containers/${containerId}`;
    const [container, workspaces, liveVersion] = await Promise.all([
      this.get<GtmContainer>(parent),
      this.listAll<GtmWorkspace, WorkspaceListResponse>(`${parent}/workspaces`, "workspace"),
      this.get<GtmContainerVersion>(`${parent}/versions:live`),
    ]);
    return { container, workspaces, liveVersion };
  }

  async createVerificationContainer(
    accountId: string,
    name: string,
    domainName: string,
  ): Promise<GtmContainer> {
    if (!/^\d+$/.test(accountId)) {
      throw new GoogleIntegrationError("GTM account ID must be numeric.", 400);
    }
    const normalizedName = name.replace(/\s+/g, " ").trim();
    if (normalizedName.length < 3 || normalizedName.length > 100) {
      throw new GoogleIntegrationError("Container name must be between 3 and 100 characters.", 400);
    }
    let hostname: string;
    try {
      const url = new URL(domainName);
      if (url.protocol !== "https:") throw new Error("HTTPS required");
      hostname = url.hostname;
    } catch {
      throw new GoogleIntegrationError("Verification target must be a valid HTTPS URL.", 400);
    }
    const response = await this.fetcher(
      `${tagManagerEndpoint}/accounts/${accountId}/containers`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await this.getAccessToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: normalizedName,
          usageContext: ["web"],
          domainName: [hostname],
          notes: "Disposable verification target created by GTM Observability.",
        }),
      },
    );
    return responseJson<GtmContainer>(response);
  }

  async createIsolatedWorkspace(
    accountId: string,
    containerId: string,
    name: string,
  ): Promise<GtmWorkspace> {
    this.validateContainerPath(accountId, containerId);
    const normalizedName = name.replace(/\s+/g, " ").trim();
    if (normalizedName.length < 3 || normalizedName.length > 100) {
      throw new GoogleIntegrationError("Workspace name must be between 3 and 100 characters.", 400);
    }
    const parent = `/accounts/${accountId}/containers/${containerId}`;
    const response = await this.fetcher(`${tagManagerEndpoint}${parent}/workspaces`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await this.getAccessToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: normalizedName,
        description: "Isolated GTM Observability verification workspace. Retain for evidence; do not publish.",
      }),
    });
    return responseJson<GtmWorkspace>(response);
  }

  async selectTrackingSetupWorkspace(
    accountId: string,
    containerId: string,
    requestedName: string,
  ): Promise<GtmWorkspaceSelection> {
    this.validateContainerPath(accountId, containerId);
    const parent = `/accounts/${accountId}/containers/${containerId}`;
    const [container, workspaces] = await Promise.all([
      this.get<GtmContainer>(parent),
      this.listAll<GtmWorkspace, WorkspaceListResponse>(`${parent}/workspaces`, "workspace"),
    ]);
    const isClean = async (workspace: GtmWorkspace): Promise<boolean> => {
      const status = await this.workspaceStatus(accountId, containerId, workspace.workspaceId);
      return (status.workspaceChange?.length ?? 0) === 0 && (status.mergeConflict?.length ?? 0) === 0;
    };
    const productOwned = container.notes === "Disposable verification target created by GTM Observability.";
    const defaultWorkspace = workspaces.find((workspace) => workspace.name === "Default Workspace");
    if (productOwned && defaultWorkspace && await isClean(defaultWorkspace)) {
      return { workspace: defaultWorkspace, selection: "reused-default" };
    }
    const isolatedCandidates = workspaces.filter((workspace) =>
      workspace.name.startsWith("GTM Observability -"),
    );
    for (const workspace of isolatedCandidates) {
      if (await isClean(workspace)) return { workspace, selection: "reused-isolated" };
    }
    if (workspaces.length >= 3) {
      throw new GoogleIntegrationError(
        "No clean workspace is available and this container has reached the safe workspace capacity. Reuse or remove a workspace before creating another.",
        409,
      );
    }
    return {
      workspace: await this.createIsolatedWorkspace(accountId, containerId, requestedName),
      selection: "created-isolated",
    };
  }

  async workspaceStatus(
    accountId: string,
    containerId: string,
    workspaceId: string,
  ): Promise<GtmWorkspaceStatus> {
    this.validateContainerPath(accountId, containerId);
    if (!/^\d+$/.test(workspaceId)) {
      throw new GoogleIntegrationError("GTM workspace ID must be numeric.", 400);
    }
    return this.get<GtmWorkspaceStatus>(
      `/accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/status`,
    );
  }

  async applyNavigationSetup(
    accountId: string,
    containerId: string,
    workspaceId: string,
    measurementId: string,
    linkUrls: string[],
  ): Promise<GtmNavigationSetupResult> {
    this.validateContainerPath(accountId, containerId);
    if (!/^\d+$/.test(workspaceId)) {
      throw new GoogleIntegrationError("GTM workspace ID must be numeric.", 400);
    }
    const normalizedMeasurementId = measurementId.trim().toUpperCase();
    if (!/^G-[A-Z0-9]+$/.test(normalizedMeasurementId)) {
      throw new GoogleIntegrationError("Measurement ID must look like G-XXXXXXXXXX.", 400);
    }
    const normalizedLinks = [...new Set(linkUrls.map((link) => {
      const url = new URL(link);
      if (url.protocol !== "https:") throw new Error("HTTPS required");
      return url.toString();
    }))];
    if (normalizedLinks.length === 0 || normalizedLinks.length > 50) {
      throw new GoogleIntegrationError("Provide between 1 and 50 HTTPS navigation URLs.", 400);
    }
    const parent = `/accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`;
    const googleTag = await this.createGoogleTag(
      accountId,
      containerId,
      workspaceId,
      normalizedMeasurementId,
    );
    const builtInUrl = new URL(`${tagManagerEndpoint}${parent}/built_in_variables`);
    builtInUrl.searchParams.append("type", "clickText");
    builtInUrl.searchParams.append("type", "clickUrl");
    const builtInResponse = await this.fetcher(builtInUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${await this.getAccessToken()}` },
    });
    const builtInVariables = await responseJson<GtmBuiltInVariableCreateResponse>(builtInResponse);

    const triggerResponse = await this.fetcher(`${tagManagerEndpoint}${parent}/triggers`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await this.getAccessToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "CE - Navigation Links - Confirmed Scope",
        type: "linkClick",
        autoEventFilter: [{
          type: "matchRegex",
          parameter: [
            { type: "template", key: "arg0", value: "{{Click URL}}" },
            {
              type: "template",
              key: "arg1",
              value: `^(?:${normalizedLinks.map(escapeRegex).join("|")})$`,
            },
            { type: "boolean", key: "ignore_case", value: "false" },
          ],
        }],
        waitForTags: { type: "boolean", value: "false" },
        checkValidation: { type: "boolean", value: "false" },
      }),
    });
    const trigger = await responseJson<GtmCreatedTrigger>(triggerResponse);

    const tag = await this.createNavigationEventTag(
      accountId,
      containerId,
      workspaceId,
      normalizedMeasurementId,
      trigger.triggerId,
    );
    return {
      builtInVariables: builtInVariables.builtInVariable ?? [],
      googleTag,
      trigger,
      tag,
    };
  }

  async createGoogleTag(
    accountId: string,
    containerId: string,
    workspaceId: string,
    measurementId: string,
  ): Promise<GtmCreatedTag> {
    this.validateContainerPath(accountId, containerId);
    if (!/^\d+$/.test(workspaceId)) {
      throw new GoogleIntegrationError("GTM workspace ID must be numeric.", 400);
    }
    const normalizedMeasurementId = measurementId.trim().toUpperCase();
    if (!/^G-[A-Z0-9]+$/.test(normalizedMeasurementId)) {
      throw new GoogleIntegrationError("Measurement ID must look like G-XXXXXXXXXX.", 400);
    }
    const parent = `/accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`;
    const response = await this.fetcher(`${tagManagerEndpoint}${parent}/tags`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await this.getAccessToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Google tag - ConsentFlow",
        type: "googtag",
        parameter: [
          { type: "template", key: "tagId", value: normalizedMeasurementId },
          {
            type: "list",
            key: "configSettingsTable",
            list: [{
              type: "map",
              map: [
                { type: "template", key: "parameter", value: "send_page_view" },
                { type: "template", key: "parameterValue", value: "true" },
              ],
            }],
          },
        ],
        firingTriggerId: ["2147479553"],
        tagFiringOption: "oncePerEvent",
        monitoringMetadata: { type: "map" },
        consentSettings: { consentStatus: "notSet" },
      }),
    });
    return responseJson<GtmCreatedTag>(response);
  }

  async disableNavigationTriggerValidation(
    accountId: string,
    containerId: string,
    workspaceId: string,
    triggerId: string,
  ): Promise<GtmCreatedTrigger> {
    this.validateContainerPath(accountId, containerId);
    if (!/^\d+$/.test(workspaceId) || !/^\d+$/.test(triggerId)) {
      throw new GoogleIntegrationError("GTM workspace and trigger IDs must be numeric.", 400);
    }
    const path = `/accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/triggers/${triggerId}`;
    const trigger = await this.get<GtmCreatedTrigger & Record<string, unknown>>(path);
    if (trigger.type !== "linkClick") {
      throw new GoogleIntegrationError("Only a link-click trigger can disable navigation validation.", 400);
    }
    const response = await this.fetcher(`${tagManagerEndpoint}${path}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${await this.getAccessToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...trigger,
        checkValidation: { type: "boolean", value: "false" },
      }),
    });
    return responseJson<GtmCreatedTrigger>(response);
  }

  async createNavigationEventTag(
    accountId: string,
    containerId: string,
    workspaceId: string,
    measurementId: string,
    triggerId: string,
  ): Promise<GtmCreatedTag> {
    this.validateContainerPath(accountId, containerId);
    if (!/^\d+$/.test(workspaceId) || !/^\d+$/.test(triggerId)) {
      throw new GoogleIntegrationError("GTM workspace and trigger IDs must be numeric.", 400);
    }
    const normalizedMeasurementId = measurementId.trim().toUpperCase();
    if (!/^G-[A-Z0-9]+$/.test(normalizedMeasurementId)) {
      throw new GoogleIntegrationError("Measurement ID must look like G-XXXXXXXXXX.", 400);
    }
    const parent = `/accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`;
    const tagResponse = await this.fetcher(`${tagManagerEndpoint}${parent}/tags`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await this.getAccessToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "GA4 Event - navigation_click",
        type: "gaawe",
        parameter: [
          { type: "template", key: "eventName", value: "navigation_click" },
          { type: "template", key: "measurementIdOverride", value: normalizedMeasurementId },
          {
            type: "list",
            key: "eventSettingsTable",
            list: [
              {
                type: "map",
                map: [
                  { type: "template", key: "parameter", value: "link_text" },
                  { type: "template", key: "parameterValue", value: "{{Click Text}}" },
                ],
              },
              {
                type: "map",
                map: [
                  { type: "template", key: "parameter", value: "link_url" },
                  { type: "template", key: "parameterValue", value: "{{Click URL}}" },
                ],
              },
            ],
          },
        ],
        firingTriggerId: [triggerId],
        tagFiringOption: "oncePerEvent",
        monitoringMetadata: { type: "map" },
        consentSettings: { consentStatus: "notSet" },
      }),
    });
    return responseJson<GtmCreatedTag>(tagResponse);
  }

  private validateContainerPath(accountId: string, containerId: string): void {
    if (!/^\d+$/.test(accountId) || !/^\d+$/.test(containerId)) {
      throw new GoogleIntegrationError("GTM account and container IDs must be numeric.", 400);
    }
  }

  private async get<Result>(path: string): Promise<Result> {
    const response = await this.fetcher(`${tagManagerEndpoint}${path}`, {
      headers: { Authorization: `Bearer ${await this.getAccessToken()}` },
    });
    return responseJson<Result>(response);
  }

  private async listAll<Item, Result extends { nextPageToken?: string }>(
    path: string,
    collection: keyof Result,
  ): Promise<Item[]> {
    const items: Item[] = [];
    let pageToken: string | undefined;
    do {
      const url = new URL(`${tagManagerEndpoint}${path}`);
      if (pageToken) url.searchParams.set("pageToken", pageToken);
      const response = await this.fetcher(url, {
        headers: { Authorization: `Bearer ${await this.getAccessToken()}` },
      });
      const result = await responseJson<Result>(response);
      const page = result[collection] as Item[] | undefined;
      if (page) items.push(...page);
      pageToken = result.nextPageToken;
    } while (pageToken);
    return items;
  }
}
