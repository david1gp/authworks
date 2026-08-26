import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import type { RealmSystemContext, RealmTenantContext } from "../../realms/server/index.js"
import { userPhoneNumberNormalize } from "../domain/userPhoneNumberNormalize.js"
import { userPublicViewCreate } from "../domain/userPublicViewCreate.js"
import { userEventTypes } from "../events/userEventTypes.js"
import { userPhoneNumberChangedEventPayloadSchema } from "../events/userPhoneNumberChangedEventPayloadSchema.js"
import { userRepositoryCreate } from "../persistence/userRepositoryCreate.js"
import { userPhoneNumberSchema } from "../public/userPhoneNumberSchema.js"
import type { User } from "../public/userSchema.js"

type UserPhoneNumberChangeOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly correlationId?: string
  readonly database: StorageDatabase
  readonly executor?: StorageExecutor
  readonly input: { readonly phoneNumber: string }
  readonly realmId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly userId: string
}

const userPhoneNumberChangeInputSchema = v.strictObject({ phoneNumber: userPhoneNumberSchema })

export function userPhoneNumberChange(options: UserPhoneNumberChangeOptions): Result<{ user: User }> {
  const op = "userPhoneNumberChange"
  if (options.executor === undefined)
    return storageTransactionRun(options.database, (executor) => userPhoneNumberChange({ ...options, executor }))
  if (options.context === undefined || options.context === null)
    return resultErrorCreate(op, "A tenant context is required.", "users.tenant-required")
  if (options.context.kind === "tenant" && options.context.realmId !== options.realmId)
    return resultErrorCreate(op, "The user is not available in this tenant context.", "users.tenant-mismatch")
  const parsed = v.safeParse(userPhoneNumberChangeInputSchema, options.input)
  if (!parsed.success) return resultErrorCreate(op, "The user phone number is invalid.", "users.invalid-phone-number")
  const phoneNumber = userPhoneNumberNormalize(parsed.output.phoneNumber)
  if (!phoneNumber.success) return phoneNumber
  const runtime = options.runtime ?? options.database.runtime
  const updatedAt = runtime.now()
  if (!Number.isSafeInteger(updatedAt) || updatedAt < 0)
    return resultErrorCreate(op, "The user timestamp is invalid.", "users.invalid-timestamp")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)

  const executor = options.executor
  const repository = userRepositoryCreate(executor)
  const current = repository.userGet(options.realmId, options.userId)
  if (!current.success) return current
  if (current.data === null || current.data.state === "deleted")
    return resultErrorCreate(op, "The user was not found.", "users.not-found")
  if (current.data.phoneNumber === phoneNumber.data && current.data.phoneNumberVerifiedAt !== null)
    return resultErrorCreate(op, "The user already has that verified phone number.", "users.conflict")
  const updated = repository.userPhoneNumberChange({
    expectedVersion: current.data.version,
    phoneNumber: phoneNumber.data,
    phoneNumberVerifiedAt: updatedAt,
    realmId: options.realmId,
    updatedAt,
    userId: options.userId,
    version: current.data.version + 1,
  })
  if (!updated.success) return updated
  if (updated.data === null)
    return resultErrorCreate(op, "The user could not be changed concurrently.", "users.conflict")
  const payload = v.safeParse(userPhoneNumberChangedEventPayloadSchema, { verified: true })
  if (!payload.success) return resultErrorCreate(op, "The user phone event payload is invalid.", "users.event-invalid")
  const event = storageEventAppend(
    executor,
    {
      actorId: options.context.actorId,
      aggregateId: options.userId,
      aggregateType: "user",
      aggregateVersion: updated.data.version,
      commandIndex: 0,
      correlationId,
      eventType: userEventTypes.phoneNumberChanged,
      realmId: options.realmId,
      metadata: { auditSafe: true, source: "users" },
      occurredAt: updatedAt,
      payload: payload.output,
    },
    runtime,
  )
  if (!event.success) return event
  return resultCreate({ user: userPublicViewCreate(updated.data) })
}
