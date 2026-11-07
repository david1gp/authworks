import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import { listRowsPage } from "../../../platform/http/listRowsPage.js"
import { listSortByResolve } from "../../../platform/http/listSortByResolve.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { organizationRepositoryCreate } from "../../organizations/persistence/organizationRepositoryCreate.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { userBulkRead } from "../../users/server/userBulkRead.js"
import { userSessionDisplayList } from "../../users/server/userSessionDisplayList.js"
import { teamRepositoryCreate } from "../persistence/teamRepositoryCreate.js"
import type { Team } from "../public/teamSchema.js"
import type { TeamListResponse } from "../public/teamListResponseSchema.js"
import { teamContextAuthorize } from "./teamContextAuthorize.js"

type TeamListOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly realmId: string
  readonly organizationId: string
  readonly query?: ListQuery
}

export function teamList(options: TeamListOptions): Result<TeamListResponse> {
  const op = "teamList"
  if (options.context.kind === "tenant" && options.context.realmId !== options.realmId)
    return resultErrorCodedCreate(op, "The teams are not available in this tenant context.", "teams.tenant-mismatch")
  const organizationRepository = organizationRepositoryCreate(options.database.db)
  const repository = teamRepositoryCreate(options.database.db)
  const organization = organizationRepository.organizationGet(options.organizationId)
  if (!organization.success) return organization
  if (
    organization.data === null ||
    organization.data.realmId !== options.realmId ||
    organization.data.status !== "active"
  )
    return resultErrorCodedCreate(op, "The organization was not found.", "teams.not-found")
  const admin = teamContextAuthorize({
    context: options.context,
    database: options.database,
    leaderAllowed: false,
    organization: organization.data,
    organizationRepository,
    team: null,
    teamRepository: repository,
  })
  let rows = repository.teamList(options.organizationId)
  if (!rows.success) return rows
  if (!admin.success) {
    if (options.context.kind !== "tenant") return admin
    const membership = organizationRepository.organizationMembershipGetByOrganizationUser(
      options.organizationId,
      options.context.actorId,
    )
    if (!membership.success) return membership
    if (membership.data === null) return admin
    const led = repository.teamListByLeader(options.organizationId, options.context.actorId)
    if (!led.success) return led
    if (led.data.length === 0) return admin
    rows = resultCreate(led.data)
  }
  const memberships = repository.teamMembershipListByOrganization(options.organizationId)
  if (!memberships.success) return memberships
  const memberCountByTeam = new Map<string, number>()
  const assignedUserIds = new Set<string>()
  for (const membership of memberships.data) {
    memberCountByTeam.set(membership.teamId, (memberCountByTeam.get(membership.teamId) ?? 0) + 1)
    assignedUserIds.add(membership.userId)
  }
  const organizationMemberships = organizationRepository.organizationMembershipList(options.organizationId)
  if (!organizationMemberships.success) return organizationMemberships
  const users = userBulkRead({
    database: options.database,
    realmId: options.realmId,
    userIds: organizationMemberships.data.map((membership) => membership.userId),
  })
  if (!users.success) return users
  const stateByUserId = new Map(users.data.map((user) => [user.id, user.state]))
  let unassignedCount = 0
  for (const membership of organizationMemberships.data) {
    if (assignedUserIds.has(membership.userId)) continue
    if (stateByUserId.get(membership.userId) === "deleted") continue
    if (!stateByUserId.has(membership.userId)) continue
    unassignedCount += 1
  }
  const names = userSessionDisplayList({
    database: options.database,
    realmId: options.realmId,
    userIds: rows.data.map((row) => row.leaderUserId),
  })
  if (!names.success) return names
  const namesById = new Map(names.data.map((user) => [user.id, user]))
  const teams: Team[] = rows.data.map((row) => ({
    createdAt: row.createdAt,
    id: row.id,
    leader: {
      displayName: namesById.get(row.leaderUserId)?.displayName ?? null,
      email: namesById.get(row.leaderUserId)?.email ?? null,
      userId: row.leaderUserId,
    },
    memberCount: memberCountByTeam.get(row.id) ?? 0,
    name: row.name,
    organizationId: row.organizationId,
    realmId: row.realmId,
    slug: row.slug,
    updatedAt: row.updatedAt,
  }))
  const sortBy = listSortByResolve(options.query?.sortBy, ["createdAt", "name", "slug"], "createdAt")
  if (!sortBy.success) return sortBy
  const page = listRowsPage({
    idGet: (team) => team.id,
    query: options.query,
    rows: teams,
    sortValueGet: (team) => {
      if (sortBy.data === "name") return team.name
      if (sortBy.data === "slug") return team.slug
      return team.createdAt
    },
  })
  if (!page.success) return page
  return resultCreate({ ...page.data, unassignedCount })
}
