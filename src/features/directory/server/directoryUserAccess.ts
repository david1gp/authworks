import * as v from "valibot"
import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { organizationRolesDecode } from "../../organizations/domain/organizationRolesDecode.js"
import { organizationRepositoryCreate } from "../../organizations/persistence/organizationRepositoryCreate.js"
import type { OrganizationInvitationInviter } from "../../organizations/public/organizationInvitationInviterSchema.js"
import { organizationInvitationAcceptedResolve } from "../../organizations/server/organizationInvitationAcceptedResolve.js"
import { organizationInvitationInviterResolve } from "../../organizations/server/organizationInvitationInviterResolve.js"
import { organizationMembershipListByOrganization } from "../../organizations/server/organizationMembershipListByOrganization.js"
import { projectUserAssignmentListByUser } from "../../projects/server/projectUserAssignmentListByUser.js"
import type { RealmTenantContext } from "../../realms/server/index.js"
import { realmAdministratorIs } from "../../realms/server/realmAdministratorIs.js"
import { userBulkRead } from "../../users/server/userBulkRead.js"
import type { DirectoryInvitedBy } from "../public/directoryInvitedBySchema.js"
import type { DirectoryUserAccessMembership } from "../public/directoryUserAccessMembershipSchema.js"
import { directoryUserAccessMembershipSchema } from "../public/directoryUserAccessMembershipSchema.js"
import type { DirectoryUserAccess } from "../public/directoryUserAccessSchema.js"
import { directoryLeaderScopeResolve } from "./directoryLeaderScopeResolve.js"

type DirectoryUserAccessOptions = {
  readonly context: RealmTenantContext
  readonly database: StorageDatabase
  readonly realmId: string
  readonly targetUserId: string
}

