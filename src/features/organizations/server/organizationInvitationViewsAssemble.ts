import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { teamOrganizationAssignmentList } from "../../teams/server/teamOrganizationAssignmentList.js"
import { organizationInvitationPublicViewCreate } from "../domain/organizationInvitationPublicViewCreate.js"
import type { OrganizationInvitationRow } from "../persistence/organizationInvitationTable.js"
import type { OrganizationInvitationInviter } from "../public/organizationInvitationInviterSchema.js"
import type { OrganizationInvitation } from "../public/organizationInvitationSchema.js"
import type { OrganizationInvitationTeam } from "../public/organizationInvitationTeamSchema.js"
import { organizationInvitationInviterResolve } from "./organizationInvitationInviterResolve.js"

type OrganizationInvitationViewsAssembleOptions = {
  readonly database: StorageDatabase
  readonly realmId: string
  readonly rows: readonly OrganizationInvitationRow[]
}

/** Batch-enrich invitation rows with resolved inviter and team summaries. Callers authorize. */
export function organizationInvitationViewsAssemble(
  options: OrganizationInvitationViewsAssembleOptions,
): Result<OrganizationInvitation[]> {
  const teamById = new Map<string, OrganizationInvitationTeam>()
  for (const organizationId of new Set(options.rows.map((row) => row.organizationId))) {
    const assignments = teamOrganizationAssignmentList({
      database: options.database,
      organizationId,
      realmId: options.realmId,
    })
    if (!assignments.success) return assignments
    for (const team of assignments.data.teams) teamById.set(team.id, { name: team.name, slug: team.slug })
  }
  const inviterById = new Map<string, OrganizationInvitationInviter>()
  for (const invitedBy of new Set(options.rows.map((row) => row.invitedBy))) {
    const resolved = organizationInvitationInviterResolve({
      database: options.database,
      invitedBy,
      realmId: options.realmId,
    })
    if (!resolved.success) return resolved
    if (resolved.data !== null) inviterById.set(invitedBy, resolved.data)
  }
  const invitations: OrganizationInvitation[] = []
  for (const row of options.rows) {
    const teamId = row.teamId ?? null
    const view = organizationInvitationPublicViewCreate({
      invitedBy: inviterById.get(row.invitedBy) ?? null,
      row,
      team: teamId === null ? null : (teamById.get(teamId) ?? null),
    })
    if (!view.success) return view
    invitations.push(view.data)
  }
  return resultCreate(invitations)
}
