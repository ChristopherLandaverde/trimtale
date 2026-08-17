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

interface TagManagerAccountResponse {
  account?: Array<Partial<GtmAccountSummary>>;
}

interface TagManagerContainerResponse {
  container?: Array<Partial<GtmContainerSummary>>;
}

type Fetch = typeof fetch;

const accessTokenEnv = "GOOGLE_OAUTH_ACCESS_TOKEN";
const defaultBaseUrl = "https://tagmanager.googleapis.com";

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
  const accountResponse = await getJson<TagManagerAccountResponse>(
    fetchImpl,
    config,
    "/tagmanager/v2/accounts",
  );
  const accounts = (accountResponse.account ?? []).flatMap((account) => {
    const summary = accountSummary(account);
    return summary ? [summary] : [];
  });
  const containers = (
    await Promise.all(
      accounts.map(async (account) => {
        const containerResponse = await getJson<TagManagerContainerResponse>(
          fetchImpl,
          config,
          `/tagmanager/v2/${account.path}/containers`,
        );
        return (containerResponse.container ?? []).flatMap((container) => {
          const summary = containerSummary(container);
          return summary ? [summary] : [];
        });
      }),
    )
  ).flat();

  return { accounts, containers };
}
