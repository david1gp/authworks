import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import type { RealmSystemContext, RealmTenantContext } from "../../realms/server/index.js"
import { userPictureObjectKeyFromPublicUrlCreate } from "../domain/userPictureObjectKeyFromPublicUrlCreate.js"
import { userProfileNormalize } from "../domain/userProfileNormalize.js"
import { userPublicViewCreate } from "../domain/userPublicViewCreate.js"
import { userEventTypes } from "../events/userEventTypes.js"
import { userProfileUpdatedEventPayloadSchema } from "../events/userProfileUpdatedEventPayloadSchema.js"
import { userProfilePictureCleanupRepositoryCreate } from "../persistence/userProfilePictureCleanupRepositoryCreate.js"
import { userRepositoryCreate } from "../persistence/userRepositoryCreate.js"
import type { UserPictureAsset } from "../public/userPictureAssetSchema.js"
import {
  type UserProfileUpdateRequest,
  userProfileUpdateRequestSchema,
} from "../public/userProfileUpdateRequestSchema.js"
import type { User } from "../public/userSchema.js"

type UserProfileUpdateOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly input: UserProfileUpdateRequest
  readonly picture?: UserPictureAsset | null
  readonly pictureCandidateObjectKey?: string
  readonly pictureCandidateLeaseToken?: string
  readonly pictureCleanupPublicOrigin?: string
  readonly pictureOnlyIfMissing?: boolean
  readonly realmId: string
  readonly userId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function userProfileUpdate(options: UserProfileUpdateOptions): Result<{ user: User }> {
  const op = "userProfileUpdate"
  if (options.context === undefined || options.context === null)
    return resultErrorCreate(op, "A tenant context is required.", "users.tenant-required")
  if (options.context.kind === "tenant" && options.context.realmId !== options.realmId)
    return resultErrorCreate(op, "The user is not available in this tenant context.", "users.tenant-mismatch")
  const parsed = v.safeParse(userProfileUpdateRequestSchema, options.input)
  if (!parsed.success) return resultErrorCreate(op, "The patch is invalid.", "platform.invalid")
  if (options.picture === undefined && Object.keys(parsed.output).length === 0)
    return resultErrorCreate(op, "The patch is empty.", "users.empty-patch")
  const profile = userProfileNormalize({
    ...parsed.output,
    ...(options.picture === undefined ? {} : { picture: options.picture }),
  })
  if (!profile.success) return profile
  const runtime = options.runtime ?? options.database.runtime
  const updatedAt = runtime.now()
  if (!Number.isSafeInteger(updatedAt) || updatedAt < 0)
    return resultErrorCreate(op, "The user timestamp is invalid.", "users.invalid-timestamp")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)

  return storageTransactionRun(options.database, (transaction) => {
    const repository = userRepositoryCreate(transaction)
    const current = repository.userGet(options.realmId, options.userId)
    if (!current.success) return current
    if (current.data === null || current.data.state === "deleted")
      return resultErrorCreate(op, "The user was not found.", "users.not-found")
    const currentUser = current.data
    const changedFields = Object.keys(profile.data).filter((field) => {
      const key = field as keyof typeof profile.data
      if (key === "picture") {
        const currentPicture =
          currentUser.profile.pictureUrl === null
            ? undefined
            : {
                ...(currentUser.profile.pictureContentType === null
                  ? {}
                  : { contentType: currentUser.profile.pictureContentType }),
                url: currentUser.profile.pictureUrl,
              }
        const nextPicture = profile.data.picture ?? undefined
        return currentPicture?.url !== nextPicture?.url || currentPicture?.contentType !== nextPicture?.contentType
      }
      const currentValue = currentUser.profile[key] ?? undefined
      return currentValue !== profile.data[key]
    }) as (keyof typeof profile.data)[]
    if (changedFields.length === 0) {
      const candidateCleanup = userProfilePictureCleanupCandidateFinalize({
        candidateSucceeded: true,
        createdAt: updatedAt,
        database: transaction,
        leaseToken: options.pictureCandidateLeaseToken,
        objectKey: options.pictureCandidateObjectKey,
        objectUrl: currentUser.profile.pictureUrl,
        publicOrigin: options.pictureCleanupPublicOrigin,
        userName: currentUser.userName,
      })
      if (!candidateCleanup.success) return candidateCleanup
      return resultCreate({ user: userPublicViewCreate(currentUser) })
    }
    if (options.pictureOnlyIfMissing && currentUser.profile.pictureUrl !== null) {
      const candidateCleanup = userProfilePictureCleanupCandidateFinalize({
        candidateSucceeded: false,
        createdAt: updatedAt,
        database: transaction,
        leaseToken: options.pictureCandidateLeaseToken,
        objectKey: options.pictureCandidateObjectKey,
        objectUrl: currentUser.profile.pictureUrl,
        publicOrigin: options.pictureCleanupPublicOrigin,
        userName: currentUser.userName,
      })
      if (!candidateCleanup.success) return candidateCleanup
      return resultCreate({ user: userPublicViewCreate(currentUser) })
    }
    const updatedProfile =
      options.pictureOnlyIfMissing && changedFields.length === 1 && changedFields[0] === "picture"
        ? repository.userProfilePictureUpdateIfMissing(options.realmId, options.userId, {
            ...Object.fromEntries(
              changedFields.flatMap((field) =>
                field === "picture"
                  ? [
                      ["pictureContentType", profile.data.picture?.contentType ?? null],
                      ["pictureUrl", profile.data.picture?.url ?? null],
                    ]
                  : [[field, profile.data[field] ?? null]],
              ),
            ),
            updatedAt,
          })
        : repository.userProfileUpdate(options.realmId, options.userId, {
            ...Object.fromEntries(
              changedFields.flatMap((field) =>
                field === "picture"
                  ? [
                      ["pictureContentType", profile.data.picture?.contentType ?? null],
                      ["pictureUrl", profile.data.picture?.url ?? null],
                    ]
                  : [[field, profile.data[field] ?? null]],
              ),
            ),
            updatedAt,
          })
    if (!updatedProfile.success) return updatedProfile
    if (updatedProfile.data === null) {
      if (!options.pictureOnlyIfMissing) return resultErrorCreate(op, "The user was not found.", "users.not-found")
      const latest = repository.userGet(options.realmId, options.userId)
      if (!latest.success) return latest
      if (latest.data === null || latest.data.state === "deleted")
        return resultErrorCreate(op, "The user was not found.", "users.not-found")
      const candidateCleanup = userProfilePictureCleanupCandidateFinalize({
        candidateSucceeded: true,
        createdAt: updatedAt,
        database: transaction,
        leaseToken: options.pictureCandidateLeaseToken,
        objectKey: options.pictureCandidateObjectKey,
        objectUrl: latest.data.profile.pictureUrl,
        publicOrigin: options.pictureCleanupPublicOrigin,
        userName: latest.data.userName,
      })
      if (!candidateCleanup.success) return candidateCleanup
      return resultCreate({ user: userPublicViewCreate(latest.data) })
    }
    if (changedFields.includes("picture")) {
      const cleanup = userProfilePictureCleanupQueuePrevious({
        database: transaction,
        objectUrl: currentUser.profile.pictureUrl,
        publicOrigin: options.pictureCleanupPublicOrigin,
        updatedAt,
        userName: currentUser.userName,
      })
      if (!cleanup.success) return cleanup
    }
    const candidateCleanup = userProfilePictureCleanupCandidateFinalize({
      candidateSucceeded: true,
      createdAt: updatedAt,
      database: transaction,
      leaseToken: options.pictureCandidateLeaseToken,
      objectKey: options.pictureCandidateObjectKey,
      objectUrl: updatedProfile.data.profile.pictureUrl,
      publicOrigin: options.pictureCleanupPublicOrigin,
      userName: updatedProfile.data.userName,
    })
    if (!candidateCleanup.success) return candidateCleanup
    const updated = repository.userUpdate(options.realmId, options.userId, {
      updatedAt,
      version: currentUser.version + 1,
    })
    if (!updated.success) return updated
    if (updated.data === null) return resultErrorCreate(op, "The user was not found.", "users.not-found")
    const payload = v.safeParse(userProfileUpdatedEventPayloadSchema, { fields: changedFields })
    if (!payload.success)
      return resultErrorCreate(op, "The user profile event payload is invalid.", "users.event-invalid")
    const event = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: options.userId,
        aggregateType: "user",
        aggregateVersion: updated.data.version,
        commandIndex: 0,
        correlationId,
        eventType: userEventTypes.profileUpdated,
        realmId: options.realmId,
        metadata: { auditSafe: true, source: "users" },
        occurredAt: updatedAt,
        payload: payload.output,
      },
      runtime,
    )
    if (!event.success) return event
    return resultCreate({ user: userPublicViewCreate(updated.data) })
  })
}

