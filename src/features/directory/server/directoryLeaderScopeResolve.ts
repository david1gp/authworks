import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { organizationRepositoryCreate } from "../../organizations/persistence/organizationRepositoryCreate.js"
import { teamOrganizationAssignmentList } from "../../teams/server/teamOrganizationAssignmentList.js"

type DirectoryLeaderScopeTeam = {
  readonly memberUserIds: readonly string[]
  readonly organizationId: string
  readonly slug: string
  readonly teamId: string
}

type DirectoryLeaderScopeResolveOptions = {
  readonly actorId: string
  readonly database: StorageDatabase
  readonly organizationId?: string
  readonly realmId: string
}

/**
 * Cross-feature scope read: the teams an actor leads, with member ids, for one
 * organization (when given) or every active organization the actor belongs to.
 * Callers authorize; an empty result means the actor leads nothing in scope.
 */
export function directoryLeaderScopeResolve(
  options: DirectoryLeaderScopeResolveOptions,
): Result<readonly DirectoryLeaderScopeTeam[]> {
  const op = "directoryLeaderScopeResolve"
  if (options.realmId.length === 0 || options.actorId.length === 0)
    return resultErrorCodedCreate(op, "The leader scope lookup is invalid.", "directory.invalid")
  const repository = organizationRepositoryCreate(options.database.db)
  let candidateOrganizationIds: readonly string[]
  if (options.organizationId !== undefined) {
    if (options.organizationId.length === 0)
      return resultErrorCodedCreate(op, "The leader scope lookup is invalid.", "directory.invalid")
    const membership = repository.organizationMembershipGetByOrganizationUser(options.organizationId, options.actorId)
    if (!membership.success) return membership
    if (membership.data === null) return resultCreate([])
    candidateOrganizationIds = [options.organizationId]
  } else {
    const organizations = repository.organizationList(options.realmId)
    if (!organizations.success) return organizations
    const activeOrganizationIds = new Set(
      organizations.data
        .filter((organization) => organization.status === "active")
        .map((organization) => organization.id),
    )
    const memberships = repository.organizationMembershipListByRealmUser(options.realmId, options.actorId)
    if (!memberships.success) return memberships
    candidateOrganizationIds = [
      ...new Set(
        memberships.data
          .map((membership) => membership.organizationId)
          .filter((organizationId) => activeOrganizationIds.has(organizationId)),
      ),
    ]
  }
  const scoped: DirectoryLeaderScopeTeam[] = []
  for (const organizationId of candidateOrganizationIds) {
    const assignments = teamOrganizationAssignmentList({
      database: options.database,
      organizationId,
      realmId: options.realmId,
    })
    if (!assignments.success) return assignments
    for (const team of assignments.data.teams) {
      if (team.leaderUserId !== options.actorId) continue
      scoped.push({
        memberUserIds: assignments.data.memberships
          .filter((membership) => membership.teamId === team.id)
          .map((membership) => membership.userId),
        organizationId,
        slug: team.slug,
        teamId: team.id,
      })
    }
  }
  return resultCreate(scoped)
}
