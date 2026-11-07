import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { organizationRepositoryCreate } from "../../organizations/persistence/organizationRepositoryCreate.js"
import { userBulkRead } from "../../users/server/userBulkRead.js"

type TeamMemberEligibilityResolveOptions = {
  readonly database: StorageExecutor
  readonly realmId: string
  readonly organizationId: string
  readonly userId: string
  readonly repository: ReturnType<typeof organizationRepositoryCreate>
}

export function teamMemberEligibilityResolve(options: TeamMemberEligibilityResolveOptions): Result<{ userId: string }> {
  const op = "teamMemberEligibilityResolve"
  const membership = options.repository.organizationMembershipGetByOrganizationUser(
    options.organizationId,
    options.userId,
  )
  if (!membership.success) return membership
  if (membership.data === null)
    return resultErrorCodedCreate(op, "The user is not a member of this organization.", "teams.not-member")
  const users = userBulkRead({
    database: options.database,
    realmId: options.realmId,
    userIds: [options.userId],
  })
  if (!users.success) return users
  const user = users.data.find((candidate) => candidate.id === options.userId)
  if (user === undefined || user.state === "deleted")
    return resultErrorCodedCreate(op, "The user is not available for team assignment.", "teams.not-member")
  return resultCreate({ userId: options.userId })
}
