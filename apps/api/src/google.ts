import { randomBytes } from "node:crypto";

export const GTM_READONLY_SCOPE = "https://www.googleapis.com/auth/tagmanager.readonly";

const authorizationEndpoint = "https://accounts.google.com/o/oauth2/v2/auth";
const tokenEndpoint = "https://oauth2.googleapis.com/token";
const stateLifetimeMs = 10 * 60 * 1_000;

export interface GoogleIntegrationConfig {
  enabled: boolean;
  accessToken?: string;
  baseUrl: string;
}

export interface GoogleIntegrationStatus {
  enabled: boolean;
  baseUrl: string;
  requiredEnv: string[];
}

export interface GtmAccountSummary {
  accountId: string;
  name: string;
  path: string;
}

export interface GtmContainerSummary {
  accountId: string;
  containerId: string;
  publicId: string;
  name: string;
  path: string;
  usageContext: string[];
}

export interface GtmDiscoveryResult {
  accounts: GtmAccountSummary[];
  containers: GtmContainerSummary[];
}

export interface GtmSiteResolutionRequest {
  pageUrl: string;
  detected?: {
    gtmContainers?: string[];
    ga4MeasurementIds?: string[];
  };
}

export interface GtmSiteResolutionResult {
  matchedBy: "detected-container" | "none";
  container?: GtmContainerSummary;
  measurementIds: string[];
}

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  token_type: string;
}

interface StoredTokens {
  accessToken: string;
  expiresAt: number;
  refreshToken?: string;
}

export interface GtmAccountDiscovery extends GtmAccountSummary {
  containers: GtmContainerSummary[];
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
  container: GtmContainerSummary;
  workspaces: GtmWorkspace[];
  liveVersion: GtmContainerVersion;
}

interface TagManagerAccountResponse {
  account?: Array<Partial<GtmAccountSummary>>;
  nextPageToken?: string;
}

interface TagManagerContainerResponse {
  container?: Array<Partial<GtmContainerSummary>>;
  nextPageToken?: string;
}

interface WorkspaceListResponse {
  workspace?: GtmWorkspace[];
  nextPageToken?: string;
}

type Fetch = typeof fetch;

const accessTokenEnv = "GOOGLE_OAUTH_ACCESS_TOKEN";
const defaultBaseUrl = "https://tagmanager.googleapis.com";
const gtmPublicIdPattern = /\bGTM-[A-Z0-9]+\b/gi;
const ga4MeasurementIdPattern = /\bG-(?=[A-Z0-9]*\d)[A-Z0-9]{8,15}\b/gi;

export function loadGoogleIntegrationConfig(
  env: NodeJS.ProcessEnv = process.env,
): GoogleIntegrationConfig {
  const accessToken = env[accessTokenEnv]?.trim();
  const baseUrl = env.GOOGLE_TAG_MANAGER_API_BASE_URL?.trim() || defaultBaseUrl;
  return accessToken
    ? { enabled: true, accessToken, baseUrl }
    : { enabled: false, baseUrl };
}

export function googleIntegrationStatus(config: GoogleIntegrationConfig): GoogleIntegrationStatus {
  return {
    enabled: config.enabled,
    baseUrl: config.baseUrl,
    requiredEnv: config.enabled ? [] : [accessTokenEnv],
  };
}

export class GoogleIntegrationDisabledError extends Error {
  constructor() {
    super(`${accessTokenEnv} is required before real Google Tag Manager discovery can run.`);
  }
}

export class GoogleIntegrationError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export function googleOAuthConfig(
  environment: NodeJS.ProcessEnv = process.env,
): GoogleOAuthConfig | undefined {
  const clientId = environment.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = environment.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  const redirectUri = environment.GOOGLE_OAUTH_REDIRECT_URI?.trim();
  if (!clientId || !clientSecret || !redirectUri) return undefined;
  return { clientId, clientSecret, redirectUri };
}

