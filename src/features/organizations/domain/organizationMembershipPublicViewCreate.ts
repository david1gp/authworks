import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import type { OrganizationMembershipRow } from "../persistence/organizationMembershipTable.js"
import type { OrganizationMembership } from "../public/organizationMembershipSchema.js"
import { organizationRolesDecode } from "./organizationRolesDecode.js"

export function organizationMembershipPublicViewCreate(row: OrganizationMembershipRow): Result<OrganizationMembership> {
  const roles = organizationRolesDecode(row.roles)
  if (!roles.success) return roles
  return resultCreate({
    createdAt: row.createdAt,
    id: row.id,
    realmId: row.realmId,
    organizationId: row.organizationId,
    roles: roles.data,
    updatedAt: row.updatedAt,
    userId: row.userId,
  })
}
