import * as v from "valibot"
import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { organizationRolesDecode } from "../../organizations/domain/organizationRolesDecode.js"
import { organizationRepositoryCreate } from "../../organizations/persistence/organizationRepositoryCreate.js"
import { organizationMembershipListByOrganization } from "../../organizations/server/organizationMembershipListByOrganization.js"
import { projectUserAssignmentListByUser } from "../../projects/server/projectUserAssignmentListByUser.js"
import type { RealmTenantContext } from "../../realms/server/index.js"
import { realmAdministratorIs } from "../../realms/server/realmAdministratorIs.js"
import type { DirectoryMembership } from "../public/directoryMembershipSchema.js"
import { directoryMembershipSchema } from "../public/directoryMembershipSchema.js"
import type { DirectoryUserAccess } from "../public/directoryUserAccessSchema.js"

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
  const organizationRepository = organizationRepositoryCreate(options.database.db)
  const organizations = organizationRepository.organizationList(options.realmId)
  if (!organizations.success) return organizations
  const activeOrganizationIds =
    administeredOrganizationIds === undefined
      ? organizations.data.filter((organization) => organization.status === "active").map((o) => o.id)
      : [...administeredOrganizationIds]
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

  const memberships: DirectoryMembership[] = []
  for (const membership of targetMemberships.data) {
    const organizationName = activeOrganizationNames.get(membership.organizationId)
    if (organizationName === undefined) continue
    const roles = organizationRolesDecode(membership.roles)
    if (!roles.success) return roles
    const checked = v.safeParse(directoryMembershipSchema, {
      createdAt: membership.createdAt,
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
    if (administeredOrganizationIds !== undefined && !administeredOrganizationIds.has(entry.project.organizationId))
      continue
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
