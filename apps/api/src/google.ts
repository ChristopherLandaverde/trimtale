import { randomBytes } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import { ANALYTICS_EDIT_SCOPE, ANALYTICS_READONLY_SCOPE, AnalyticsAccess } from "./analytics.js";
import {
  assertTrackingOperation,
  createTrackingChangePlan,
  fingerprintTrackingChangeActions,
  GTM_MANAGED_ENTITY_NOTE,
  GTM_MANAGED_WORKSPACE_DESCRIPTION,
  GTM_MANAGED_WORKSPACE_NAME,
  GTM_REST_PARAMETER_KEY_ALIASES,
  GTM_REST_PROPERTY_ALIASES,
  GTM_REST_STRING_ALIASES,
  inspectManagedWorkspace,
  normalizePublicContainerId,
  publicationApprovalCurrent,
  recognizeContainer,
  type GtmContainerExport,
  type GtmEntitySet,
  type ManagedWorkspaceInspection,
  type ContainerInventorySnapshotV1,
  type TrackingChangePlan,
  type TrackingChangeAction,
  type TrackingSetupOperationV1,
} from "@gtm-observability/core";

export const GTM_READONLY_SCOPE = "https://www.googleapis.com/auth/tagmanager.readonly";
export const GTM_EDIT_CONTAINERS_SCOPE = "https://www.googleapis.com/auth/tagmanager.edit.containers";
export const GTM_EDIT_CONTAINER_VERSIONS_SCOPE = "https://www.googleapis.com/auth/tagmanager.edit.containerversions";
export const GTM_PUBLISH_SCOPE = "https://www.googleapis.com/auth/tagmanager.publish";

const authorizationEndpoint = "https://accounts.google.com/o/oauth2/v2/auth";
const tokenEndpoint = "https://oauth2.googleapis.com/token";
const tagManagerEndpoint = "https://tagmanager.googleapis.com/tagmanager/v2";
const stateLifetimeMs = 10 * 60 * 1_000;

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
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

export type GtmObservedContainerInspection =
  | { status: "not_accessible"; publicId: string }
  | { status: "ambiguous"; publicId: string; matchCount: number }
  | {
    status: "recognized";
    publicId: string;
    account: Pick<GtmAccount, "accountId" | "name">;
    container: GtmContainer;
    measurementIds: string[];
    liveVersion: GtmContainerVersion;
    workspace: ManagedWorkspaceInspection<GtmWorkspace>;
  };

export type GtmManagedWorkspacePreparation =
  | { status: "not_accessible"; publicId: string }
  | { status: "ambiguous"; publicId: string; matchCount: number }
  | {
    status: "recognized";
    publicId: string;
    container: GtmContainer;
    liveVersion: GtmContainerVersion;
    workspace:
      | { status: "created" | "reused"; workspaceCount: number; workspace: GtmWorkspace }
      | { status: "capacity_blocked"; workspaceCount: number }
      | {
        status: "ownership_conflict";
        workspaceCount: number;
        managedWorkspaceCount: number;
        reservedNameCount: number;
      }
      | { status: "sync_conflict"; workspaceCount: number; workspace: GtmWorkspace };
  };

export type GtmManagedWorkspacePlanning =
  | { status: "not_accessible"; publicId: string }
  | { status: "ambiguous"; publicId: string; matchCount: number }
  | {
    status: "workspace_required" | "workspace_unavailable";
    publicId: string;
    container: GtmContainer;
    workspace: ManagedWorkspaceInspection<GtmWorkspace>;
  }
  | {
    status: "planned";
    publicId: string;
    container: GtmContainer;
    workspace: GtmWorkspace;
    workspaceFingerprint?: string;
    plan: TrackingChangePlan;
  };

export type GtmManagedWorkspaceApplication =
  | {
    status: "applied";
    completedActionSignatures: string[];
    workspaceFingerprint?: string;
    plan: TrackingChangePlan;
  }
  | {
    status: "blocked";
    reason:
      | "not_accessible"
      | "ambiguous"
      | "workspace_unavailable"
      | "ownership_conflict"
      | "sync_conflict"
      | "stale_workspace"
      | "stale_plan";
    completedActionSignatures: string[];
  }
  | {
    status: "partial_failure";
    failedActionSignature: string;
    completedActionSignatures: string[];
    message: string;
  };

type Fetch = typeof fetch;

export function googleOAuthConfig(
  environment: NodeJS.ProcessEnv = process.env,
): GoogleOAuthConfig | undefined {
  const clientId = environment.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = environment.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  const redirectUri = environment.GOOGLE_OAUTH_REDIRECT_URI?.trim();
  if (!clientId || !clientSecret || !redirectUri) return undefined;
  return { clientId, clientSecret, redirectUri };
}

export function googleGtmWritesEnabled(
  environment: NodeJS.ProcessEnv = process.env,
): boolean {
  return environment.GOOGLE_GTM_CONTAINER_WRITES_ENABLED === "true";
}

export function googleGtmPublicationEnabled(environment: NodeJS.ProcessEnv = process.env): boolean {
  return environment.GOOGLE_GTM_PUBLICATION_ENABLED === "true";
}

export function googleGtmPublicationScopeRequested(
  environment: NodeJS.ProcessEnv = process.env,
): boolean {
  return environment.GOOGLE_GTM_PUBLICATION_SCOPE_REQUESTED === "true";
}

export function googleGtmWriteTargetPublicId(
  environment: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const publicId = environment.GOOGLE_GTM_WRITE_TARGET_PUBLIC_ID?.trim();
  return publicId ? normalizePublicContainerId(publicId) : undefined;
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
  const value = (await response.json()) as T & {
    error?: string | { message?: string; status?: string };
    error_description?: string;
  };
  if (!response.ok) {
    const detail = value.error_description
      ?? (typeof value.error === "string" ? value.error : value.error?.message)
      ?? `HTTP ${response.status}`;
    throw new GoogleIntegrationError(`Google API request failed: ${detail}`, response.status);
  }
  return value;
}

