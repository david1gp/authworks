import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { patchInputParse } from "../../../platform/http/patchInputParse.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { userProfileNormalize } from "../domain/userProfileNormalize.js"
import { userPublicViewCreate } from "../domain/userPublicViewCreate.js"
import { userEventTypes } from "../events/userEventTypes.js"
import { userProfileUpdatedEventPayloadSchema } from "../events/userProfileUpdatedEventPayloadSchema.js"
import { userRepositoryCreate } from "../persistence/userRepositoryCreate.js"
import {
  type UserProfileUpdateRequest,
  userProfileUpdateRequestSchema,
} from "../public/userProfileUpdateRequestSchema.js"
import type { User } from "../public/userSchema.js"

type UserProfileUpdateOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly input: UserProfileUpdateRequest
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
  const parsed = patchInputParse(op, userProfileUpdateRequestSchema, options.input, "users.empty-patch")
  if (!parsed.success) return parsed
  const profile = userProfileNormalize(parsed.data)
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
    if (changedFields.length === 0) return resultCreate({ user: userPublicViewCreate(currentUser) })
    const updatedProfile = repository.userProfileUpdate(options.realmId, options.userId, {
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
    if (updatedProfile.data === null) return resultErrorCreate(op, "The user was not found.", "users.not-found")
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
