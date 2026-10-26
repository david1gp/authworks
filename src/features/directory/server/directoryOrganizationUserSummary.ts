import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { organizationRolesDecode } from "../../organizations/domain/organizationRolesDecode.js"
import { organizationRepositoryCreate } from "../../organizations/persistence/organizationRepositoryCreate.js"
import { userBulkRead } from "../../users/server/userBulkRead.js"
import type { DirectoryOrganizationUserSummary } from "../public/directoryOrganizationUserSummarySchema.js"

type DirectoryOrganizationUserSummaryOptions = {
  readonly database: StorageDatabase
  readonly realmId: string
  readonly organizationId: string
}

export function directoryOrganizationUserSummary(
  options: DirectoryOrganizationUserSummaryOptions,
): Result<DirectoryOrganizationUserSummary> {
  const op = "directoryOrganizationUserSummary"
  if (options.realmId.length === 0 || options.organizationId.length === 0)
    return resultErrorCodedCreate(op, "The directory summary lookup is invalid.", "directory.invalid")
  const repository = organizationRepositoryCreate(options.database.db)
  const memberships = repository.organizationMembershipList(options.organizationId)
  if (!memberships.success) return memberships
  const active = memberships.data.filter((row) => row.realmId === options.realmId)
  // Membership rows carry no foreign key to users, so a membership can outlive its user.
  // The people list only shows memberships with a user row; the counts must agree with it.
  const users = userBulkRead({
    database: options.database,
    realmId: options.realmId,
    userIds: [...new Set(active.map((membership) => membership.userId))],
  })
  if (!users.success) return users
  const existingUserIds = new Set(users.data.map((user) => user.id))
  const counts = { admin: 0, guest: 0, member: 0, owner: 0 }
  const seen = new Set<string>()
  for (const membership of active) {
    if (!existingUserIds.has(membership.userId)) continue
    const roles = organizationRolesDecode(membership.roles)
    if (!roles.success) return roles
    seen.add(membership.userId)
    for (const role of roles.data) {
      if (role === "admin") counts.admin += 1
      if (role === "guest") counts.guest += 1
      if (role === "member") counts.member += 1
      if (role === "owner") counts.owner += 1
    }
  }
  return resultCreate({ roles: counts, total: seen.size })
}
