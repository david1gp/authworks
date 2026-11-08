import * as v from "valibot"
import type { Result } from "#result"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { organizationRolesDecode } from "../../organizations/domain/organizationRolesDecode.js"
import { organizationRepositoryCreate } from "../../organizations/persistence/organizationRepositoryCreate.js"
import { organizationMembershipListByOrganization } from "../../organizations/server/organizationMembershipListByOrganization.js"
import type { RealmTenantContext } from "../../realms/server/index.js"
import type { User } from "../../users/public/userSchema.js"
import { userRealmList } from "../../users/server/userRealmList.js"
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
  const memberships = organizationMembershipListByOrganization({
    database: options.database,
    organizationIds: [...activeOrganizationNames.keys()],
    realmId: options.realmId,
  })
  if (!memberships.success) return memberships
  const users = userRealmList({
    database: options.database,
    ...(parsed.output.state === "deleted" || parsed.output.includeDeleted === true ? { includeDeleted: true } : {}),
    realmId: options.realmId,
  })
  if (!users.success) return users
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
    items.sort((left, right) => left.organizationId.localeCompare(right.organizationId))
    const userView = directoryUserViewCreate(user)
    if (!userView.success) return userView
    // Team membership is organization-scoped while realm entries span organizations,
    // so a single entry team would be ambiguous: realm scope always reports null.
    entries.push({ memberships: items, team: null, user: userView.data })
  }

  // Realm scope is organization-agnostic: a person matches when they hold the role anywhere.
  // The team filter is organization-scoped and does not apply here; the realm route accepts
  // the shared query shape but intentionally leaves entries unfiltered by team.
  const filtered = parsed.output.role === undefined ? entries : directoryRoleFilterApply(entries, parsed.output.role)
  return directoryEntryListPageCreate({
    entries: filtered,
    fallbackSortBy: "lastSignInAt",
    fallbackSortDirection: "desc",
    query: parsed.output,
    usersById,
  })
}