function userProfilePictureCleanupCandidateFinalize(options: {
  readonly candidateSucceeded: boolean
  readonly createdAt: number
  readonly database: Parameters<typeof userProfilePictureCleanupRepositoryCreate>[0]
  readonly leaseToken?: string
  readonly objectKey?: string
  readonly objectUrl: string | null
  readonly publicOrigin?: string
  readonly userName: string
}): Result<void> {
  if (options.objectKey === undefined || options.leaseToken === undefined) return resultCreate(undefined)
  const repository = userProfilePictureCleanupRepositoryCreate(options.database)
  if (!options.candidateSucceeded || options.objectUrl === null || options.publicOrigin === undefined)
    return userProfilePictureCleanupRestoreOrRequeue(repository, {
      createdAt: options.createdAt,
      leaseToken: options.leaseToken,
      objectKey: options.objectKey,
    })
  const ownedKey = userPictureObjectKeyFromPublicUrlCreate({
    publicOrigin: options.publicOrigin,
    url: options.objectUrl,
    userName: options.userName,
  })
  if (!ownedKey.success || ownedKey.data !== options.objectKey)
    return userProfilePictureCleanupRestoreOrRequeue(repository, {
      createdAt: options.createdAt,
      leaseToken: options.leaseToken,
      objectKey: options.objectKey,
    })
  const completed = repository.userProfilePictureCleanupUploadComplete({
    leaseToken: options.leaseToken,
    objectKey: options.objectKey,
  })
  if (!completed.success) return completed
  if (!completed.data)
    return resultErrorCreate("userProfileUpdate", "The user picture upload reservation was lost.", "users.write-failed")
  return resultCreate(undefined)
}

