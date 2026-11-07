import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { teamRepositoryCreate } from "../persistence/teamRepositoryCreate.js"

type TeamOrganizationAssignmentListOptions = {
  readonly database: StorageDatabase | StorageExecutor
  readonly realmId: string
  readonly organizationId: string
}

type TeamOrganizationAssignment = {
  readonly teams: readonly {
    readonly id: string
    readonly leaderUserId: string
    readonly name: string
    readonly slug: string
  }[]
  readonly memberships: readonly { readonly teamId: string; readonly userId: string }[]
}

/** Cross-feature read surface: team assignments scoped to one organization. Callers authorize. */
export function teamOrganizationAssignmentList(
  options: TeamOrganizationAssignmentListOptions,
): Result<TeamOrganizationAssignment> {
  const op = "teamOrganizationAssignmentList"
  if (options.realmId.length === 0 || options.organizationId.length === 0)
    return resultErrorCodedCreate(op, "The team assignment lookup is invalid.", "teams.invalid")
  const executor = (
    "db" in options.database ? (options.database as StorageDatabase).db : options.database
  ) as StorageExecutor
  const repository = teamRepositoryCreate(executor)
  const teams = repository.teamList(options.organizationId)
  if (!teams.success) return teams
  const memberships = repository.teamMembershipListByOrganization(options.organizationId)
  if (!memberships.success) return memberships
  return resultCreate({
    memberships: memberships.data
      .filter((membership) => membership.realmId === options.realmId)
      .map((membership) => ({ teamId: membership.teamId, userId: membership.userId })),
    teams: teams.data
      .filter((team) => team.realmId === options.realmId)
      .map((team) => ({ id: team.id, leaderUserId: team.leaderUserId, name: team.name, slug: team.slug })),
  })
}
