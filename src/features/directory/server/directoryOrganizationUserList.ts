import * as v from "valibot"
import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { organizationRolesDecode } from "../../organizations/domain/organizationRolesDecode.js"
import { organizationRepositoryCreate } from "../../organizations/persistence/organizationRepositoryCreate.js"
import type { OrganizationRoleId } from "../../organizations/public/organizationRoleIdSchema.js"
import { organizationMembershipListByOrganization } from "../../organizations/server/organizationMembershipListByOrganization.js"
import type { RealmTenantContext } from "../../realms/server/index.js"
import type { User } from "../../users/public/userSchema.js"
import { userBulkRead } from "../../users/server/userBulkRead.js"
import { directoryUserViewCreate } from "../domain/directoryUserViewCreate.js"
import type { DirectoryMembership } from "../public/directoryMembershipSchema.js"
import { directoryMembershipSchema } from "../public/directoryMembershipSchema.js"
import type { DirectoryUserListQuery, DirectoryUserListResponse } from "../public/directoryUserListSchema.js"
import { directoryUserListQuerySchema } from "../public/directoryUserListSchema.js"
import { directoryEntryListPageCreate, directoryRoleFilterApply } from "./directoryEntryListPageCreate.js"

type DirectoryOrganizationUserListOptions = {
  readonly context: RealmTenantContext
  readonly database: StorageDatabase
  readonly realmId: string
  readonly organizationId: string
  readonly organizationName: string
  readonly query?: DirectoryUserListQuery
  readonly includeOtherMemberships: boolean
}

export function directoryOrganizationUserList(
  options: DirectoryOrganizationUserListOptions,
): Result<DirectoryUserListResponse> {
  const op = "directoryOrganizationUserList"
  void options.context
  const parsed = v.safeParse(directoryUserListQuerySchema, options.query ?? {})
  if (!parsed.success) return resultErrorCodedCreate(op, "The directory list query is invalid.", "directory.invalid")
  const organizationRepository = organizationRepositoryCreate(options.database.db)
  const memberships = organizationMembershipListByOrganization({
    database: options.database,
    organizationIds: [options.organizationId],
    realmId: options.realmId,
  })
  if (!memberships.success) return memberships
  if (memberships.data.length === 0) return resultCreate({ items: [] })
  const memberUserIds = [...new Set(memberships.data.map((row) => row.userId))]
  const users = userBulkRead({ database: options.database, realmId: options.realmId, userIds: memberUserIds })
  if (!users.success) return users
  if (users.data.length === 0) return resultCreate({ items: [] })
  const usersById = new Map<string, User>()
  for (const user of users.data) usersById.set(user.id, user)
  const primaryRowsByUser = new Map<string, typeof memberships.data>()
  for (const row of memberships.data) {
    const rows = primaryRowsByUser.get(row.userId) ?? []
    rows.push(row)
    primaryRowsByUser.set(row.userId, rows)
  }

  const organizationNamesById = new Map<string, string>()
  const otherRowsByUser = new Map<
    string,
    { createdAt: number; id: string; organizationId: string; roles: OrganizationRoleId[] }[]
  >()
  if (options.includeOtherMemberships) {
    const organizations = organizationRepository.organizationList(options.realmId)
    if (!organizations.success) return organizations
    for (const organization of organizations.data) {
      if (organization.status === "removed") continue
      organizationNamesById.set(organization.id, organization.name)
    }
    const activeOrganizationIds = [...organizationNamesById.keys()].filter((id) => id !== options.organizationId)
    const others = organizationMembershipListByOrganization({
      database: options.database,
      organizationIds: activeOrganizationIds,
      realmId: options.realmId,
      userIds: memberUserIds,
    })
    if (!others.success) return others
    for (const row of others.data) {
      if (organizationNamesById.get(row.organizationId) === undefined) continue
      const roles = organizationRolesDecode(row.roles)
      if (!roles.success) return roles
      const rows = otherRowsByUser.get(row.userId) ?? []
      rows.push({ createdAt: row.createdAt, id: row.id, organizationId: row.organizationId, roles: roles.data })
      otherRowsByUser.set(row.userId, rows)
    }
    for (const rows of otherRowsByUser.values())
      rows.sort((left, right) => left.organizationId.localeCompare(right.organizationId))
  }

  const entries: DirectoryUserListResponse["items"] = []
  for (const user of usersById.values()) {
    const membershipEntries: DirectoryMembership[] = []
    for (const row of primaryRowsByUser.get(user.id) ?? []) {
      const roles = organizationRolesDecode(row.roles)
      if (!roles.success) return roles
      const primary = v.safeParse(directoryMembershipSchema, {
        createdAt: row.createdAt,
        membershipId: row.id,
        organizationId: row.organizationId,
        organizationName: options.organizationName,
        roles: roles.data,
      })
      if (!primary.success)
        return resultErrorCodedCreate(op, "The directory membership is invalid.", "directory.invalid")
      membershipEntries.push(primary.output)
    }
    for (const other of otherRowsByUser.get(user.id) ?? []) {
      const candidate = v.safeParse(directoryMembershipSchema, {
        createdAt: other.createdAt,
        membershipId: other.id,
        organizationId: other.organizationId,
        organizationName: organizationNamesById.get(other.organizationId) ?? "",
        roles: other.roles,
      })
      if (!candidate.success)
        return resultErrorCodedCreate(op, "The directory membership is invalid.", "directory.invalid")
      membershipEntries.push(candidate.output)
    }
    const userView = directoryUserViewCreate(user)
    if (!userView.success) return userView
    entries.push({ memberships: membershipEntries, user: userView.data })
  }

  // Organization-scoped counts and role pills describe membership of this organization only,
  // so the filter must ignore roles the person holds in other organizations.
  const filtered =
    parsed.output.role === undefined
      ? entries
      : directoryRoleFilterApply(entries, parsed.output.role, options.organizationId)
  return directoryEntryListPageCreate({
    entries: filtered,
    fallbackSortBy: "lastSignInAt",
    fallbackSortDirection: "desc",
    query: parsed.output,
    usersById,
  })
}
