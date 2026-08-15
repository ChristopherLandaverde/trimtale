import { randomBytes } from "node:crypto";

export const GTM_READONLY_SCOPE = "https://www.googleapis.com/auth/tagmanager.readonly";
export const GTM_EDIT_CONTAINERS_SCOPE =
  "https://www.googleapis.com/auth/tagmanager.edit.containers";

const authorizationEndpoint = "https://accounts.google.com/o/oauth2/v2/auth";
const tokenEndpoint = "https://oauth2.googleapis.com/token";
const tagManagerEndpoint = "https://tagmanager.googleapis.com/tagmanager/v2";
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
  const value = (await response.json()) as T & { error?: string; error_description?: string };
  if (!response.ok) {
    const detail = value.error_description ?? value.error ?? `HTTP ${response.status}`;
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
  ) {}

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
    ) {
      scopes.push(GTM_EDIT_CONTAINERS_SCOPE);
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
  trigger: GtmCreatedTrigger;
  tag: GtmCreatedTag;
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
        checkValidation: { type: "boolean", value: "true" },
      }),
    });
    const trigger = await responseJson<GtmCreatedTrigger>(triggerResponse);

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
          { type: "template", key: "measurementId", value: normalizedMeasurementId },
          {
            type: "list",
            key: "eventParameters",
            list: [
              {
                type: "map",
                map: [
                  { type: "template", key: "name", value: "link_text" },
                  { type: "template", key: "value", value: "{{Click Text}}" },
                ],
              },
              {
                type: "map",
                map: [
                  { type: "template", key: "name", value: "link_url" },
                  { type: "template", key: "value", value: "{{Click URL}}" },
                ],
              },
            ],
          },
        ],
        firingTriggerId: [trigger.triggerId],
        tagFiringOption: "oncePerEvent",
        monitoringMetadata: { type: "map" },
        consentSettings: { consentStatus: "notSet" },
      }),
    });
    const tag = await responseJson<GtmCreatedTag>(tagResponse);
    return {
      builtInVariables: builtInVariables.builtInVariable ?? [],
      trigger,
      tag,
    };
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