export interface GoogleOAuthTokenStore {
  load(): string | undefined;
  save(refreshToken: string): void;
  clear(): void;
}

interface StoredRefreshTokenV1 {
  schemaVersion: 1;
  clientId: string;
  refreshToken: string;
}

export class FileGoogleOAuthTokenStore implements GoogleOAuthTokenStore {
  constructor(
    readonly filePath: string,
    private readonly clientId: string,
  ) {}

  load(): string | undefined {
    if (!existsSync(this.filePath)) return undefined;
    if ((statSync(this.filePath).mode & 0o077) !== 0) {
      throw new Error("Google OAuth token store must not be readable by group or other users.");
    }
    let value: unknown;
    try {
      value = JSON.parse(readFileSync(this.filePath, "utf8"));
    } catch {
      throw new Error("Google OAuth token store is corrupted.");
    }
    if (!isJsonRecord(value) || value.schemaVersion !== 1
      || value.clientId !== this.clientId
      || typeof value.refreshToken !== "string" || !value.refreshToken.trim()) {
      throw new Error("Google OAuth token store is invalid for this OAuth client.");
    }
    return value.refreshToken;
  }

  save(refreshToken: string): void {
    const value: StoredRefreshTokenV1 = {
      schemaVersion: 1,
      clientId: this.clientId,
      refreshToken,
    };
    mkdirSync(dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.${process.pid}.${randomBytes(8).toString("hex")}.tmp`;
    writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    renameSync(temporaryPath, this.filePath);
  }

  clear(): void {
    if (existsSync(this.filePath)) unlinkSync(this.filePath);
  }
}

export class GoogleOAuthSession {
  private readonly states = new Map<string, number>();
  private tokens: StoredTokens | undefined;

  constructor(
    private readonly config: GoogleOAuthConfig,
    private readonly fetcher: Fetch = fetch,
    private readonly now: () => number = Date.now,
    private readonly containerWritesEnabled = false,
    private readonly publicationScopeRequested = false,
    private readonly tokenStore?: GoogleOAuthTokenStore,
    private readonly analyticsAccess = AnalyticsAccess.None,
  ) {
    const refreshToken = tokenStore?.load();
    if (refreshToken) {
      this.tokens = { accessToken: "", expiresAt: 0, refreshToken };
    }
  }

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
      scope: [
        GTM_READONLY_SCOPE,
        ...(this.containerWritesEnabled ? [GTM_EDIT_CONTAINERS_SCOPE, GTM_EDIT_CONTAINER_VERSIONS_SCOPE] : []),
        ...(this.publicationScopeRequested ? [GTM_PUBLISH_SCOPE] : []),
        ...(this.analyticsAccess === AnalyticsAccess.Read ? [ANALYTICS_READONLY_SCOPE] : []),
        ...(this.analyticsAccess === AnalyticsAccess.Edit ? [ANALYTICS_EDIT_SCOPE] : []),
      ].join(" "),
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
    this.tokens = this.store(result, this.tokens?.refreshToken);
  }

  async accessToken(): Promise<string> {
    if (!this.tokens) throw new GoogleIntegrationError("Google Tag Manager is not connected.", 401);
    if (this.tokens.expiresAt > this.now() + 30_000) return this.tokens.accessToken;
    if (!this.tokens.refreshToken) {
      this.tokens = undefined;
      throw new GoogleIntegrationError("Google authorization expired. Connect again.", 401);
    }
    try {
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
    } catch (error) {
      if (error instanceof GoogleIntegrationError && (error.status === 400 || error.status === 401)) {
        this.tokens = undefined;
        this.tokenStore?.clear();
      }
      throw error;
    }
  }

  private store(result: GoogleTokenResponse, existingRefreshToken?: string): StoredTokens {
    if (!result.access_token || !Number.isFinite(result.expires_in)) {
      throw new GoogleIntegrationError("Google returned an invalid OAuth token response.", 502);
    }
    const refreshToken = result.refresh_token ?? existingRefreshToken;
    if (this.tokenStore && !refreshToken) {
      throw new GoogleIntegrationError("Google did not return the required offline refresh token.", 502);
    }
    if (refreshToken) this.tokenStore?.save(refreshToken);
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

interface WorkspaceSyncResponse {
  syncStatus?: { mergeConflict?: boolean; syncError?: boolean };
  mergeConflict?: unknown[];
}

interface WorkspaceStatusResponse {
  workspaceChange?: unknown[];
  mergeConflict?: unknown[];
}

interface WorkspacePreviewResponse {
  containerVersion?: GtmContainerVersion;
  syncStatus?: { mergeConflict?: boolean; syncError?: boolean };
  compilerError?: boolean;
}

interface WorkspaceCreateVersionResponse extends WorkspacePreviewResponse {
  newWorkspacePath?: string;
}

interface PublishVersionResponse {
  containerVersion?: GtmContainerVersion;
  compilerError?: boolean;
}

export interface GtmWorkspaceValidationEvidence {
  status: "passed" | "failed";
  checkedAt: string;
  workspaceFingerprint: string;
  errors: string[];
  workspaceChanges: unknown[];
  previewVersionFingerprint?: string;
}

export type GtmValidatedVersionResult =
  | {
    status: "versioned";
    validation: GtmWorkspaceValidationEvidence;
    version: {
      path: string;
      fingerprint: string;
      priorLiveVersionPath: string;
      priorLiveVersionFingerprint: string;
    };
  }
  | { status: "blocked"; validation: GtmWorkspaceValidationEvidence };

interface TagListResponse {
  tag?: unknown[];
  nextPageToken?: string;
}

interface TriggerListResponse {
  trigger?: unknown[];
  nextPageToken?: string;
}

interface VariableListResponse {
  variable?: unknown[];
  nextPageToken?: string;
}

interface BuiltInVariableListResponse {
  builtInVariable?: unknown[];
  nextPageToken?: string;
}

export class GtmDiscoveryClient {
  private readonly preparations = new Map<string, Promise<GtmManagedWorkspacePreparation>>();
  private readonly writeTargetPublicId: string | undefined;

  constructor(
    private readonly getAccessToken: () => Promise<string>,
    private readonly fetcher: Fetch = fetch,
    private readonly containerWritesEnabled = false,
    private readonly publicationEnabled = false,
    private readonly now: () => number = Date.now,
    private readonly wait: (milliseconds: number) => Promise<void> = (milliseconds) =>
      new Promise((resolve) => setTimeout(resolve, milliseconds)),
    writeTargetPublicId?: string,
  ) {
    this.writeTargetPublicId = writeTargetPublicId
      ? normalizePublicContainerId(writeTargetPublicId)
      : undefined;
  }

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

  async captureContainerInventory(
    organizationId: string,
    googleConnectionId: string,
  ): Promise<ContainerInventorySnapshotV1> {
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(organizationId)
      || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(googleConnectionId)) {
      throw new GoogleIntegrationError("Organization and Google connection IDs are required.", 400);
    }
    const accounts = await this.discover();
    const webContainers = accounts.flatMap((account) => account.containers
      .filter((container) => container.usageContext.some((context) => context.toUpperCase() === "WEB"))
      .map((container) => ({ account, container })));
    const containers = await Promise.all(webContainers.map(async ({ account, container }) => {
      let context: GtmContainerEntityContext | undefined;
      try {
        context = await this.containerEntityContext(container.accountId, container.containerId);
      } catch {
        context = undefined;
      }
      const measurementIds = context ? ga4MeasurementIds(context.liveVersion).sort() : [];
      return {
        account: { id: account.accountId, name: account.name },
        container: {
          id: container.containerId,
          publicId: container.publicId.toUpperCase(),
          name: container.name,
          usageContext: "WEB" as const,
        },
        access: {
          status: "unavailable" as const,
          reason: "permission_scope_not_granted" as const,
        },
        liveVersion: context?.liveVersion.path && context.liveVersion.fingerprint
          ? {
            status: "observed" as const,
            path: context.liveVersion.path,
            fingerprint: context.liveVersion.fingerprint,
          }
          : { status: "unavailable" as const },
        workspaces: (context?.workspaces ?? []).map((workspace) => ({
          path: workspace.path,
          id: workspace.workspaceId,
          name: workspace.name,
          fingerprint: workspace.fingerprint ?? null,
        })).sort((left, right) => left.id.localeCompare(right.id)),
        ga4: {
          measurementIds,
          context: measurementIds.length > 1 ? "ambiguous" as const : "unavailable" as const,
        },
      };
    }));
    return {
      schemaVersion: 1,
      organizationId,
      googleConnectionId,
      capturedAt: new Date(this.now()).toISOString(),
      containers: containers.sort((left, right) => left.container.publicId.localeCompare(right.container.publicId)),
    };
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

  async inspectObservedContainer(publicId: string): Promise<GtmObservedContainerInspection> {
    const recognition = await this.recognizeObservedContainer(publicId);
    if (recognition.status !== "recognized") return recognition;
    const context = await this.containerEntityContext(
      recognition.container.accountId,
      recognition.container.containerId,
    );
    return {
      ...recognition,
      container: context.container,
      measurementIds: ga4MeasurementIds(context.liveVersion),
      liveVersion: context.liveVersion,
      workspace: inspectManagedWorkspace(context.workspaces),
    };
  }

  async workspaceEntitySet(workspace: GtmWorkspace): Promise<GtmEntitySet> {
    if (!/^accounts\/\d+\/containers\/\d+\/workspaces\/\d+$/.test(workspace.path)) {
      throw new GoogleIntegrationError("GTM workspace path is malformed.", 400);
    }
    const parent = `/${workspace.path}`;
    const [tag, trigger, variable, builtInVariable] = await Promise.all([
      this.listAll<unknown, TagListResponse>(`${parent}/tags`, "tag"),
      this.listAll<unknown, TriggerListResponse>(`${parent}/triggers`, "trigger"),
      this.listAll<unknown, VariableListResponse>(`${parent}/variables`, "variable"),
      this.listAll<unknown, BuiltInVariableListResponse>(
        `${parent}/built_in_variables`,
        "builtInVariable",
      ),
    ]);
    return { tag, trigger, variable, builtInVariable };
  }

  async planManagedWorkspace(
    publicId: string,
    generatedSetup: GtmContainerExport,
  ): Promise<GtmManagedWorkspacePlanning> {
    const normalizedPublicId = normalizePublicContainerId(publicId);
    if (
      normalizePublicContainerId(generatedSetup.containerVersion.container.publicId)
      !== normalizedPublicId
    ) {
      throw new GoogleIntegrationError(
        "Generated tracking setup does not belong to the observed GTM container.",
        400,
      );
    }

    const inspection = await this.inspectObservedContainer(normalizedPublicId);
    if (inspection.status !== "recognized") return inspection;
    if (inspection.workspace.status !== "available") {
      return {
        status: "workspace_unavailable",
        publicId: inspection.publicId,
        container: inspection.container,
        workspace: inspection.workspace,
      };
    }
    if (inspection.workspace.action === "create") {
      return {
        status: "workspace_required",
        publicId: inspection.publicId,
        container: inspection.container,
        workspace: inspection.workspace,
      };
    }

    this.assertWorkspacePath(inspection.workspace.workspace, inspection.container);
    const entities = await this.workspaceEntitySet(inspection.workspace.workspace);
    return {
      status: "planned",
      publicId: inspection.publicId,
      container: inspection.container,
      workspace: inspection.workspace.workspace,
      ...(inspection.workspace.workspace.fingerprint
        ? { workspaceFingerprint: inspection.workspace.workspace.fingerprint }
        : {}),
      plan: createTrackingChangePlan(generatedSetup, entities),
    };
  }

  async prepareManagedWorkspace(publicId: string): Promise<GtmManagedWorkspacePreparation> {
    if (!this.containerWritesEnabled) {
      throw new GoogleIntegrationError("GTM container writes are disabled on this backend.", 403);
    }
    const normalized = normalizePublicContainerId(publicId);
    this.assertWriteTarget(normalized);

    const pending = this.preparations.get(normalized);
    if (pending) return pending;
    const preparation = this.prepareManagedWorkspaceOnce(normalized).finally(() => {
      this.preparations.delete(normalized);
    });
    this.preparations.set(normalized, preparation);
    return preparation;
  }

  async applyManagedWorkspace(
    operation: TrackingSetupOperationV1,
  ): Promise<GtmManagedWorkspaceApplication> {
    if (!this.containerWritesEnabled) {
      throw new GoogleIntegrationError("GTM container writes are disabled on this backend.", 403);
    }
    assertTrackingOperation(operation);
    this.assertWriteTarget(operation.container.publicId);

    if (operation.status !== "planned" && operation.status !== "applying") {
      throw new GoogleIntegrationError("Only planned or applying tracking operations can be applied.", 409);
    }
    const completed = new Set(operation.completedActionSignatures);
    const blocked = (reason: Extract<GtmManagedWorkspaceApplication, { status: "blocked" }>["reason"]): GtmManagedWorkspaceApplication => ({
      status: "blocked",
      reason,
      completedActionSignatures: [...completed],
    });
    if (fingerprintTrackingChangeActions(operation.plan.actions) !== operation.plan.fingerprint) {
      return blocked("stale_plan");
    }
    if (operation.plan.status === "conflict") return blocked("ownership_conflict");

    const inspection = await this.inspectObservedContainer(operation.container.publicId);
    if (inspection.status === "not_accessible") return blocked("not_accessible");
    if (inspection.status === "ambiguous") return blocked("ambiguous");
    if (inspection.workspace.status !== "available" || inspection.workspace.action !== "reuse") {
      return blocked(inspection.workspace.status === "ownership_conflict"
        ? "ownership_conflict"
        : "workspace_unavailable");
    }
    if (inspection.workspace.workspace.path !== operation.workspace.path
      || inspection.workspace.workspace.fingerprint !== operation.workspace.fingerprint) {
      return blocked("stale_workspace");
    }

    const sync = await this.post<WorkspaceSyncResponse>(`/${operation.workspace.path}:sync`);
    const status = await this.get<WorkspaceStatusResponse>(`/${operation.workspace.path}/status`);
    if (sync.syncStatus?.mergeConflict || sync.syncStatus?.syncError
      || (sync.mergeConflict?.length ?? 0) > 0 || (status.mergeConflict?.length ?? 0) > 0) {
      return blocked("sync_conflict");
    }

    for (const expected of operation.plan.actions) {
      const fresh = await this.planBoundManagedWorkspace(operation);
      if (fresh.status !== "planned" || fresh.workspace.path !== operation.workspace.path) {
        return blocked(fresh.status === "workspace_unavailable" ? "ownership_conflict" : "stale_workspace");
      }
      const observed = fresh.plan.actions.find((candidate) => sameActionIdentity(candidate, expected));
      if (!observed) return blocked("stale_plan");
      const current = observed.action === "conflict" && expected.action === "update"
        ? approvedFreshAction(operation, observed, expected)
        : observed;
      if (!current) return blocked("stale_plan");
      if (current.action === "conflict") return blocked("ownership_conflict");

      if (completed.has(expected.entitySignature)) {
        if (current.action === "create" || current.action === "update") return blocked("stale_plan");
        continue;
      }
      if (current.action === "reuse" || current.action === "no_op") {
        completed.add(expected.entitySignature);
        continue;
      }
      if ((current.action !== "create" && current.action !== "update") || current.action !== expected.action) {
        return blocked("stale_plan");
      }

      try {
        await this.applyEntityAction(
          operation.generatedSetup,
          fresh,
          current as TrackingChangeAction & { action: "create" | "update" },
        );
        completed.add(expected.entitySignature);
      } catch (error) {
        return {
          status: "partial_failure",
          failedActionSignature: expected.entitySignature,
          completedActionSignatures: [...completed],
          message: error instanceof Error ? error.message : "Google entity write failed.",
        };
      }
    }

    const finalPlan = await this.planBoundManagedWorkspace(operation);
    if (finalPlan.status !== "planned"
      || finalPlan.plan.actions.some(({ action }) => action !== "reuse" && action !== "no_op")) {
      return blocked("stale_plan");
    }
    return {
      status: "applied",
      completedActionSignatures: [...completed],
      ...(finalPlan.workspaceFingerprint ? { workspaceFingerprint: finalPlan.workspaceFingerprint } : {}),
      plan: finalPlan.plan,
    };
  }

  async validateManagedWorkspace(
    operation: TrackingSetupOperationV1,
  ): Promise<GtmWorkspaceValidationEvidence> {
    if (!this.containerWritesEnabled) {
      throw new GoogleIntegrationError("GTM container-version writes are disabled on this backend.", 403);
    }
    assertTrackingOperation(operation);
    this.assertWriteTarget(operation.container.publicId);

    if (!["applied", "validation_failed", "validated", "draft_verified"].includes(operation.status)) {
      throw new GoogleIntegrationError("Only applied tracking operations can be validated.", 409);
    }
    const validation = await this.validateWorkspaceState(operation);
    if (validation.status !== "passed") {
      return validation;
    }
    const preview = await this.post<WorkspacePreviewResponse>(`/${operation.workspace.path}:quick_preview`);
    if (preview.syncStatus?.mergeConflict || preview.syncStatus?.syncError) {
      return {
        ...validation,
        status: "failed",
        errors: ["GTM could not synchronize the validation preview."],
      };
    }
    if (preview.compilerError || !preview.containerVersion?.fingerprint) {
      return {
        ...validation,
        status: "failed",
        errors: ["GTM reported compiler errors for the workspace preview."],
      };
    }
    return {
      ...validation,
      previewVersionFingerprint: preview.containerVersion.fingerprint,
    };
  }

  private async validateWorkspaceState(
    operation: TrackingSetupOperationV1,
  ): Promise<GtmWorkspaceValidationEvidence> {
    const checkedAt = new Date().toISOString();
    const failed = (workspaceFingerprint: string, workspaceChanges: unknown[], errors: string[]): GtmWorkspaceValidationEvidence => ({
      status: "failed", checkedAt, workspaceFingerprint, errors, workspaceChanges,
    });
    const inspection = await this.inspectObservedContainer(operation.container.publicId);
    if (inspection.status !== "recognized" || inspection.workspace.status !== "available"
      || inspection.workspace.action !== "reuse") {
      return failed(operation.workspace.fingerprint, [], ["The recognized managed workspace is unavailable."]);
    }
    const currentWorkspace = inspection.workspace.workspace;
    if (currentWorkspace.path !== operation.workspace.path
      || currentWorkspace.fingerprint !== operation.workspace.fingerprint) {
      return failed(currentWorkspace.fingerprint ?? "unknown", [], ["The managed workspace fingerprint changed."]);
    }
    const status = await this.get<WorkspaceStatusResponse>(`/${currentWorkspace.path}/status`);
    const changes = status.workspaceChange ?? [];
    if ((status.mergeConflict?.length ?? 0) > 0) {
      return failed(currentWorkspace.fingerprint ?? "unknown", changes, ["The managed workspace has merge conflicts."]);
    }
    const unexpected = changes.filter((change) => !expectedWorkspaceChange(change, operation.generatedSetup));
    if (unexpected.length > 0) {
      return failed(currentWorkspace.fingerprint ?? "unknown", changes, ["The managed workspace contains unexpected changes."]);
    }
    const freshPlan = await this.planManagedWorkspace(operation.container.publicId, operation.generatedSetup);
    if (freshPlan.status !== "planned" || freshPlan.workspace.path !== operation.workspace.path
      || freshPlan.plan.actions.some(({ action }) => action !== "reuse" && action !== "no_op")) {
      return failed(currentWorkspace.fingerprint ?? "unknown", changes, ["Workspace entities do not match the approved tracking change plan."]);
    }
    return {
      status: "passed",
      checkedAt,
      workspaceFingerprint: currentWorkspace.fingerprint ?? "unknown",
      errors: [],
      workspaceChanges: changes,
    };
  }

  private async planBoundManagedWorkspace(
    operation: TrackingSetupOperationV1,
  ): Promise<GtmManagedWorkspacePlanning> {
    const container = await this.get<GtmContainer>(`/${operation.container.path}`);
    if (container.path !== operation.container.path
      || normalizePublicContainerId(container.publicId)
        !== normalizePublicContainerId(operation.container.publicId)) {
      return { status: "not_accessible", publicId: operation.container.publicId };
    }
    const workspaces = await this.listAll<GtmWorkspace, WorkspaceListResponse>(
      `/${container.path}/workspaces`,
      "workspace",
    );
    const decision = inspectManagedWorkspace(workspaces);
    if (decision.status !== "available" || decision.action !== "reuse") {
      return {
        status: "workspace_unavailable",
        publicId: operation.container.publicId,
        container,
        workspace: decision,
      };
    }
    this.assertWorkspacePath(decision.workspace, container);
    if (decision.workspace.path !== operation.workspace.path) {
      return {
        status: "workspace_unavailable",
        publicId: operation.container.publicId,
        container,
        workspace: decision,
      };
    }
    const entities = await this.workspaceEntitySet(decision.workspace);
    return {
      status: "planned",
      publicId: operation.container.publicId,
      container,
      workspace: decision.workspace,
      ...(decision.workspace.fingerprint
        ? { workspaceFingerprint: decision.workspace.fingerprint }
        : {}),
      plan: createTrackingChangePlan(operation.generatedSetup, entities),
    };
  }

  async createValidatedVersion(
    operation: TrackingSetupOperationV1,
  ): Promise<GtmValidatedVersionResult> {
    if (!this.containerWritesEnabled) {
      throw new GoogleIntegrationError("GTM container-version writes are disabled on this backend.", 403);
    }
    assertTrackingOperation(operation);
    this.assertWriteTarget(operation.container.publicId);

    if (operation.status !== "validated" && operation.status !== "draft_verified") {
      throw new GoogleIntegrationError("Only validated or exact-draft-verified tracking operations can create a version.", 409);
    }
    if (operation.previewPolicy === "exact_draft_required" && operation.status !== "draft_verified") {
      throw new GoogleIntegrationError("Exact browser preview is required before version creation.", 409);
    }
    let validation = operation.status === "draft_verified"
      ? await this.validateWorkspaceState(operation)
      : await this.validateManagedWorkspace(operation);
    if (validation.status !== "passed") return { status: "blocked", validation };
    if (operation.status === "draft_verified") {
      const previewFingerprint = operation.draftVerification?.previewVersionFingerprint;
      if (!previewFingerprint) {
        throw new GoogleIntegrationError("Exact browser preview evidence is missing.", 409);
      }
      validation = {
        ...validation,
        previewVersionFingerprint: previewFingerprint,
      };
    }
    const inspection = await this.inspectObservedContainer(operation.container.publicId);
    if (inspection.status !== "recognized" || !inspection.liveVersion.path
      || !inspection.liveVersion.fingerprint) {
      return {
        status: "blocked",
        validation: { ...validation, status: "failed", errors: ["The prior live version is missing immutable evidence."] },
      };
    }
    const created = await this.post<WorkspaceCreateVersionResponse>(
      `/${operation.workspace.path}:create_version`,
      {
        name: `GTM Observability - ${operation.specification.id}`,
        notes: `Tracking setup operation ${operation.id}`,
      },
    );
    if (created.compilerError || created.syncStatus?.mergeConflict || created.syncStatus?.syncError
      || !created.containerVersion?.path || !created.containerVersion.fingerprint) {
      return {
        status: "blocked",
        validation: { ...validation, status: "failed", errors: ["GTM did not create a clean immutable container version."] },
      };
    }
    return {
      status: "versioned",
      validation,
      version: {
        path: created.containerVersion.path,
        fingerprint: created.containerVersion.fingerprint,
        priorLiveVersionPath: inspection.liveVersion.path,
        priorLiveVersionFingerprint: inspection.liveVersion.fingerprint,
      },
    };
  }

  async publishApprovedVersion(operation: TrackingSetupOperationV1): Promise<{
    publishedAt: string;
    versionFingerprint: string;
  }> {
    if (!this.publicationEnabled) throw new GoogleIntegrationError("GTM publication is disabled on this backend.", 403);
    assertTrackingOperation(operation);
    this.assertWriteTarget(operation.container.publicId);

    if (operation.status !== "approved" || !operation.version || !publicationApprovalCurrent(operation, this.now())) {
      throw new GoogleIntegrationError("Publication requires current approval for the exact version fingerprint.", 409);
    }
    const [version, inspection] = await Promise.all([
      this.get<GtmContainerVersion>(`/${operation.version.path}`),
      this.inspectObservedContainer(operation.container.publicId),
    ]);
    if (version.fingerprint !== operation.version.fingerprint) {
      throw new GoogleIntegrationError("The approved immutable version fingerprint changed.", 409);
    }
    if (inspection.status !== "recognized"
      || inspection.liveVersion.fingerprint !== operation.version.priorLiveVersionFingerprint) {
      throw new GoogleIntegrationError("The live container changed after version review.", 409);
    }
    const published = await this.post<PublishVersionResponse>(
      `/${operation.version.path}:publish?fingerprint=${encodeURIComponent(operation.version.fingerprint)}`,
    );
    if (published.compilerError || published.containerVersion?.fingerprint !== operation.version.fingerprint) {
      throw new GoogleIntegrationError("Google did not confirm publication of the approved version.", 502);
    }
    return { publishedAt: new Date(this.now()).toISOString(), versionFingerprint: operation.version.fingerprint };
  }

  async rollbackPublishedVersion(operation: TrackingSetupOperationV1): Promise<{
    targetVersionFingerprint: string;
    status: "completed";
    completedAt: string;
  }> {
    if (!this.publicationEnabled) throw new GoogleIntegrationError("GTM publication is disabled on this backend.", 403);
    assertTrackingOperation(operation);
    this.assertWriteTarget(operation.container.publicId);

    if (operation.status !== "rollback_required" || !operation.version || !operation.rollback) {
      throw new GoogleIntegrationError("Rollback requires failed publication evidence and a recorded target.", 409);
    }
    const [target, inspection] = await Promise.all([
      this.get<GtmContainerVersion>(`/${operation.version.priorLiveVersionPath}`),
      this.inspectObservedContainer(operation.container.publicId),
    ]);
    if (target.fingerprint !== operation.version.priorLiveVersionFingerprint
      || operation.rollback.targetVersionFingerprint !== target.fingerprint) {
      throw new GoogleIntegrationError("The rollback target fingerprint is stale.", 409);
    }
    if (inspection.status !== "recognized" || inspection.liveVersion.fingerprint !== operation.version.fingerprint) {
      throw new GoogleIntegrationError("The live container no longer matches the failed publication.", 409);
    }
    const restored = await this.post<PublishVersionResponse>(
      `/${operation.version.priorLiveVersionPath}:publish?fingerprint=${encodeURIComponent(target.fingerprint)}`,
    );
    if (restored.compilerError || restored.containerVersion?.fingerprint !== target.fingerprint) {
      throw new GoogleIntegrationError("Google did not confirm rollback publication.", 502);
    }
    return {
      targetVersionFingerprint: target.fingerprint,
      status: "completed",
      completedAt: new Date(this.now()).toISOString(),
    };
  }

  private async prepareManagedWorkspaceOnce(
    publicId: string,
  ): Promise<GtmManagedWorkspacePreparation> {
    const inspection = await this.inspectObservedContainer(publicId);
    if (inspection.status !== "recognized") return inspection;
    const decision = inspection.workspace;
    if (decision.status !== "available") {
      return { ...inspection, workspace: decision };
    }
    if (decision.action === "create") {
      const workspace = await this.post<GtmWorkspace>(
        `/${inspection.container.path}/workspaces`,
        {
          name: GTM_MANAGED_WORKSPACE_NAME,
          description: GTM_MANAGED_WORKSPACE_DESCRIPTION,
        },
      );
      this.assertWorkspacePath(workspace, inspection.container);
      return {
        ...inspection,
        workspace: {
          status: "created",
          workspaceCount: decision.workspaceCount + 1,
          workspace,
        },
      };
    }

    this.assertWorkspacePath(decision.workspace, inspection.container);
    const sync = await this.post<WorkspaceSyncResponse>(`/${decision.workspace.path}:sync`);
    const status = await this.get<WorkspaceStatusResponse>(`/${decision.workspace.path}/status`);
    if (
      sync.syncStatus?.mergeConflict
      || sync.syncStatus?.syncError
      || (sync.mergeConflict?.length ?? 0) > 0
      || (status.mergeConflict?.length ?? 0) > 0
    ) {
      return {
        ...inspection,
        workspace: {
          status: "sync_conflict",
          workspaceCount: decision.workspaceCount,
          workspace: decision.workspace,
        },
      };
    }
    return {
      ...inspection,
      workspace: {
        status: "reused",
        workspaceCount: decision.workspaceCount,
        workspace: decision.workspace,
      },
    };
  }

  private async recognizeObservedContainer(publicId: string) {
    const accounts = await this.discover();
    const recognition = recognizeContainer(
      publicId,
      accounts.flatMap((account) => account.containers.map((container) => ({
        ...container,
        account: { accountId: account.accountId, name: account.name },
      }))),
    );
    if (recognition.status !== "recognized") return recognition;
    const { account, ...container } = recognition.container;
    return { ...recognition, account, container };
  }

  private async applyEntityAction(
    generatedSetup: GtmContainerExport,
    fresh: Extract<GtmManagedWorkspacePlanning, { status: "planned" }>,
    action: TrackingChangeAction & { action: "create" | "update" },
  ): Promise<void> {
    const generated = generatedEntity(generatedSetup, action);
    if (!generated) throw new GoogleIntegrationError("The planned generated entity is missing.", 409);
    if (action.kind === "builtInVariable") {
      if (action.action !== "create" || typeof generated.type !== "string") {
        throw new GoogleIntegrationError("Built-in variables can only be enabled by type.", 409);
      }
      const url = new URL(`${tagManagerEndpoint}/${fresh.workspace.path}/built_in_variables`);
      url.searchParams.append("type", googleRestString(generated.type));
      const response = await this.fetchGoogle(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${await this.getAccessToken()}` },
      });
      await responseJson<{ builtInVariable?: unknown[] }>(response);
      return;
    }

    const collection = action.kind === "tag" ? "tags" : action.kind === "trigger" ? "triggers" : "variables";
    const body = applicationEntityBody(generated, action.kind, fresh, generatedSetup);
    if (action.action === "create") {
      await this.post(`/${fresh.workspace.path}/${collection}`, body);
      return;
    }

    if (!action.existingId) throw new GoogleIntegrationError("The update target ID is missing.", 409);
    const entities = await this.workspaceEntitySet(fresh.workspace);
    const existing = (entities[action.kind] ?? []).find((candidate) =>
      isJsonRecord(candidate) && entityId(action.kind, candidate) === action.existingId);
    if (!isJsonRecord(existing) || existing.notes !== GTM_MANAGED_ENTITY_NOTE
      || typeof existing.fingerprint !== "string" || !existing.fingerprint) {
      throw new GoogleIntegrationError("The update target is not a fingerprinted product-owned entity.", 409);
    }
    if (action.expectedFingerprint && existing.fingerprint !== action.expectedFingerprint) {
      throw new GoogleIntegrationError("The reviewed update target fingerprint changed.", 409);
    }
    const path = `/${fresh.workspace.path}/${collection}/${action.existingId}`;
    await this.put(`${path}?fingerprint=${encodeURIComponent(existing.fingerprint)}`, body);
  }

  private assertWorkspacePath(workspace: GtmWorkspace, container: GtmContainer): void {
    const expected = new RegExp(`^${container.path.replaceAll("/", "\\/")}\/workspaces\/\\d+$`);
    if (!expected.test(workspace.path)) {
      throw new GoogleIntegrationError("Google returned a workspace outside the recognized container.", 502);
    }
  }

  private assertWriteTarget(publicId: string): void {
    if (!this.writeTargetPublicId) {
      return;
    }
    if (normalizePublicContainerId(publicId) !== this.writeTargetPublicId) {
      throw new GoogleIntegrationError("GTM mutation is locked to another container target.", 403);
    }
  }

  private async get<Result>(path: string): Promise<Result> {
    const response = await this.fetchGoogle(`${tagManagerEndpoint}${path}`, {
      headers: { Authorization: `Bearer ${await this.getAccessToken()}` },
    });
    return responseJson<Result>(response);
  }

  private async post<Result>(path: string, body?: unknown): Promise<Result> {
    const response = await this.fetchGoogle(`${tagManagerEndpoint}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await this.getAccessToken()}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return responseJson<Result>(response);
  }

  private async put<Result>(path: string, body: unknown): Promise<Result> {
    const response = await this.fetchGoogle(`${tagManagerEndpoint}${path}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${await this.getAccessToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
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
      const response = await this.fetchGoogle(url, {
        headers: { Authorization: `Bearer ${await this.getAccessToken()}` },
      });
      const result = await responseJson<Result>(response);
      const page = result[collection] as Item[] | undefined;
      if (page) items.push(...page);
      pageToken = result.nextPageToken;
    } while (pageToken);
    return items;
  }

  private async fetchGoogle(input: string | URL, init?: RequestInit): Promise<Response> {
    let response: Response | undefined;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      response = await this.fetcher(input, init);
      if (response.status !== 429 || attempt === 2) return response;
      await this.wait(this.quotaRetryDelay(response.headers.get("Retry-After")));
    }
    if (!response) throw new Error("Google request did not produce a response.");
    return response;
  }

  private quotaRetryDelay(retryAfter: string | null): number {
    if (retryAfter) {
      const seconds = Number(retryAfter);
      if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;
      const timestamp = Date.parse(retryAfter);
      if (Number.isFinite(timestamp)) return Math.max(0, timestamp - this.now());
    }
    return 65_000;
  }
}

