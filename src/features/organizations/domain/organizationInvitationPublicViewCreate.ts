import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import type { OrganizationInvitationRow } from "../persistence/organizationInvitationTable.js"
import type { OrganizationInvitation } from "../public/organizationInvitationSchema.js"
import { organizationRolesDecode } from "./organizationRolesDecode.js"

export function organizationInvitationPublicViewCreate(row: OrganizationInvitationRow): Result<OrganizationInvitation> {
  const roles = organizationRolesDecode(row.roles)
  if (!roles.success) return roles
  return resultCreate({
    acceptedAt: row.acceptedAt,
    createdAt: row.createdAt,
    email: row.email,
    expiresAt: row.expiresAt,
    id: row.id,
    instanceId: row.instanceId,
    organizationId: row.organizationId,
    roles: roles.data,
    status: row.status as OrganizationInvitation["status"],
    updatedAt: row.updatedAt,
  })
}
