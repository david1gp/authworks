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
import type { RealmTenantContext } from "../../realms/server/index.js"
import { userPhoneNumberNormalize } from "../domain/userPhoneNumberNormalize.js"
import { userPublicViewCreate } from "../domain/userPublicViewCreate.js"
import { userEventTypes } from "../events/userEventTypes.js"
import { userPhoneNumberChangedEventPayloadSchema } from "../events/userPhoneNumberChangedEventPayloadSchema.js"
import { userRepositoryCreate } from "../persistence/userRepositoryCreate.js"
import type { UserPhoneNumberSaveRequest } from "../public/userPhoneNumberSaveRequestSchema.js"
import { userPhoneNumberSaveRequestSchema } from "../public/userPhoneNumberSaveRequestSchema.js"
import type { User } from "../public/userSchema.js"

type UserPhoneNumberSaveOptions = {
  readonly context: RealmTenantContext
  readonly correlationId?: string
  readonly database: StorageDatabase
  readonly executor?: StorageExecutor
  readonly input: UserPhoneNumberSaveRequest
  readonly realmId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly userId: string
}

/**
 * Stores the caller's own phone number without verification, so an unreachable
 * WhatsApp delivery channel never discards the typed input. Only numbers no other
 * user holds verified can be saved; verification still happens through the OTP flow.
 */
export function userPhoneNumberSave(options: UserPhoneNumberSaveOptions): Result<{ user: User }> {
  const op = "userPhoneNumberSave"
  const context = userPhoneNumberSaveContextValidate(options.context, options.realmId, options.userId)
  if (!context.success) return context
  const parsed = v.safeParse(userPhoneNumberSaveRequestSchema, options.input)
  if (!parsed.success) return resultErrorCreate(op, "The account phone-number request is invalid.", "users.invalid")
  const phoneNumber = userPhoneNumberNormalize(parsed.output.phoneNumber)
  if (!phoneNumber.success) return phoneNumber
  const runtime = options.runtime ?? options.database.runtime
  const updatedAt = runtime.now()
  if (!Number.isSafeInteger(updatedAt) || updatedAt < 0)
    return resultErrorCreate(op, "The user timestamp is invalid.", "users.invalid-timestamp")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  if (options.executor !== undefined)
    return userPhoneNumberSaveTransaction({
      context: options.context,
      correlationId,
      database: options.executor,
      phoneNumber: phoneNumber.data,
      realmId: options.realmId,
      runtime,
      updatedAt,
      userId: options.userId,
    })
  return storageTransactionRun(options.database, (executor) =>
    userPhoneNumberSaveTransaction({
      context: options.context,
      correlationId,
      database: executor,
      phoneNumber: phoneNumber.data,
      realmId: options.realmId,
      runtime,
      updatedAt,
      userId: options.userId,
    }),
  )
}

type UserPhoneNumberSaveTransactionOptions = {
  readonly context: RealmTenantContext
  readonly correlationId: string
  readonly database: StorageExecutor
  readonly phoneNumber: string
  readonly realmId: string
  readonly runtime: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly updatedAt: number
  readonly userId: string
}

function userPhoneNumberSaveTransaction(options: UserPhoneNumberSaveTransactionOptions): Result<{ user: User }> {
  const op = "userPhoneNumberSave"
  const repository = userRepositoryCreate(options.database)
  const current = repository.userGet(options.realmId, options.userId)
  if (!current.success) return current
  if (current.data === null || current.data.state !== "active" || current.data.deletedAt !== null)
    return resultErrorCreate(op, "The user was not found.", "users.not-found")
  if (current.data.phoneNumber === options.phoneNumber) {
    if (current.data.phoneNumberVerifiedAt !== null)
      return resultErrorCreate(op, "The user already has that verified phone number.", "users.conflict")
    return resultCreate({ user: userPublicViewCreate(current.data) })
  }
  const verifiedOwner = repository.userGetByVerifiedPhoneNumber(options.realmId, options.phoneNumber)
  if (!verifiedOwner.success) return verifiedOwner
  if (verifiedOwner.data !== null)
    return resultErrorCreate(op, "The user phone number is already verified by another user.", "users.conflict")
  const updated = repository.userUpdate(options.realmId, options.userId, {
    phoneNumber: options.phoneNumber,
    phoneNumberVerifiedAt: null,
    updatedAt: options.updatedAt,
    version: current.data.version + 1,
  })
  if (!updated.success) return updated
  if (updated.data === null)
    return resultErrorCreate(op, "The user could not be changed concurrently.", "users.conflict")
  const payload = v.safeParse(userPhoneNumberChangedEventPayloadSchema, { verified: false })
  if (!payload.success) return resultErrorCreate(op, "The user phone event payload is invalid.", "users.event-invalid")
  const event = storageEventAppend(
    options.database,
    {
      actorId: options.context.actorId,
      aggregateId: options.userId,
      aggregateType: "user",
      aggregateVersion: updated.data.version,
      commandIndex: 0,
      correlationId: options.correlationId,
      eventType: userEventTypes.phoneNumberChanged,
      realmId: options.realmId,
      metadata: { auditSafe: true, source: "users" },
      occurredAt: options.updatedAt,
      payload: payload.output,
    },
    options.runtime,
  )
  if (!event.success) return event
  return resultCreate({ user: userPublicViewCreate(updated.data) })
}

function userPhoneNumberSaveContextValidate(
  context: RealmTenantContext,
  realmId: string,
  userId: string,
): Result<void> {
  const op = "userPhoneNumberSave"
  if (
    context === undefined ||
    context === null ||
    context.kind !== "tenant" ||
    context.realmId !== realmId ||
    context.actor.kind !== "user" ||
    context.actor.realmId !== realmId ||
    context.actor.actorId !== userId ||
    userId.length === 0
  )
    return resultErrorCreate(op, "An authenticated user is required for the account phone number.", "users.forbidden")
  return resultCreate(undefined)
}
