export const ORGANIZATION_AUTHORITY_SCHEMA_VERSION = 1 as const;

export type OrganizationPermissionV1 =
  | "org:tracking:read"
  | "org:tracking:write"
  | "org:tracking:publish"
  | "org:connections:manage";

export type OrganizationRoleV1 = "member" | "admin";

export interface OrganizationAuthorityV1 {
  schemaVersion: typeof ORGANIZATION_AUTHORITY_SCHEMA_VERSION;
  organizationId: string;
  membershipId: string;
  role: string;
  permissions: OrganizationPermissionV1[];
}

const ID = /^[A-Za-z0-9][A-Za-z0-9_-]{1,127}$/;

const rolePermissions: Record<OrganizationRoleV1, OrganizationPermissionV1[]> = {
  member: ["org:tracking:read", "org:tracking:write"],
  admin: [
    "org:tracking:read",
    "org:tracking:write",
    "org:tracking:publish",
    "org:connections:manage",
  ],
};

function supportedRole(value: string): value is OrganizationRoleV1 {
  return value === "member" || value === "admin";
}

export function organizationAuthority(input: {
  organizationId: string;
  membershipId: string;
  role: string;
}): OrganizationAuthorityV1 {
  const role = input.role.startsWith("org:") ? input.role.slice(4) : input.role;

  return {
    schemaVersion: ORGANIZATION_AUTHORITY_SCHEMA_VERSION,
    organizationId: input.organizationId,
    membershipId: input.membershipId,
    role,
    permissions: supportedRole(role) ? [...rolePermissions[role]] : [],
  };
}

export function validateOrganizationAuthority(value: unknown): string[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return ["organization authority must be an object"];
  }

  const authority = value as Record<string, unknown>;
  const errors: string[] = [];
  if (authority.schemaVersion !== ORGANIZATION_AUTHORITY_SCHEMA_VERSION) {
    errors.push("schemaVersion must be 1");
  }
  if (typeof authority.organizationId !== "string" || !ID.test(authority.organizationId)) {
    errors.push("organizationId is invalid");
  }
  if (typeof authority.membershipId !== "string" || !ID.test(authority.membershipId)) {
    errors.push("membershipId is invalid");
  }
  if (typeof authority.role !== "string" || !supportedRole(authority.role)) {
    errors.push("role is unsupported");
  }
  const expected = typeof authority.role === "string" && supportedRole(authority.role)
    ? rolePermissions[authority.role]
    : [];
  if (!Array.isArray(authority.permissions)
    || JSON.stringify(authority.permissions) !== JSON.stringify(expected)) {
    errors.push("permissions do not match role");
  }

  return errors;
}

export function authorizeOrganization(
  authority: OrganizationAuthorityV1,
  expectedOrganizationId: string,
  permission: OrganizationPermissionV1,
): boolean {
  return validateOrganizationAuthority(authority).length === 0
    && authority.organizationId === expectedOrganizationId
    && authority.permissions.includes(permission);
}

export function approvalMembershipRef(authority: OrganizationAuthorityV1): string {
  const errors = validateOrganizationAuthority(authority);
  if (errors.length > 0) {
    throw new Error(errors.join(" "));
  }

  return `organization/${authority.organizationId}/membership/${authority.membershipId}`;
}
