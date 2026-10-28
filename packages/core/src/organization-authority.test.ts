import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  approvalMembershipRef,
  authorizeOrganization,
  organizationAuthority,
  validateOrganizationAuthority,
  type OrganizationPermissionV1,
  type OrganizationRoleV1,
} from "./organization-authority.js";

interface AcceptanceCase {
  id: string;
  organizationId: string;
  membershipId: string;
  role: string;
  permission: OrganizationPermissionV1;
  authorized: boolean;
}

const fixture = JSON.parse(readFileSync(
  new URL("../../../tests/acceptance/authenticated-organization-boundary.json", import.meta.url),
  "utf8",
)) as {
  schemaVersion: number;
  configuredOrganizationId: string;
  roles: Record<OrganizationRoleV1, OrganizationPermissionV1[]>;
  cases: AcceptanceCase[];
  forbiddenPersistedIdentityFields: string[];
};

describe("organization authority", () => {
  it("consumes the accepted free-tier role and permission contract", () => {
    expect(fixture.schemaVersion).toBe(1);

    for (const testCase of fixture.cases) {
      const authority = organizationAuthority({
        organizationId: testCase.organizationId,
        membershipId: testCase.membershipId,
        role: testCase.role,
      });
      expect(authorizeOrganization(
        authority,
        fixture.configuredOrganizationId,
        testCase.permission,
      ), testCase.id).toBe(testCase.authorized);
    }
  });

  it("validates stable organization and membership identity without private fields", () => {
    const authority = organizationAuthority({
      organizationId: "org_beta",
      membershipId: "mem_admin",
      role: "admin",
    });

    expect(validateOrganizationAuthority(authority)).toEqual([]);
    expect(authority.permissions).toEqual(fixture.roles.admin);
    expect(approvalMembershipRef(authority)).toBe("organization/org_beta/membership/mem_admin");

    const persisted = JSON.stringify({ authority, approvedBy: approvalMembershipRef(authority) });
    for (const sentinel of fixture.forbiddenPersistedIdentityFields) {
      expect(persisted).not.toContain(sentinel);
    }
  });
});
