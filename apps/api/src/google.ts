import { randomBytes } from "node:crypto";
import {
  assertTrackingOperation,
  createTrackingChangePlan,
  fingerprintTrackingChangeActions,
  GTM_MANAGED_ENTITY_NOTE,
  GTM_MANAGED_WORKSPACE_DESCRIPTION,
  GTM_MANAGED_WORKSPACE_NAME,
  inspectManagedWorkspace,
  normalizePublicContainerId,
  recognizeContainer,
  type GtmContainerExport,
  type GtmEntitySet,
  type ManagedWorkspaceInspection,
  type TrackingChangePlan,
  type TrackingChangeAction,
  type TrackingSetupOperationV1,
} from "@gtm-observability/core";

export const GTM_READONLY_SCOPE = "https://www.googleapis.com/auth/tagmanager.readonly";
export const GTM_EDIT_CONTAINERS_SCOPE = "https://www.googleapis.com/auth/tagmanager.edit.containers";

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
    container: GtmContainer;
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
    private readonly containerWritesEnabled = false,
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
      scope: this.containerWritesEnabled
        ? `${GTM_READONLY_SCOPE} ${GTM_EDIT_CONTAINERS_SCOPE}`
        : GTM_READONLY_SCOPE,
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

interface WorkspaceSyncResponse {
  syncStatus?: { mergeConflict?: boolean; syncError?: boolean };
  mergeConflict?: unknown[];
}

interface WorkspaceStatusResponse {
  workspaceChange?: unknown[];
  mergeConflict?: unknown[];
}

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

  constructor(
    private readonly getAccessToken: () => Promise<string>,
    private readonly fetcher: Fetch = fetch,
    private readonly containerWritesEnabled = false,
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

    const preparation = await this.prepareManagedWorkspace(operation.container.publicId);
    if (preparation.status === "not_accessible") return blocked("not_accessible");
    if (preparation.status === "ambiguous") return blocked("ambiguous");
    if (preparation.workspace.status === "sync_conflict") return blocked("sync_conflict");
    if (preparation.workspace.status !== "reused") {
      return blocked(preparation.workspace.status === "ownership_conflict"
        ? "ownership_conflict"
        : "workspace_unavailable");
    }
    if (preparation.workspace.workspace.path !== operation.workspace.path) return blocked("stale_workspace");

    for (const expected of operation.plan.actions) {
      const fresh = await this.planManagedWorkspace(operation.container.publicId, operation.generatedSetup);
      if (fresh.status !== "planned" || fresh.workspace.path !== operation.workspace.path) {
        return blocked(fresh.status === "workspace_unavailable" ? "ownership_conflict" : "stale_workspace");
      }
      const current = fresh.plan.actions.find((candidate) => sameActionIdentity(candidate, expected));
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

    const finalPlan = await this.planManagedWorkspace(operation.container.publicId, operation.generatedSetup);
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
    return recognizeContainer(publicId, accounts.flatMap((account) => account.containers));
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
      url.searchParams.append("type", generated.type);
      const response = await this.fetcher(url, {
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
    const path = `/${fresh.workspace.path}/${collection}/${action.existingId}`;
    await this.put(`${path}?fingerprint=${encodeURIComponent(existing.fingerprint)}`, body);
  }

  private assertWorkspacePath(workspace: GtmWorkspace, container: GtmContainer): void {
    const expected = new RegExp(`^${container.path.replaceAll("/", "\\/")}\/workspaces\/\\d+$`);
    if (!expected.test(workspace.path)) {
      throw new GoogleIntegrationError("Google returned a workspace outside the recognized container.", 502);
    }
  }

  private async get<Result>(path: string): Promise<Result> {
    const response = await this.fetcher(`${tagManagerEndpoint}${path}`, {
      headers: { Authorization: `Bearer ${await this.getAccessToken()}` },
    });
    return responseJson<Result>(response);
  }

  private async post<Result>(path: string, body?: unknown): Promise<Result> {
    const response = await this.fetcher(`${tagManagerEndpoint}${path}`, {
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
    const response = await this.fetcher(`${tagManagerEndpoint}${path}`, {
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

type JsonRecord = Record<string, unknown>;

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sameActionIdentity(left: TrackingChangeAction, right: TrackingChangeAction): boolean {
  return left.kind === right.kind
    && left.generatedName === right.generatedName
    && left.entitySignature === right.entitySignature;
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
  const body = structuredClone(generated);
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
