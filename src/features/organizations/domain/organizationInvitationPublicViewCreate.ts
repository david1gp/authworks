import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import type { OrganizationInvitationRow } from "../persistence/organizationInvitationTable.js"
import type { OrganizationInvitationInviter } from "../public/organizationInvitationInviterSchema.js"
import type { OrganizationInvitation } from "../public/organizationInvitationSchema.js"
import type { OrganizationInvitationTeam } from "../public/organizationInvitationTeamSchema.js"
import { organizationRolesDecode } from "./organizationRolesDecode.js"

type OrganizationInvitationPublicViewCreateOptions = {
  readonly row: OrganizationInvitationRow
  readonly invitedBy: OrganizationInvitationInviter | null
  readonly team: OrganizationInvitationTeam | null
}

export function organizationInvitationPublicViewCreate(
  options: OrganizationInvitationPublicViewCreateOptions,
): Result<OrganizationInvitation> {
  const roles = organizationRolesDecode(options.row.roles)
  if (!roles.success) return roles
  return resultCreate({
    acceptedAt: options.row.acceptedAt,
    createdAt: options.row.createdAt,
    email: options.row.email,
    expiresAt: options.row.expiresAt,
    id: options.row.id,
    invitedBy: options.invitedBy,
    realmId: options.row.realmId,
    organizationId: options.row.organizationId,
    roles: roles.data,
    status: options.row.status as OrganizationInvitation["status"],
    team: options.row.teamId === null || options.row.teamId === undefined ? null : options.team,
    teamId: options.row.teamId ?? null,
    updatedAt: options.row.updatedAt,
  })
}