export function ga4MeasurementIds(value: unknown): string[] {
  const found = new Set<string>();
  const visit = (candidate: unknown, depth: number): void => {
    if (depth > 12 || found.size >= 32) return;
    if (typeof candidate === "string") {
      const normalized = candidate.trim().toUpperCase();
      if (/^G-[A-Z0-9]+$/.test(normalized)) found.add(normalized);
      return;
    }
    if (Array.isArray(candidate)) {
      candidate.slice(0, 2_000).forEach((item) => visit(item, depth + 1));
      return;
    }
    if (typeof candidate === "object" && candidate !== null) {
      Object.values(candidate).slice(0, 2_000).forEach((item) => visit(item, depth + 1));
    }
  };
  visit(value, 0);
  return [...found].sort();
}

type JsonRecord = Record<string, unknown>;

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sameActionIdentity(left: TrackingChangeAction, right: TrackingChangeAction): boolean {
  return left.kind === right.kind
    && left.generatedName === right.generatedName
    && left.entitySignature === right.entitySignature;
}

function approvedFreshAction(
  operation: TrackingSetupOperationV1,
  current: TrackingChangeAction & { action: "conflict" },
  expected: TrackingChangeAction & { action: "update" },
): TrackingChangeAction | undefined {
  if (current.reason !== "managed_change_requires_approval"
    || !current.existingId
    || !current.replacement
    || current.existingId !== expected.existingId
    || current.replacement.currentFingerprint !== expected.expectedFingerprint) {
    return undefined;
  }
  const reviewed = operation.managedReplacement?.entities.find((entity) =>
    entity.kind === current.kind
    && entity.entitySignature === current.entitySignature
    && entity.existingId === current.existingId
    && entity.currentFingerprint === current.replacement?.currentFingerprint);
  if (!reviewed
    || operation.managedReplacement?.approvedPlanFingerprint !== operation.plan.fingerprint) {
    return undefined;
  }
  return {
    kind: current.kind,
    generatedName: current.generatedName,
    entitySignature: current.entitySignature,
    action: "update",
    existingId: current.existingId,
    expectedFingerprint: current.replacement.currentFingerprint,
  };
}

