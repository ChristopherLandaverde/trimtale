import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  apiRouteAccess,
  authenticateOrganization,
  clerkOrganizationAuthConfig,
  organizationAuthRuntime,
  type OrganizationMembershipLookup,
  type ProductSessionVerifier,
} from "./organization-auth.js";

const fixture = JSON.parse(readFileSync(
  new URL("../../../tests/acceptance/authenticated-organization-boundary.json", import.meta.url),
  "utf8",
)) as {
  configuredOrganizationId: string;
  routes: Array<{ method: string; path: string; access: string }>;
};

describe("organization API authentication", () => {
  it("accepts only a complete exact Clerk deployment boundary", () => {
    expect(clerkOrganizationAuthConfig({
      CLERK_SECRET_KEY: "sk_live_secret-key_123",
      CLERK_PUBLISHABLE_KEY: "pk_live_public_key_123",
      CLERK_AUTHORIZED_ORGANIZATION_ID: "org_beta",
    })).toEqual({
      secretKey: "sk_live_secret-key_123",
      publishableKey: "pk_live_public_key_123",
      organizationId: "org_beta",
    });
    expect(clerkOrganizationAuthConfig({
      CLERK_SECRET_KEY: "sk_live_secret-key_123",
      CLERK_PUBLISHABLE_KEY: "pk_live_public_key_123",
    })).toBeUndefined();
  });

  it("assigns the accepted least-authority policy to every API route family", () => {
    for (const route of fixture.routes) {
      expect(apiRouteAccess(route.method, route.path), `${route.method} ${route.path}`)
        .toBe(route.access);
    }
  });

  it("fails closed before membership lookup for missing, malformed, expired, or pending sessions", async () => {
    const membership = vi.fn<OrganizationMembershipLookup>();
    const verifier: ProductSessionVerifier = {
      verify: vi.fn(async (token: string) => token === "active_token"
        ? { status: "active" as const, practitionerId: "user_member" }
        : token === "pending_token"
          ? { status: "pending" as const, practitionerId: "user_pending" }
          : undefined),
    };

    for (const authorization of [
      undefined,
      "Basic active_token",
      "Bearer",
      "Bearer expired_token",
      "Bearer pending_token",
    ]) {
      expect(await authenticateOrganization({
        ...(authorization ? { authorization } : {}),
        expectedOrganizationId: fixture.configuredOrganizationId,
        requiredPermission: "org:tracking:read",
        verifier,
        membership,
      })).toEqual({ status: "unauthenticated" });
    }
    expect(membership).not.toHaveBeenCalled();
  });

  it("rejects wrong-organization and insufficient memberships without leaking identity", async () => {
    const verifier: ProductSessionVerifier = {
      verify: async () => ({ status: "active", practitionerId: "user_member" }),
    };
    const wrongOrganization: OrganizationMembershipLookup = async () => ({
      organizationId: "org_attacker",
      membershipId: "mem_attacker",
      role: "admin",
    });
    expect(await authenticateOrganization({
      authorization: "Bearer valid_member_token",
      expectedOrganizationId: fixture.configuredOrganizationId,
      requiredPermission: "org:tracking:read",
      verifier,
      membership: wrongOrganization,
    })).toEqual({ status: "forbidden" });

    const member: OrganizationMembershipLookup = async () => ({
      organizationId: fixture.configuredOrganizationId,
      membershipId: "mem_member",
      role: "member",
    });
    expect(await authenticateOrganization({
      authorization: "Bearer valid_member_token",
      expectedOrganizationId: fixture.configuredOrganizationId,
      requiredPermission: "org:tracking:publish",
      verifier,
      membership: member,
    })).toEqual({ status: "forbidden" });
  });

  it("returns only bounded authority for an exact authorized membership", async () => {
    const verifier: ProductSessionVerifier = {
      verify: async () => ({ status: "active", practitionerId: "PRIVATE_MEMBER_EMAIL" }),
    };
    const membership: OrganizationMembershipLookup = async (organizationId, practitionerId) => {
      expect(organizationId).toBe(fixture.configuredOrganizationId);
      expect(practitionerId).toBe("PRIVATE_MEMBER_EMAIL");
      return { organizationId, membershipId: "mem_admin", role: "admin" };
    };
    const result = await authenticateOrganization({
      authorization: "Bearer PRIVATE_ACCESS_TOKEN",
      expectedOrganizationId: fixture.configuredOrganizationId,
      requiredPermission: "org:tracking:publish",
      verifier,
      membership,
    });

    expect(result).toMatchObject({
      status: "authorized",
      authority: {
        organizationId: fixture.configuredOrganizationId,
        membershipId: "mem_admin",
        role: "admin",
      },
    });
    expect(JSON.stringify(result)).not.toContain("PRIVATE_MEMBER_EMAIL");
    expect(JSON.stringify(result)).not.toContain("PRIVATE_ACCESS_TOKEN");
  });

  it("keeps deterministic sessions test-only and malformed production config closed", async () => {
    const sessions = JSON.stringify({
      valid_member_token: {
        status: "active",
        practitionerId: "user_member",
        organizationId: "org_beta",
        membershipId: "mem_member",
        role: "member",
      },
    });
    expect(organizationAuthRuntime({
      NODE_ENV: "production",
      TEST_AUTH_ORGANIZATION_ID: "org_beta",
      TEST_AUTH_SESSIONS: sessions,
    })).toBeUndefined();
    expect(organizationAuthRuntime({
      NODE_ENV: "production",
      CLERK_SECRET_KEY: "PRIVATE_ACCESS_TOKEN",
      CLERK_PUBLISHABLE_KEY: "pk_live_public",
      CLERK_AUTHORIZED_ORGANIZATION_ID: "org_beta",
    })).toBeUndefined();

    const runtime = organizationAuthRuntime({
      NODE_ENV: "test",
      TEST_AUTH_ORGANIZATION_ID: "org_beta",
      TEST_AUTH_SESSIONS: sessions,
    });
    expect(runtime?.provider).toBe("test");
    expect(await runtime?.verifier.verify("valid_member_token")).toEqual({
      status: "active",
      practitionerId: "user_member",
    });
  });
});
