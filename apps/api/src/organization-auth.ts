import { createClerkClient, type ClerkClient } from "@clerk/backend";
import {
  authorizeOrganization,
  organizationAuthority,
  type OrganizationAuthorityV1,
  type OrganizationPermissionV1,
} from "@gtm-observability/core";

export type ApiRouteAccess = OrganizationPermissionV1 | "public" | "internal";

export interface ProductSessionIdentity {
  status: "active" | "pending";
  practitionerId: string;
}

export interface ProductSessionVerifier {
  verify(token: string): Promise<ProductSessionIdentity | undefined>;
}

export interface OrganizationMembershipIdentity {
  organizationId: string;
  membershipId: string;
  role: string;
}

export type OrganizationMembershipLookup = (
  organizationId: string,
  practitionerId: string,
) => Promise<OrganizationMembershipIdentity | undefined>;

export type OrganizationAuthenticationResult =
  | { status: "authorized"; authority: OrganizationAuthorityV1 }
  | { status: "unauthenticated" | "forbidden" | "unavailable" };

export interface ClerkOrganizationAuthConfig {
  secretKey: string;
  publishableKey: string;
  organizationId: string;
}

export interface OrganizationAuthRuntime {
  organizationId: string;
  verifier: ProductSessionVerifier;
  membership: OrganizationMembershipLookup;
  provider: "clerk" | "test";
}

const BEARER_TOKEN = /^Bearer ([A-Za-z0-9._~+\/-]{16,4096})$/;
const ID = /^[A-Za-z0-9][A-Za-z0-9_-]{1,127}$/;

export function apiRouteAccess(method: string, pathname: string): ApiRouteAccess {
  if (method === "GET" && (pathname === "/health" || pathname === "/api/google/oauth/callback")) {
    return "public";
  }
  if (pathname === "/api/intake-evaluations" || pathname.startsWith("/api/intake-evaluations/")) {
    return "internal";
  }
  if (method === "GET" && pathname === "/api/google/oauth/start") {
    return "org:connections:manage";
  }
  if (/^\/api\/google\/workflows\/[A-Za-z0-9_-]+\/(approve-publication|publish|verify-publication|rollback)$/.test(pathname)) {
    return "org:tracking:publish";
  }
  if (method === "GET") {
    return "org:tracking:read";
  }

  return "org:tracking:write";
}

export async function authenticateOrganization(input: {
  authorization?: string;
  expectedOrganizationId: string;
  requiredPermission: OrganizationPermissionV1;
  verifier: ProductSessionVerifier;
  membership: OrganizationMembershipLookup;
}): Promise<OrganizationAuthenticationResult> {
  const token = input.authorization?.match(BEARER_TOKEN)?.[1];
  if (!token) {
    return { status: "unauthenticated" };
  }

  let session: ProductSessionIdentity | undefined;
  try {
    session = await input.verifier.verify(token);
  } catch {
    return { status: "unavailable" };
  }
  if (!session || session.status !== "active" || !ID.test(session.practitionerId)) {
    return { status: "unauthenticated" };
  }

  let membership: OrganizationMembershipIdentity | undefined;
  try {
    membership = await input.membership(
      input.expectedOrganizationId,
      session.practitionerId,
    );
  } catch {
    return { status: "unavailable" };
  }
  if (!membership || membership.organizationId !== input.expectedOrganizationId) {
    return { status: "forbidden" };
  }

  const authority = organizationAuthority(membership);
  if (!authorizeOrganization(
    authority,
    input.expectedOrganizationId,
    input.requiredPermission,
  )) {
    return { status: "forbidden" };
  }

  return { status: "authorized", authority };
}

export function clerkOrganizationAuthConfig(
  environment: NodeJS.ProcessEnv = process.env,
): ClerkOrganizationAuthConfig | undefined {
  const secretKey = environment.CLERK_SECRET_KEY?.trim();
  const publishableKey = environment.CLERK_PUBLISHABLE_KEY?.trim();
  const organizationId = environment.CLERK_AUTHORIZED_ORGANIZATION_ID?.trim();
  if (!secretKey || !publishableKey || !organizationId) {
    return undefined;
  }
  if (!/^sk_(test|live)_[A-Za-z0-9_-]{8,}$/.test(secretKey)
    || !/^pk_(test|live)_[A-Za-z0-9_-]{8,}$/.test(publishableKey)
    || !ID.test(organizationId)) {
    return undefined;
  }

  return { secretKey, publishableKey, organizationId };
}

