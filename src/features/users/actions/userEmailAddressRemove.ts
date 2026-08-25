import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import type { Session } from "../../sessions/public/sessionSchema.js"
import { userEmailAddressContextValidate } from "../domain/userEmailAddressContextValidate.js"
import { userEmailChangeRecentAuthenticationValidate } from "../domain/userEmailChangeRecentAuthenticationValidate.js"
import { userEmailAddressRemovedEventPayloadSchema } from "../events/userEmailAddressRemovedEventPayloadSchema.js"
import { userEventTypes } from "../events/userEventTypes.js"
import { userEmailChangeRepositoryCreate } from "../persistence/userEmailChangeRepositoryCreate.js"
import { userEmailRepositoryCreate } from "../persistence/userEmailRepositoryCreate.js"
import { userRepositoryCreate } from "../persistence/userRepositoryCreate.js"
import type { UserEmailAddressRemoveResponse } from "../public/userEmailAddressRemoveResponseSchema.js"

type UserEmailAddressRemoveOptions = {
  readonly context: RealmTenantContext
  readonly correlationId?: string
  readonly database: StorageDatabase
  readonly emailId: string
  readonly expectedVersion?: number
  readonly realmId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly session?: Session
  readonly userId: string
}

export function userEmailAddressRemove(options: UserEmailAddressRemoveOptions): Result<UserEmailAddressRemoveResponse> {
  const op = "userEmailAddressRemove"
  const context = userEmailAddressContextValidate(options.context, options.realmId, options.userId)
  if (!context.success) return context
  if (
    options.expectedVersion !== undefined &&
    (!Number.isSafeInteger(options.expectedVersion) || options.expectedVersion < 1)
  )
    return resultErrorCreate(op, "The email address version is invalid.", "users.invalid")
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0)
    return resultErrorCreate(op, "The email address removal timestamp is invalid.", "users.invalid-timestamp")
  const recent = userEmailChangeRecentAuthenticationValidate(options.session, options.realmId, options.userId, now)
  if (!recent.success) return recent
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  return storageTransactionRun(options.database, (transaction) => {
    const user = userRepositoryCreate(transaction).userGet(options.realmId, options.userId)
    if (!user.success) return user
    if (user.data === null || user.data.state !== "active" || user.data.deletedAt !== null)
      return resultErrorCreate(op, "The authenticated user is not available.", "users.not-found")
    const repository = userEmailRepositoryCreate(transaction)
    const current = repository.userEmailGet(options.realmId, options.userId, options.emailId)
    if (!current.success) return current
    if (current.data === null) return resultErrorCreate(op, "The email address was not found.", "users.not-found")
    const expectedVersion = options.expectedVersion ?? current.data.version
    const challenges = userEmailChangeRepositoryCreate(transaction)
    const expired = challenges.userEmailChangeChallengeExpireForEmail(
      options.realmId,
      options.userId,
      current.data.email,
      now,
      "email_address",
    )
    if (!expired.success) return expired
    const removed = repository.userEmailDelete(options.realmId, options.userId, options.emailId, expectedVersion)
    if (!removed.success) return removed
    if (removed.data === null) return resultErrorCreate(op, "The email address changed concurrently.", "users.conflict")
    const payload = v.safeParse(userEmailAddressRemovedEventPayloadSchema, { removed: true })
    if (!payload.success)
      return resultErrorCreate(op, "The removed email address event payload is invalid.", "users.event-invalid")
    const event = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: removed.data.id,
        aggregateType: "user_email_address",
        aggregateVersion: removed.data.version + 1,
        commandIndex: 0,
        correlationId,
        eventType: userEventTypes.emailAddressRemoved,
        realmId: options.realmId,
        metadata: { auditSafe: true, source: "users" },
        occurredAt: now,
        payload: payload.output,
      },
      runtime,
    )
    if (!event.success) return event
    return resultCreate({ removed: true })
  })
}