function userProfilePictureCleanupRestoreOrRequeue(
  repository: ReturnType<typeof userProfilePictureCleanupRepositoryCreate>,
  options: {
    readonly createdAt: number
    readonly leaseToken: string
    readonly objectKey: string
  },
): Result<void> {
  const restored = repository.userProfilePictureCleanupUploadFailure({
    leaseToken: options.leaseToken,
    objectKey: options.objectKey,
  })
  if (!restored.success) return restored
  if (restored.data) return resultCreate(undefined)
  const requeued = repository.userProfilePictureCleanupEnqueue({
    createdAt: options.createdAt,
    objectKey: options.objectKey,
  })
  if (!requeued.success) return requeued
  return resultCreate(undefined)
}

function userProfilePictureCleanupQueuePrevious(options: {
  readonly database: Parameters<typeof userProfilePictureCleanupRepositoryCreate>[0]
  readonly objectUrl: string | null
  readonly publicOrigin?: string
  readonly updatedAt: number
  readonly userName: string
}): Result<void> {
  if (options.objectUrl === null || options.publicOrigin === undefined) return resultCreate(undefined)
  const key = userPictureObjectKeyFromPublicUrlCreate({
    publicOrigin: options.publicOrigin,
    url: options.objectUrl,
    userName: options.userName,
  })
  if (!key.success || key.data === undefined) return resultCreate(undefined)
  return userProfilePictureCleanupRepositoryCreate(options.database).userProfilePictureCleanupEnqueue({
    createdAt: options.updatedAt,
    objectKey: key.data,
  })
}
