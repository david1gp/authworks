import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import type { RealmTenantContext } from "../../realms/server/index.js"
import type { Session } from "../../sessions/public/sessionSchema.js"
import { userEmailAddressContextValidate } from "../domain/userEmailAddressContextValidate.js"
import { userEmailAddressPublicViewCreate } from "../domain/userEmailAddressPublicViewCreate.js"
import { userEmailChangeRecentAuthenticationValidate } from "../domain/userEmailChangeRecentAuthenticationValidate.js"
import { userEmailAddressPrimarySetEventPayloadSchema } from "../events/userEmailAddressPrimarySetEventPayloadSchema.js"
import { userEventTypes } from "../events/userEventTypes.js"
import { userEmailRepositoryCreate } from "../persistence/userEmailRepositoryCreate.js"
import { userRepositoryCreate } from "../persistence/userRepositoryCreate.js"
import type { UserEmailAddressPrimarySetRequest } from "../public/userEmailAddressPrimarySetRequestSchema.js"
import { userEmailAddressPrimarySetRequestSchema } from "../public/userEmailAddressPrimarySetRequestSchema.js"
import type { UserEmailAddressPrimarySetResponse } from "../public/userEmailAddressPrimarySetResponseSchema.js"

type UserEmailAddressPrimarySetOptions = {
  readonly context: RealmTenantContext
  readonly correlationId?: string
  readonly database: StorageDatabase
  readonly emailId: string
  readonly input?: UserEmailAddressPrimarySetRequest
  readonly realmId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly session?: Session
  readonly userId: string
}

export function userEmailAddressPrimarySet(
  options: UserEmailAddressPrimarySetOptions,
): Result<UserEmailAddressPrimarySetResponse> {
  const op = "userEmailAddressPrimarySet"
  const context = userEmailAddressContextValidate(options.context, options.realmId, options.userId)
  if (!context.success) return context
  const parsed = v.safeParse(userEmailAddressPrimarySetRequestSchema, options.input ?? {})
  if (!parsed.success) return resultErrorCreate(op, "The primary email address request is invalid.", "users.invalid")
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0)
    return resultErrorCreate(op, "The primary email address timestamp is invalid.", "users.invalid-timestamp")
  const recent = userEmailChangeRecentAuthenticationValidate(options.session, options.realmId, options.userId, now)
  if (!recent.success) return recent
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  return storageTransactionRun(options.database, (transaction) => {
    const users = userRepositoryCreate(transaction)
    const user = users.userGet(options.realmId, options.userId)
    if (!user.success) return user
    if (user.data === null || user.data.state !== "active" || user.data.deletedAt !== null)
      return resultErrorCreate(op, "The authenticated user is not available.", "users.not-found")
    const repository = userEmailRepositoryCreate(transaction)
    const current = repository.userEmailGet(options.realmId, options.userId, options.emailId)
    if (!current.success) return current
    if (current.data === null) return resultErrorCreate(op, "The email address was not found.", "users.not-found")
    if (current.data.isPrimary) {
      if (parsed.output.expectedVersion !== undefined && parsed.output.expectedVersion !== current.data.version)
        return resultErrorCreate(op, "The email address changed concurrently.", "users.conflict")
      return resultCreate({ email: userEmailAddressPublicViewCreate(current.data) })
    }
    const promoted = repository.userEmailPrimarySet({
      emailId: current.data.id,
      expectedVersion: parsed.output.expectedVersion ?? current.data.version,
      realmId: options.realmId,
      updatedAt: now,
      userId: options.userId,
      version: (parsed.output.expectedVersion ?? current.data.version) + 1,
    })
    if (!promoted.success) return promoted
    if (promoted.data === null)
      return resultErrorCreate(op, "The email address changed concurrently.", "users.conflict")
    const payload = v.safeParse(userEmailAddressPrimarySetEventPayloadSchema, { primary: true })
    if (!payload.success)
      return resultErrorCreate(op, "The primary email address event payload is invalid.", "users.event-invalid")
    const event = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: promoted.data.id,
        aggregateType: "user_email_address",
        aggregateVersion: promoted.data.version,
        commandIndex: 0,
        correlationId,
        eventType: userEventTypes.emailAddressPrimarySet,
        realmId: options.realmId,
        metadata: { auditSafe: true, source: "users" },
        occurredAt: now,
        payload: payload.output,
      },
      runtime,
    )
    if (!event.success) return event
    return resultCreate({ email: userEmailAddressPublicViewCreate(promoted.data) })
  })
}
