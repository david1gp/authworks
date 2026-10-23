import * as v from "valibot"
import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { organizationRolesDecode } from "../../organizations/domain/organizationRolesDecode.js"
import { organizationRepositoryCreate } from "../../organizations/persistence/organizationRepositoryCreate.js"
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

type DirectoryRealmUserListOptions = {
  readonly context: RealmTenantContext
  readonly database: StorageDatabase
  readonly realmId: string
  readonly query?: DirectoryUserListQuery
}

export function directoryRealmUserList(options: DirectoryRealmUserListOptions): Result<DirectoryUserListResponse> {
  const op = "directoryRealmUserList"
  void options.context
  const parsed = v.safeParse(directoryUserListQuerySchema, options.query ?? {})
  if (!parsed.success) return resultErrorCodedCreate(op, "The directory list query is invalid.", "directory.invalid")
  const organizationRepository = organizationRepositoryCreate(options.database.db)
  const organizations = organizationRepository.organizationList(options.realmId)
  if (!organizations.success) return organizations
  const activeOrganizationNames = new Map(
    organizations.data
      .filter((organization) => organization.status === "active")
      .map((organization) => [organization.id, organization.name] as const),
  )
  const activeOrganizationIds = [...activeOrganizationNames.keys()]
  const memberships =
    activeOrganizationIds.length === 0
      ? resultCreate([] as { createdAt: number; id: string; organizationId: string; roles: string; userId: string }[])
      : organizationMembershipListByOrganization({
          database: options.database,
          organizationIds: activeOrganizationIds,
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
  const rowsByUser = new Map<string, typeof memberships.data>()
  for (const row of memberships.data) {
    const rows = rowsByUser.get(row.userId) ?? []
    rows.push(row)
    rowsByUser.set(row.userId, rows)
  }

  const entries: DirectoryUserListResponse["items"] = []
  for (const user of usersById.values()) {
    const items: DirectoryMembership[] = []
    for (const row of rowsByUser.get(user.id) ?? []) {
      const organizationName = activeOrganizationNames.get(row.organizationId)
      if (organizationName === undefined) continue
      const roles = organizationRolesDecode(row.roles)
      if (!roles.success) return roles
      const candidate = v.safeParse(directoryMembershipSchema, {
        createdAt: row.createdAt,
        membershipId: row.id,
        organizationId: row.organizationId,
        organizationName,
        roles: roles.data,
      })
      if (!candidate.success)
        return resultErrorCodedCreate(op, "The directory membership is invalid.", "directory.invalid")
      items.push(candidate.output)
    }
    if (items.length === 0) continue
    items.sort((left, right) => left.organizationId.localeCompare(right.organizationId))
    const userView = directoryUserViewCreate(user)
    if (!userView.success) return userView
    entries.push({ memberships: items, user: userView.data })
  }

  const filtered = parsed.output.role === undefined ? entries : directoryRoleFilterApply(entries, parsed.output.role)
  return directoryEntryListPageCreate({
    entries: filtered,
    fallbackSortBy: "lastSignInAt",
    fallbackSortDirection: "desc",
    query: parsed.output,
    usersById,
  })
}
