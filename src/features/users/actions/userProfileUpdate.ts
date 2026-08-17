import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import type { InstanceSystemContext } from "../../instances/domain/instanceSystemContext.js"
import type { InstanceTenantContext } from "../../instances/domain/instanceTenantContext.js"
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
  readonly context: InstanceSystemContext | InstanceTenantContext
  readonly database: StorageDatabase
  readonly input: UserProfileUpdateRequest
  readonly instanceId: string
  readonly userId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function userProfileUpdate(options: UserProfileUpdateOptions): Result<{ user: User }> {
  const op = "userProfileUpdate"
  if (options.context === undefined || options.context === null)
    return resultErrorCreate(op, "A tenant context is required.")
  if (options.context.kind === "tenant" && options.context.instanceId !== options.instanceId)
    return resultErrorCreate(op, "The user is not available in this tenant context.")
  const parsed = v.safeParse(userProfileUpdateRequestSchema, options.input)
  if (!parsed.success) return resultErrorCreate(op, "The user profile update is invalid.")
  if (Object.keys(parsed.output).length === 0) return resultErrorCreate(op, "The user profile update is empty.")
  const profile = userProfileNormalize(parsed.output)
  if (!profile.success) return profile
  const runtime = options.runtime ?? options.database.runtime
  const updatedAt = runtime.now()
  if (!Number.isSafeInteger(updatedAt) || updatedAt < 0) return resultErrorCreate(op, "The user timestamp is invalid.")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)

  return storageTransactionRun(options.database, (transaction) => {
    const repository = userRepositoryCreate(transaction)
    const current = repository.userGet(options.instanceId, options.userId)
    if (!current.success) return current
    if (current.data === null || current.data.state === "deleted")
      return resultErrorCreate(op, "The user was not found.")
    const currentUser = current.data
    const changedFields = Object.keys(profile.data).filter((field) => {
      const key = field as keyof typeof profile.data
      const currentValue = currentUser.profile[key] ?? undefined
      return currentValue !== profile.data[key]
    }) as (keyof typeof profile.data)[]
    if (changedFields.length === 0) return resultCreate({ user: userPublicViewCreate(currentUser) })
    const updatedProfile = repository.userProfileUpdate(options.instanceId, options.userId, {
      ...Object.fromEntries(changedFields.map((field) => [field, profile.data[field] ?? null])),
      updatedAt,
    })
    if (!updatedProfile.success) return updatedProfile
    if (updatedProfile.data === null) return resultErrorCreate(op, "The user was not found.")
    const updated = repository.userUpdate(options.instanceId, options.userId, {
      updatedAt,
      version: currentUser.version + 1,
    })
    if (!updated.success) return updated
    if (updated.data === null) return resultErrorCreate(op, "The user was not found.")
    const payload = v.safeParse(userProfileUpdatedEventPayloadSchema, { fields: changedFields })
    if (!payload.success) return resultErrorCreate(op, "The user profile event payload is invalid.")
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
        instanceId: options.instanceId,
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