async function getJson<T>(
  fetchImpl: Fetch,
  config: GoogleIntegrationConfig,
  path: string,
): Promise<T> {
  if (!config.enabled || !config.accessToken) throw new GoogleIntegrationDisabledError();

  const response = await fetchImpl(new URL(path, config.baseUrl), {
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Google Tag Manager API returned ${response.status}: ${detail}`);
  }

  return response.json() as Promise<T>;
}

async function responseJson<T>(response: Response): Promise<T> {
  const value = (await response.json()) as T & { error?: string; error_description?: string };
  if (!response.ok) {
    const detail = value.error_description ?? value.error ?? `HTTP ${response.status}`;
    throw new GoogleIntegrationError(`Google API request failed: ${detail}`, response.status);
  }
  return value;
}

function pagedPath(path: string, pageToken: string | undefined): string {
  if (!pageToken) return path;
  const url = new URL(path, defaultBaseUrl);
  url.searchParams.set("pageToken", pageToken);
  return `${url.pathname}${url.search}`;
}

function accountSummary(account: Partial<GtmAccountSummary>): GtmAccountSummary | undefined {
  if (!account.accountId || !account.name || !account.path) return undefined;
  return {
    accountId: account.accountId,
    name: account.name,
    path: account.path,
  };
}

function containerSummary(container: Partial<GtmContainerSummary>): GtmContainerSummary | undefined {
  if (!container.accountId || !container.containerId || !container.publicId || !container.name || !container.path) {
    return undefined;
  }
  return {
    accountId: container.accountId,
    containerId: container.containerId,
    publicId: container.publicId,
    name: container.name,
    path: container.path,
    usageContext: container.usageContext ?? [],
  };
}

export async function discoverGtmContainers(
  config: GoogleIntegrationConfig,
  fetchImpl: Fetch = fetch,
): Promise<GtmDiscoveryResult> {
  const accounts: GtmAccountSummary[] = [];
  let accountPageToken: string | undefined;
  do {
    const accountResponse = await getJson<TagManagerAccountResponse>(
      fetchImpl,
      config,
      pagedPath("/tagmanager/v2/accounts", accountPageToken),
    );
    accounts.push(
      ...(accountResponse.account ?? []).flatMap((account) => {
        const summary = accountSummary(account);
        return summary ? [summary] : [];
      }),
    );
    accountPageToken = accountResponse.nextPageToken;
  } while (accountPageToken);

  const containers = (
    await Promise.all(
      accounts.map(async (account) => {
        const accountContainers: GtmContainerSummary[] = [];
        let containerPageToken: string | undefined;
        do {
          const containerResponse = await getJson<TagManagerContainerResponse>(
            fetchImpl,
            config,
            pagedPath(`/tagmanager/v2/${account.path}/containers`, containerPageToken),
          );
          accountContainers.push(
            ...(containerResponse.container ?? []).flatMap((container) => {
              const summary = containerSummary(container);
              return summary ? [summary] : [];
            }),
          );
          containerPageToken = containerResponse.nextPageToken;
        } while (containerPageToken);
        return accountContainers;
      }),
    )
  ).flat();

  return { accounts, containers };
}

export class GoogleOAuthSession {
  private readonly states = new Map<string, number>();
  private tokens: StoredTokens | undefined;

  constructor(
    private readonly config: GoogleOAuthConfig,
    private readonly fetcher: Fetch = fetch,
    private readonly now: () => number = Date.now,
  ) {}

  isConnected(): boolean {
    return this.tokens !== undefined;
  }

  authorizationUrl(): string {
    this.removeExpiredStates();
    const state = randomBytes(32).toString("base64url");
    this.states.set(state, this.now() + stateLifetimeMs);
    const url = new URL(authorizationEndpoint);
    url.search = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: "code",
      scope: GTM_READONLY_SCOPE,
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
    this.tokens = this.store(await responseJson<GoogleTokenResponse>(response));
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
    this.tokens = this.store(await responseJson<GoogleTokenResponse>(response), this.tokens.refreshToken);
    return this.tokens.accessToken;
  }

  private store(result: GoogleTokenResponse, existingRefreshToken?: string): StoredTokens {
    if (!result.access_token || !Number.isFinite(result.expires_in)) {
      throw new GoogleIntegrationError("Google returned an invalid OAuth token response.", 502);
    }
    const refreshToken = result.refresh_token ?? existingRefreshToken;
    return {
      accessToken: result.access_token,
      expiresAt: this.now() + result.expires_in * 1_000,
      ...(refreshToken ? { refreshToken } : {}),
    };
  }

  private removeExpiredStates(): void {
    for (const [state, expiry] of this.states) {
      if (expiry < this.now()) this.states.delete(state);
    }
  }
}

export class GtmDiscoveryClient {
  constructor(
    private readonly getAccessToken: () => Promise<string>,
    private readonly fetcher: Fetch = fetch,
    private readonly baseUrl: string = defaultBaseUrl,
  ) {}

  async discover(): Promise<GtmAccountDiscovery[]> {
    const accounts = await this.listAll<GtmAccountSummary, TagManagerAccountResponse>(
      "/tagmanager/v2/accounts",
      "account",
    );
    return Promise.all(
      accounts.map(async (account) => ({
        ...account,
        containers: await this.listAll<GtmContainerSummary, TagManagerContainerResponse>(
          `/tagmanager/v2/${account.path}/containers`,
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
    const parent = `/tagmanager/v2/accounts/${accountId}/containers/${containerId}`;
    const [container, workspaces, liveVersion] = await Promise.all([
      this.get<GtmContainerSummary>(parent),
      this.listAll<GtmWorkspace, WorkspaceListResponse>(`${parent}/workspaces`, "workspace"),
      this.get<GtmContainerVersion>(`${parent}/versions:live`),
    ]);
    return { container, workspaces, liveVersion };
  }

  private async get<Result>(path: string): Promise<Result> {
    const response = await this.fetcher(new URL(path, this.baseUrl), {
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
      const url = new URL(path, this.baseUrl);
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

function normalizedUnique(values: Array<string | undefined>, pattern: RegExp): string[] {
  const ids = new Set<string>();
  for (const value of values) {
    if (!value) continue;
    for (const match of value.matchAll(pattern)) {
      ids.add(match[0]!.toUpperCase());
    }
  }
  return [...ids].sort();
}

function extractMeasurementIds(value: unknown): string[] {
  return normalizedUnique([JSON.stringify(value)], ga4MeasurementIdPattern);
}

export async function resolveGtmSite(
  config: GoogleIntegrationConfig,
  request: GtmSiteResolutionRequest,
  fetchImpl: Fetch = fetch,
): Promise<GtmSiteResolutionResult> {
  const detectedContainers = normalizedUnique(request.detected?.gtmContainers ?? [], gtmPublicIdPattern);
  if (detectedContainers.length === 0) {
    return { matchedBy: "none", measurementIds: [] };
  }

  const discovery = await discoverGtmContainers(config, fetchImpl);
  const matchedContainer = discovery.containers.find((container) =>
    detectedContainers.includes(container.publicId.toUpperCase()),
  );
  if (!matchedContainer) {
    return { matchedBy: "none", measurementIds: [] };
  }

  const liveVersion = await getJson<unknown>(
    fetchImpl,
    config,
    `/tagmanager/v2/${matchedContainer.path}/versions:live`,
  );

  return {
    matchedBy: "detected-container",
    container: matchedContainer,
    measurementIds: extractMeasurementIds(liveVersion),
  };
}