function generatedEntity(
  setup: GtmContainerExport,
  action: TrackingChangeAction,
): JsonRecord | undefined {
  const entities = setup.containerVersion[action.kind] ?? [];
  return entities.filter(isJsonRecord).find((entity) => {
    const name = typeof entity.name === "string" && entity.name.trim()
      ? entity.name.trim()
      : action.kind === "builtInVariable" && typeof entity.type === "string"
        ? entity.type
        : "Unnamed entity";
    return name === action.generatedName;
  });
}

function entityId(kind: TrackingChangeAction["kind"], entity: JsonRecord): string | undefined {
  const key = kind === "tag" ? "tagId" : kind === "trigger" ? "triggerId" : kind === "variable" ? "variableId" : undefined;
  const value = key ? entity[key] : undefined;
  return typeof value === "string" ? value : undefined;
}

function applicationEntityBody(
  generated: JsonRecord,
  kind: Exclude<TrackingChangeAction["kind"], "builtInVariable">,
  fresh: Extract<GtmManagedWorkspacePlanning, { status: "planned" }>,
  setup: GtmContainerExport,
): JsonRecord {
  const body = googleRestValue(structuredClone(generated)) as JsonRecord;
  for (const key of [
    "accountId", "containerId", "workspaceId", "path", "fingerprint", "tagManagerUrl",
    "parentFolderId", "tagId", "triggerId", "variableId",
  ]) delete body[key];
  body.notes = GTM_MANAGED_ENTITY_NOTE;
  if (kind === "tag" && Array.isArray(body.firingTriggerId)) {
    const generatedTriggers = setup.containerVersion.trigger.filter(isJsonRecord);
    const byGeneratedId = new Map(generatedTriggers.flatMap((trigger) => {
      const id = typeof trigger.triggerId === "string" ? trigger.triggerId : undefined;
      const name = typeof trigger.name === "string" ? trigger.name : undefined;
      const match = name
        ? fresh.plan.actions.find((action) => action.kind === "trigger" && action.generatedName === name)
        : undefined;
      return id && match?.existingId ? [[id, match.existingId] as const] : [];
    }));
    body.firingTriggerId = body.firingTriggerId.map((id) => byGeneratedId.get(String(id)) ?? id);
  }
  return body;
}