export function directoryUserAccess(options: DirectoryUserAccessOptions): Result<DirectoryUserAccess> {
  const op = "directoryUserAccess"
  if (options.realmId.length === 0 || options.targetUserId.length === 0)
    return resultErrorCodedCreate(op, "The directory access lookup is invalid.", "directory.invalid")
  const isAdministrator = realmAdministratorIs({
    database: options.database,
    realmId: options.realmId,
    userId: options.context.actorId,
  })
  if (!isAdministrator.success) return isAdministrator
  const actorIsUser = options.context.actor.kind === "user"
  const actorMemberships =
    !isAdministrator.data && actorIsUser
      ? organizationRepositoryCreate(options.database.db).organizationMembershipListByRealmUser(
          options.realmId,
          options.context.actorId,
        )
      : undefined
  if (actorMemberships !== undefined && !actorMemberships.success) return actorMemberships
  const administeredOrganizationIds =
    isAdministrator.data || actorMemberships === undefined
      ? undefined
      : new Set(
          actorMemberships.data
            .filter((membership) => {
              const roles = organizationRolesDecode(membership.roles)
              return roles.success && (roles.data.includes("owner") || roles.data.includes("admin"))
            })
            .map((membership) => membership.organizationId),
        )
  // Team leaders without administration rights may read members of the teams
  // they lead. This grants no mutation rights; profile edits keep their guards.
  const leaderScopedOrganizationIds = new Set<string>()
  if (!isAdministrator.data && actorIsUser && administeredOrganizationIds !== undefined) {
    const scope = directoryLeaderScopeResolve({
      actorId: options.context.actorId,
      database: options.database,
      realmId: options.realmId,
    })
    if (!scope.success) return scope
    if (scope.data.length > 0) {
      const targetAdministrator = realmAdministratorIs({
        database: options.database,
        realmId: options.realmId,
        userId: options.targetUserId,
      })
      if (!targetAdministrator.success) return targetAdministrator
      if (!targetAdministrator.data) {
        for (const team of scope.data) {
          if (team.memberUserIds.includes(options.targetUserId)) leaderScopedOrganizationIds.add(team.organizationId)
        }
      }
    }
  }
  const visibleOrganizationIds =
    administeredOrganizationIds === undefined
      ? undefined
      : new Set([...administeredOrganizationIds, ...leaderScopedOrganizationIds])
  const organizationRepository = organizationRepositoryCreate(options.database.db)
  const organizations = organizationRepository.organizationList(options.realmId)
  if (!organizations.success) return organizations
  const activeOrganizationIds =
    visibleOrganizationIds === undefined
      ? organizations.data.filter((organization) => organization.status === "active").map((o) => o.id)
      : [...visibleOrganizationIds]
  const activeOrganizationNames = new Map(
    organizations.data
      .filter((organization) => organization.status === "active")
      .map((organization) => [organization.id, organization.name] as const),
  )
  const targetMemberships =
    activeOrganizationIds.length === 0
      ? resultCreate([] as { createdAt: number; id: string; organizationId: string; roles: string }[])
      : organizationMembershipListByOrganization({
          database: options.database,
          organizationIds: activeOrganizationIds,
          realmId: options.realmId,
          userIds: [options.targetUserId],
        })
  if (!targetMemberships.success) return targetMemberships

  const targetUsers = userBulkRead({
    database: options.database,
    realmId: options.realmId,
    userIds: [options.targetUserId],
  })
  if (!targetUsers.success) return targetUsers
  const targetEmail = targetUsers.data.find((user) => user.id === options.targetUserId)?.email ?? null
  const invitedByByOrganization = new Map<string, DirectoryInvitedBy | null>()
  if (targetEmail !== null) {
    for (const membership of targetMemberships.data) {
      if (invitedByByOrganization.has(membership.organizationId)) continue
      const accepted = organizationInvitationAcceptedResolve({
        database: options.database,
        email: targetEmail,
        organizationId: membership.organizationId,
      })
      if (!accepted.success) return accepted
      if (accepted.data === null) {
        invitedByByOrganization.set(membership.organizationId, null)
        continue
      }
      const inviter = organizationInvitationInviterResolve({
        database: options.database,
        invitedBy: accepted.data.invitedBy,
        realmId: options.realmId,
      })
      if (!inviter.success) return inviter
      invitedByByOrganization.set(
        membership.organizationId,
        directoryInvitedByCreate(inviter.data, accepted.data.invitedAt, accepted.data.acceptedAt),
      )
    }
  }

  const memberships: DirectoryUserAccessMembership[] = []
  for (const membership of targetMemberships.data) {
    const organizationName = activeOrganizationNames.get(membership.organizationId)
    if (organizationName === undefined) continue
    const roles = organizationRolesDecode(membership.roles)
    if (!roles.success) return roles
    const checked = v.safeParse(directoryUserAccessMembershipSchema, {
      createdAt: membership.createdAt,
      invitedBy: targetEmail === null ? null : (invitedByByOrganization.get(membership.organizationId) ?? null),
      membershipId: membership.id,
      organizationId: membership.organizationId,
      organizationName,
      roles: roles.data,
    })
    if (!checked.success) return resultErrorCodedCreate(op, "The directory membership is invalid.", "directory.invalid")
    memberships.push(checked.output)
  }
  memberships.sort((left, right) => left.organizationId.localeCompare(right.organizationId))

  const assignments = projectUserAssignmentListByUser({
    database: options.database,
    realmId: options.realmId,
    userId: options.targetUserId,
  })
  if (!assignments.success) return assignments
  const projectAssignments: DirectoryUserAccess["projectAssignments"] = []
  for (const entry of assignments.data) {
    if (visibleOrganizationIds !== undefined && !visibleOrganizationIds.has(entry.project.organizationId)) continue
    if (activeOrganizationNames.get(entry.project.organizationId) === undefined) continue
    projectAssignments.push({
      assignmentId: entry.assignment.id,
      projectId: entry.project.id,
      projectName: entry.project.name,
      projectOrganizationId: entry.project.organizationId,
      roleKeys: [...entry.roles.map((role) => role.key)].sort(),
      roles: [...entry.roles].sort((left, right) => left.key.localeCompare(right.key)),
    })
  }
  projectAssignments.sort((left, right) =>
    left.projectId === right.projectId
      ? left.assignmentId.localeCompare(right.assignmentId)
      : left.projectId.localeCompare(right.projectId),
  )

  const targetIsAdministrator = realmAdministratorIs({
    database: options.database,
    realmId: options.realmId,
    userId: options.targetUserId,
  })
  if (!targetIsAdministrator.success) return targetIsAdministrator

  return resultCreate({
    memberships,
    projectAssignments,
    realmAdministrator: targetIsAdministrator.data,
  })
}

function directoryInvitedByCreate(
  inviter: OrganizationInvitationInviter | null,
  invitedAt: number,
  acceptedAt: number | null,
): DirectoryInvitedBy | null {
  if (inviter === null) return null
  return {
    acceptedAt,
    ...(inviter.displayName === undefined ? {} : { displayName: inviter.displayName }),
    ...(inviter.email === undefined ? {} : { email: inviter.email }),
    invitedAt,
    userId: inviter.userId,
  }
}
