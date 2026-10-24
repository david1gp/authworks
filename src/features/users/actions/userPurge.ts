import { and, eq } from "drizzle-orm"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { R2ObjectStorage } from "../../../platform/storage/r2/r2ObjectStorage.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventsPurge } from "../../../platform/storage/storageEventsPurge.js"
import type { StorageTransaction } from "../../../platform/storage/storageSchema.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import type { AuthorizationActorContext } from "../../authorization/public/authorizationActorContextSchema.js"
import { authorizationPermissionDefinitions } from "../../authorization/public/authorizationPermissionDefinitions.js"
import { organizationInvitationTable } from "../../organizations/persistence/organizationInvitationTable.js"
import { realmAdministratorContextAuthorize, realmAdministratorIs } from "../../realms/server/index.js"
import { userPictureObjectKeyFromPublicUrlCreate } from "../domain/userPictureObjectKeyFromPublicUrlCreate.js"
import { userProfilePictureCleanupRepositoryCreate } from "../persistence/userProfilePictureCleanupRepositoryCreate.js"
import { userRepositoryCreate } from "../persistence/userRepositoryCreate.js"
import { userProfilePictureCleanupDrain } from "./userProfilePictureCleanupDrain.js"

type UserPurgeOptions = {
  readonly actor: AuthorizationActorContext
  readonly database: StorageDatabase
  readonly realmId: string
  readonly userId: string
  readonly profilePicturePublicOrigin?: string
  readonly profilePictureStorage?: R2ObjectStorage
}

// GDPR/test-data purge. Appends NO new event about the purged user: the
// point of purge is removing the user's audit trail. The user row must
// already be soft-deleted; hard-delete then cascades to credentials,
// sessions, tokens, consents, project assignments, membership rows are
// removed explicitly (no FK to users), invitations keep their history but
// their invited_by pointer is nulled when it names the purged user.
export function userPurge(options: UserPurgeOptions): Promise<Result<{ purged: boolean }>> {
  const op = "userPurge"
  const authorization = realmAdministratorContextAuthorize({
    actor: options.actor,
    database: options.database,
    permission: authorizationPermissionDefinitions.realmPurge,
    realmId: options.realmId,
  })
  if (!authorization.success) return Promise.resolve(authorization)
  const administrator = realmAdministratorOrBootstrap(options.actor, options.database, options.realmId)
  if (!administrator.success) return Promise.resolve(administrator)
  if (!administrator.data)
    return Promise.resolve(resultErrorCreate(op, "Only realm administrators can purge users.", "users.forbidden"))
  const purged = storageTransactionRun(options.database, (transaction) => {
    const repository = userRepositoryCreate(transaction)
    const current = repository.userGet(options.realmId, options.userId)
    if (!current.success) return current
    if (current.data === null) return resultErrorCreate(op, "The user was not found.", "users.not-found")
    if (current.data.state !== "deleted")
      return resultErrorCreate(op, "Only deleted users can be purged.", "users.purge-not-deleted")
    const pictureKey = userPurgePictureKeyGet(
      current.data.profile.pictureUrl,
      options.profilePicturePublicOrigin,
      current.data.userName,
    )
    if (!pictureKey.success) return pictureKey
    const events = storageEventsPurge(transaction, [options.userId], [options.userId])
    if (!events.success) return events
    const deleted = repository.userDelete(options.realmId, options.userId)
    if (!deleted.success) return deleted
    const invitations = userPurgeInvitedByClear(transaction, options.realmId, options.userId)
    if (!invitations.success) return invitations
    if (pictureKey.data !== undefined) {
      const queued = userProfilePictureCleanupRepositoryCreate(transaction).userProfilePictureCleanupEnqueue({
        createdAt: options.database.runtime.now(),
        objectKey: pictureKey.data,
      })
      if (!queued.success) return queued
    }
    return resultCreate({ purged: true })
  })
  if (!purged.success) return Promise.resolve(purged)
  return userProfilePictureCleanupDrain({
    database: options.database,
    publicOrigin: options.profilePicturePublicOrigin,
    storage: options.profilePictureStorage,
  }).then((drained) => {
    if (!drained.success) return drained
    return resultCreate({ purged: true })
  })
}

function userPurgePictureKeyGet(
  objectUrl: string | null,
  publicOrigin: string | undefined,
  userName: string,
): Result<string | undefined> {
  if (objectUrl === null || publicOrigin === undefined) return resultCreate(undefined)
  const key = userPictureObjectKeyFromPublicUrlCreate({ publicOrigin, url: objectUrl, userName })
  if (!key.success || key.data === undefined) return resultCreate(undefined)
  return resultCreate(key.data)
}

function userPurgeInvitedByClear(transaction: StorageTransaction, realmId: string, userId: string): Result<void> {
  try {
    // invited_by is TEXT NOT NULL with no FK; detach rather than delete the
    // invitation rows so the org's invitation history survives.
    transaction
      .update(organizationInvitationTable)
      .set({ invitedBy: "" })
      .where(and(eq(organizationInvitationTable.realmId, realmId), eq(organizationInvitationTable.invitedBy, userId)))
      .run()
    return resultCreate(undefined)
  } catch (_error) {
    return resultErrorCreate("userPurge", "The user invitations could not be detached.", "users.write-failed")
  }
}

function realmAdministratorOrBootstrap(
  actor: AuthorizationActorContext,
  database: StorageDatabase,
  realmId: string,
): Result<boolean> {
  if (actor.kind === "bootstrap_admin") return resultCreate(true)
  if (actor.kind !== "user") return resultCreate(false)
  const administrator = realmAdministratorIs({ database, realmId, userId: actor.actorId })
  if (!administrator.success) return administrator
  return resultCreate(administrator.data)
}
