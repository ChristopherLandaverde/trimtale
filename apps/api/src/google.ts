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

interface TagManagerAccountResponse {
  account?: Array<Partial<GtmAccountSummary>>;
  nextPageToken?: string;
}

interface TagManagerContainerResponse {
  container?: Array<Partial<GtmContainerSummary>>;
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
