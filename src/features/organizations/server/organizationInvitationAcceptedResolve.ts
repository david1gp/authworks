import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { organizationEmailNormalize } from "../domain/organizationEmailNormalize.js"
import { organizationRepositoryCreate } from "../persistence/organizationRepositoryCreate.js"

type OrganizationInvitationAcceptedResolveOptions = {
  readonly database: StorageDatabase | StorageExecutor
  readonly organizationId: string
  readonly email: string
}

type OrganizationInvitationAcceptedResolveOutcome = {
  readonly acceptedAt: number | null
  readonly invitedAt: number
  readonly invitedBy: string
} | null

/**
 * Join source for invited-by display: the latest accepted invitation matching
 * the organization and the user's current email. Membership-created events
 * record the joining user as actor, not the inviter, so the invitation row is
 * the reliable join.
 */
export function organizationInvitationAcceptedResolve(
  options: OrganizationInvitationAcceptedResolveOptions,
): Result<OrganizationInvitationAcceptedResolveOutcome> {
  if (options.organizationId.length === 0 || options.email.length === 0) return resultCreate(null)
  const email = organizationEmailNormalize(options.email)
  if (!email.success) return resultCreate(null)
  const executor = (
    "db" in options.database ? (options.database as StorageDatabase).db : options.database
  ) as StorageExecutor
  const rows = organizationRepositoryCreate(executor).organizationInvitationList(options.organizationId)
  if (!rows.success) return rows
  let latest: { acceptedAt: number | null; createdAt: number; invitedBy: string } | null = null
  for (const row of rows.data) {
    if (row.status !== "accepted") continue
    if (row.email.trim().toLowerCase() !== email.data) continue
    const acceptedAt = row.acceptedAt ?? null
    if (
      latest === null ||
      (acceptedAt ?? -1) > (latest.acceptedAt ?? -1) ||
      ((acceptedAt ?? -1) === (latest.acceptedAt ?? -1) && row.createdAt > latest.createdAt)
    )
      latest = { acceptedAt, createdAt: row.createdAt, invitedBy: row.invitedBy }
  }
  if (latest === null) return resultCreate(null)
  return resultCreate({ acceptedAt: latest.acceptedAt, invitedAt: latest.createdAt, invitedBy: latest.invitedBy })
}
