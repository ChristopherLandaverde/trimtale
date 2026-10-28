const apiOrigin = "http://127.0.0.1:8787";
const tokenStorageKey = "product_auth_session_v1";
const tokenExpiryLeewayMs = 30_000;
const authDatabaseName = "gtm_observability_product_auth";
const authStoreName = "sessions";

declare const __PRODUCT_AUTHORIZATION_ENDPOINT__: string;
declare const __PRODUCT_TOKEN_ENDPOINT__: string;
declare const __PRODUCT_REVOCATION_ENDPOINT__: string;
declare const __PRODUCT_OAUTH_CLIENT_ID__: string;
declare const __PRODUCT_OAUTH_SCOPE__: string;
declare const __TEST_PRODUCT_ACCESS_TOKEN__: string;

export interface ProductOAuthConfig {
  authorizationEndpoint: string;
  tokenEndpoint: string;
  revocationEndpoint?: string;
  clientId: string;
  scope: string;
}

interface StoredProductSession {
  schemaVersion: 1;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

interface TokenResponse {
  accessToken: string;
  refreshToken?: string;
  expiresInSeconds: number;
}

export type ProductAuthErrorCode =
  | "authentication_unconfigured"
  | "authentication_required"
  | "authentication_rejected"
  | "authentication_unavailable";

export class ProductAuthError extends Error {
  constructor(readonly code: ProductAuthErrorCode) {
    super(code);
    this.name = "ProductAuthError";
  }
}

let authDatabase: Promise<IDBDatabase> | undefined;

function productAuthDatabase(): Promise<IDBDatabase> {
  authDatabase ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(authDatabaseName, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(authStoreName)) {
        request.result.createObjectStore(authStoreName);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new ProductAuthError("authentication_unavailable"));
  });
  return authDatabase;
}

function databaseRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new ProductAuthError("authentication_unavailable"));
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(new ProductAuthError("authentication_unavailable"));
    transaction.onabort = () => reject(new ProductAuthError("authentication_unavailable"));
  });
}

function exactHttpsUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.hash
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

export function productOAuthConfig(input: {
  authorizationEndpoint: string;
  tokenEndpoint: string;
  revocationEndpoint: string;
  clientId: string;
  scope: string;
}): ProductOAuthConfig | undefined {
  const authorizationEndpoint = exactHttpsUrl(input.authorizationEndpoint.trim());
  const tokenEndpoint = exactHttpsUrl(input.tokenEndpoint.trim());
  const revocationEndpoint = input.revocationEndpoint.trim()
    ? exactHttpsUrl(input.revocationEndpoint.trim())
    : undefined;
  const clientId = input.clientId.trim();
  const scope = input.scope.trim().replace(/\s+/g, " ");
  if (!authorizationEndpoint || !tokenEndpoint || !clientId || !scope
    || (input.revocationEndpoint.trim() && !revocationEndpoint)
    || clientId.length > 256 || scope.length > 512) {
    return undefined;
  }
  return {
    authorizationEndpoint,
    tokenEndpoint,
    ...(revocationEndpoint ? { revocationEndpoint } : {}),
    clientId,
    scope,
  };
}

function configuredOAuth(): ProductOAuthConfig | undefined {
  return productOAuthConfig({
    authorizationEndpoint: __PRODUCT_AUTHORIZATION_ENDPOINT__,
    tokenEndpoint: __PRODUCT_TOKEN_ENDPOINT__,
    revocationEndpoint: __PRODUCT_REVOCATION_ENDPOINT__,
    clientId: __PRODUCT_OAUTH_CLIENT_ID__,
    scope: __PRODUCT_OAUTH_SCOPE__,
  });
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function randomValue(bytes = 32): string {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return base64Url(value);
}

export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(digest));
}

export function authorizationUrl(input: {
  config: ProductOAuthConfig;
  redirectUri: string;
  state: string;
  challenge: string;
}): string {
  const url = new URL(input.config.authorizationEndpoint);
  url.searchParams.set("client_id", input.config.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", input.config.scope);
  url.searchParams.set("state", input.state);
  url.searchParams.set("code_challenge", input.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export function authorizationCode(
  redirect: string,
  expectedRedirectUri: string,
  expectedState: string,
): string | undefined {
  let actual: URL;
  let expected: URL;
  try {
    actual = new URL(redirect);
    expected = new URL(expectedRedirectUri);
  } catch {
    return undefined;
  }
  if (actual.origin !== expected.origin || actual.pathname !== expected.pathname
    || actual.hash
    || actual.searchParams.getAll("state").length !== 1
    || actual.searchParams.get("state") !== expectedState
    || actual.searchParams.getAll("code").length !== 1
    || actual.searchParams.has("error")) {
    return undefined;
  }
  const code = actual.searchParams.get("code");
  return code && code.length <= 4096 ? code : undefined;
}

function parseTokenResponse(value: unknown): TokenResponse | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.token_type !== "string" || record.token_type.toLowerCase() !== "bearer"
    || typeof record.access_token !== "string" || record.access_token.length < 16
    || record.access_token.length > 16_384
    || typeof record.expires_in !== "number" || !Number.isFinite(record.expires_in)
    || record.expires_in < 30 || record.expires_in > 86_400
    || (record.refresh_token !== undefined
      && (typeof record.refresh_token !== "string" || record.refresh_token.length < 16
        || record.refresh_token.length > 16_384))) {
    return undefined;
  }
  return {
    accessToken: record.access_token,
    expiresInSeconds: record.expires_in,
    ...(typeof record.refresh_token === "string" ? { refreshToken: record.refresh_token } : {}),
  };
}

async function tokenRequest(
  config: ProductOAuthConfig,
  parameters: URLSearchParams,
): Promise<TokenResponse> {
  let response: Response;
  try {
    response = await fetch(config.tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: parameters,
    });
  } catch {
    throw new ProductAuthError("authentication_unavailable");
  }
  if (!response.ok) throw new ProductAuthError("authentication_rejected");
  const token = parseTokenResponse(await response.json().catch(() => undefined));
  if (!token) throw new ProductAuthError("authentication_rejected");
  return token;
}