function googleRestString(value: string, key?: string): string {
  if (key === "key") return GTM_REST_PARAMETER_KEY_ALIASES.get(value) ?? value;
  return GTM_REST_STRING_ALIASES.get(value) ?? value;
}

function googleRestValue(value: unknown, key?: string): unknown {
  if (Array.isArray(value)) return value.map((item) => googleRestValue(item));
  if (!isJsonRecord(value)) return typeof value === "string" ? googleRestString(value, key) : value;
  const result: JsonRecord = {};
  for (const [childKey, childValue] of Object.entries(value)) {
    result[GTM_REST_PROPERTY_ALIASES.get(childKey) ?? childKey] = googleRestValue(childValue, childKey);
  }
  return result;
}

function expectedWorkspaceChange(change: unknown, setup: GtmContainerExport): boolean {
  if (!isJsonRecord(change)) return false;
  const wrapper = isJsonRecord(change.entity) ? change.entity : change;
  for (const kind of ["tag", "trigger", "variable"] as const) {
    const entity = wrapper[kind];
    if (isJsonRecord(entity)) return entity.notes === GTM_MANAGED_ENTITY_NOTE;
  }
  const builtIn = wrapper.builtInVariable;
  if (isJsonRecord(builtIn) && typeof builtIn.type === "string") {
    const builtInType = builtIn.type;
    return setup.containerVersion.builtInVariable.some((candidate) =>
      isJsonRecord(candidate) && typeof candidate.type === "string"
        && googleRestString(candidate.type) === googleRestString(builtInType));
  }
  return false;
}
