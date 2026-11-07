import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { userSessionDisplayList } from "../../users/server/userSessionDisplayList.js"
import type { OrganizationInvitationInviter } from "../public/organizationInvitationInviterSchema.js"

/** System and purged inviter actors resolve to null; unknown users resolve to null. */
const organizationInvitationSystemActorIds = new Set(["", "system"])

type OrganizationInvitationInviterResolveOptions = {
  readonly database: StorageDatabase
  readonly realmId: string
  readonly invitedBy: string
}

export function organizationInvitationInviterResolve(
  options: OrganizationInvitationInviterResolveOptions,
): Result<OrganizationInvitationInviter | null> {
  if (organizationInvitationSystemActorIds.has(options.invitedBy)) return resultCreate(null)
  const users = userSessionDisplayList({
    database: options.database,
    realmId: options.realmId,
    userIds: [options.invitedBy],
  })
  if (!users.success) return users
  const user = users.data.find((candidate) => candidate.id === options.invitedBy)
  if (user === undefined) return resultCreate(null)
  return resultCreate({
    displayName: user.displayName ?? undefined,
    email: user.email,
    userId: user.id,
  })
}