function storedSession(value: unknown): StoredProductSession | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  if (record.schemaVersion !== 1
    || typeof record.accessToken !== "string" || record.accessToken.length < 16
    || typeof record.expiresAt !== "number" || !Number.isFinite(record.expiresAt)
    || (record.refreshToken !== undefined
      && (typeof record.refreshToken !== "string" || record.refreshToken.length < 16))) {
    return undefined;
  }
  return {
    schemaVersion: 1,
    accessToken: record.accessToken,
    expiresAt: record.expiresAt,
    ...(typeof record.refreshToken === "string" ? { refreshToken: record.refreshToken } : {}),
  };
}

async function loadSession(): Promise<StoredProductSession | undefined> {
  const database = await productAuthDatabase();
  const transaction = database.transaction(authStoreName, "readonly");
  const value: unknown = await databaseRequest(
    transaction.objectStore(authStoreName).get(tokenStorageKey),
  );
  const session = storedSession(value);
  if (!session && value !== undefined) {
    await removeSession();
  }
  return session;
}

async function saveSession(token: TokenResponse, priorRefreshToken?: string): Promise<void> {
  const refreshToken = token.refreshToken ?? priorRefreshToken;
  const session: StoredProductSession = {
    schemaVersion: 1,
    accessToken: token.accessToken,
    expiresAt: Date.now() + token.expiresInSeconds * 1_000,
    ...(refreshToken ? { refreshToken } : {}),
  };
  const database = await productAuthDatabase();
  const transaction = database.transaction(authStoreName, "readwrite");
  transaction.objectStore(authStoreName).put(session, tokenStorageKey);
  await transactionComplete(transaction);
}

async function removeSession(): Promise<void> {
  const database = await productAuthDatabase();
  const transaction = database.transaction(authStoreName, "readwrite");
  transaction.objectStore(authStoreName).delete(tokenStorageKey);
  await transactionComplete(transaction);
}

export async function signInProduct(): Promise<void> {
  const config = configuredOAuth();
  if (!config) throw new ProductAuthError("authentication_unconfigured");
  const redirectUri = chrome.identity.getRedirectURL("clerk");
  const verifier = randomValue(48);
  const state = randomValue();
  const challenge = await pkceChallenge(verifier);
  let redirect: string | undefined;
  try {
    redirect = await chrome.identity.launchWebAuthFlow({
      interactive: true,
      url: authorizationUrl({ config, redirectUri, state, challenge }),
    });
  } catch {
    throw new ProductAuthError("authentication_rejected");
  }
  const code = redirect && authorizationCode(redirect, redirectUri, state);
  if (!code) throw new ProductAuthError("authentication_rejected");
  const token = await tokenRequest(config, new URLSearchParams({
    grant_type: "authorization_code",
    client_id: config.clientId,
    redirect_uri: redirectUri,
    code,
    code_verifier: verifier,
  }));
  await saveSession(token);
}

async function accessToken(): Promise<string> {
  if (__TEST_PRODUCT_ACCESS_TOKEN__) return __TEST_PRODUCT_ACCESS_TOKEN__;
  const config = configuredOAuth();
  if (!config) throw new ProductAuthError("authentication_unconfigured");
  const session = await loadSession();
  if (!session) throw new ProductAuthError("authentication_required");
  if (session.expiresAt > Date.now() + tokenExpiryLeewayMs) return session.accessToken;
  if (!session.refreshToken) {
    await removeSession();
    throw new ProductAuthError("authentication_required");
  }
  const token = await tokenRequest(config, new URLSearchParams({
    grant_type: "refresh_token",
    client_id: config.clientId,
    refresh_token: session.refreshToken,
  }));
  await saveSession(token, session.refreshToken);
  return token.accessToken;
}

export async function signOutProduct(): Promise<void> {
  const config = configuredOAuth();
  const session = await loadSession();
  await removeSession();
  if (!config?.revocationEndpoint || !session) return;
  const token = session.refreshToken ?? session.accessToken;
  await fetch(config.revocationEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token, client_id: config.clientId }),
  }).catch(() => undefined);
}

export async function authenticatedApiFetch(
  input: string | URL,
  init: RequestInit = {},
): Promise<Response> {
  const url = new URL(input.toString());
  if (url.origin !== apiOrigin) throw new ProductAuthError("authentication_rejected");
  const token = await accessToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(url, { ...init, headers });
  if (response.status === 401) {
    if (!__TEST_PRODUCT_ACCESS_TOKEN__) {
      await removeSession();
    }
    throw new ProductAuthError("authentication_required");
  }
  return response;
}

export function productAuthError(value: unknown): ProductAuthErrorCode | undefined {
  return value instanceof ProductAuthError ? value.code : undefined;
}