export class ClerkOrganizationGateway implements ProductSessionVerifier {
  readonly #client: ClerkClient;

  constructor(
    private readonly config: ClerkOrganizationAuthConfig,
    client?: ClerkClient,
  ) {
    this.#client = client ?? createClerkClient({
      secretKey: config.secretKey,
      publishableKey: config.publishableKey,
      telemetry: { disabled: true },
    });
  }

  async verify(token: string): Promise<ProductSessionIdentity | undefined> {
    const request = new Request("https://api.gtm-observability.invalid/", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const state = await this.#client.authenticateRequest(request, { acceptsToken: "oauth_token" });
    const auth = state.toAuth();
    if (!auth.isAuthenticated || auth.tokenType !== "oauth_token" || !auth.userId) {
      return undefined;
    }

    return { status: "active", practitionerId: auth.userId };
  }

  readonly membership: OrganizationMembershipLookup = async (organizationId, practitionerId) => {
    if (organizationId !== this.config.organizationId) {
      return undefined;
    }
    const response = await this.#client.organizations.getOrganizationMembershipList({
      organizationId,
      userId: [practitionerId],
      limit: 2,
    });
    if (response.data.length !== 1
      || response.data[0]?.publicUserData?.userId !== practitionerId) {
      return undefined;
    }
    const membership = response.data[0];

    return {
      organizationId,
      membershipId: membership.id,
      role: membership.role,
    };
  };
}

export function organizationAuthRuntime(
  environment: NodeJS.ProcessEnv = process.env,
): OrganizationAuthRuntime | undefined {
  if (environment.NODE_ENV === "test") {
    return testOrganizationAuthRuntime(environment);
  }
  const config = clerkOrganizationAuthConfig(environment);
  if (!config) {
    return undefined;
  }
  const gateway = new ClerkOrganizationGateway(config);

  return {
    organizationId: config.organizationId,
    verifier: gateway,
    membership: gateway.membership,
    provider: "clerk",
  };
}

function testOrganizationAuthRuntime(
  environment: NodeJS.ProcessEnv,
): OrganizationAuthRuntime | undefined {
  const organizationId = environment.TEST_AUTH_ORGANIZATION_ID?.trim();
  const serialized = environment.TEST_AUTH_SESSIONS?.trim();
  if (!organizationId || !ID.test(organizationId) || !serialized) {
    return undefined;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    return undefined;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return undefined;
  }
  const sessions = new Map<string, {
    status: "active" | "pending";
    practitionerId: string;
    organizationId: string;
    membershipId: string;
    role: string;
  }>();
  for (const [token, candidate] of Object.entries(parsed)) {
    if (!BEARER_TOKEN.test(`Bearer ${token}`)
      || typeof candidate !== "object" || candidate === null || Array.isArray(candidate)) {
      return undefined;
    }
    const record = candidate as Record<string, unknown>;
    if ((record.status !== "active" && record.status !== "pending")
      || typeof record.practitionerId !== "string" || !ID.test(record.practitionerId)
      || typeof record.organizationId !== "string" || !ID.test(record.organizationId)
      || typeof record.membershipId !== "string" || !ID.test(record.membershipId)
      || typeof record.role !== "string") {
      return undefined;
    }
    sessions.set(token, {
      status: record.status,
      practitionerId: record.practitionerId,
      organizationId: record.organizationId,
      membershipId: record.membershipId,
      role: record.role,
    });
  }

  return {
    organizationId,
    provider: "test",
    verifier: {
      verify: async (token) => {
        const session = sessions.get(token);
        return session
          ? { status: session.status, practitionerId: session.practitionerId }
          : undefined;
      },
    },
    membership: async (expectedOrganizationId, practitionerId) => {
      const session = [...sessions.values()].find((candidate) =>
        candidate.status === "active"
        && candidate.organizationId === expectedOrganizationId
        && candidate.practitionerId === practitionerId);
      return session ? {
        organizationId: session.organizationId,
        membershipId: session.membershipId,
        role: session.role,
      } : undefined;
    },
  };
}
