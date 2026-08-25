import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { userPublicViewCreate } from "../domain/userPublicViewCreate.js"
import { userEmailVerificationChangedEventPayloadSchema } from "../events/userEmailVerificationChangedEventPayloadSchema.js"
import { userEventTypes } from "../events/userEventTypes.js"
import { userRegistrationVerificationChangedEventPayloadSchema } from "../events/userRegistrationVerificationChangedEventPayloadSchema.js"
import { userRepositoryCreate } from "../persistence/userRepositoryCreate.js"
import type { User } from "../public/userSchema.js"
import { type UserVerificationRequest, userVerificationRequestSchema } from "../public/userVerificationRequestSchema.js"

type UserEmailVerificationSetOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly input: UserVerificationRequest
  readonly realmId: string
  readonly userId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function userEmailVerificationSet(options: UserEmailVerificationSetOptions): Result<{ user: User }> {
  const op = "userEmailVerificationSet"
  if (options.context === undefined || options.context === null)
    return resultErrorCreate(op, "A tenant context is required.", "users.tenant-required")
  if (options.context.kind === "tenant" && options.context.realmId !== options.realmId)
    return resultErrorCreate(op, "The user is not available in this tenant context.", "users.tenant-mismatch")
  const parsed = v.safeParse(userVerificationRequestSchema, options.input)
  if (!parsed.success) return resultErrorCreate(op, "The user verification request is invalid.", "users.invalid")
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
    const currentlyVerified = current.data.emailVerifiedAt !== null
    const requestedVerified = parsed.output.state === "verified"
    const registrationVerificationMissing =
      requestedVerified &&
      current.data.registrationVerifiedAt === null &&
      current.data.registrationVerificationMethod === null
    const registrationVerificationRepair =
      options.context.kind === "system" && currentlyVerified && registrationVerificationMissing
    if (currentlyVerified === requestedVerified && !registrationVerificationRepair)
      return resultErrorCreate(op, "The user already has that verification state.", "users.conflict")
    const registrationVerificationNewlySet = registrationVerificationMissing
    const registrationVerificationRevoked =
      !requestedVerified &&
      current.data.registrationVerifiedAt !== null &&
      current.data.registrationVerificationMethod === "email"
    const emailVerificationChanged = currentlyVerified !== requestedVerified
    const registrationVerificationChanged = registrationVerificationNewlySet || registrationVerificationRevoked
    const updated = repository.userUpdate(options.realmId, options.userId, {
      emailVerifiedAt: requestedVerified ? (currentlyVerified ? current.data.emailVerifiedAt : updatedAt) : null,
      registrationVerifiedAt: requestedVerified
        ? registrationVerificationNewlySet
          ? updatedAt
          : current.data.registrationVerifiedAt
        : registrationVerificationRevoked
          ? null
          : current.data.registrationVerifiedAt,
      registrationVerificationMethod: requestedVerified
        ? registrationVerificationNewlySet
          ? "email"
          : current.data.registrationVerificationMethod
        : registrationVerificationRevoked
          ? null
          : current.data.registrationVerificationMethod,
      updatedAt,
      version: current.data.version + 1 + (emailVerificationChanged && registrationVerificationChanged ? 1 : 0),
    })
    if (!updated.success) return updated
    if (updated.data === null) return resultErrorCreate(op, "The user was not found.", "users.not-found")
    if (emailVerificationChanged) {
      const payload = v.safeParse(userEmailVerificationChangedEventPayloadSchema, { state: parsed.output.state })
      if (!payload.success)
        return resultErrorCreate(op, "The user verification event payload is invalid.", "users.event-invalid")
      const event = storageEventAppend(
        transaction,
        {
          actorId: options.context.actorId,
          aggregateId: options.userId,
          aggregateType: "user",
          aggregateVersion: updated.data.version - (registrationVerificationChanged ? 1 : 0),
          commandIndex: 0,
          correlationId,
          eventType: userEventTypes.emailVerificationChanged,
          realmId: options.realmId,
          metadata: { auditSafe: true, source: "users" },
          occurredAt: updatedAt,
          payload: payload.output,
        },
        runtime,
      )
      if (!event.success) return event
    }
    if (registrationVerificationChanged) {
      const registrationPayload = v.safeParse(userRegistrationVerificationChangedEventPayloadSchema, {
        registrationVerificationMethod: updated.data.registrationVerificationMethod,
        state: registrationVerificationRevoked ? "unverified" : "verified",
      })
      if (!registrationPayload.success)
        return resultErrorCreate(op, "The registration verification event payload is invalid.", "users.event-invalid")
      const registrationEvent = storageEventAppend(
        transaction,
        {
          actorId: options.context.actorId,
          aggregateId: options.userId,
          aggregateType: "user",
          aggregateVersion: updated.data.version,
          commandIndex: emailVerificationChanged ? 1 : 0,
          correlationId,
          eventType: userEventTypes.registrationVerificationChanged,
          realmId: options.realmId,
          metadata: { auditSafe: true, source: "users" },
          occurredAt: updatedAt,
          payload: registrationPayload.output,
        },
        runtime,
      )
      if (!registrationEvent.success) return registrationEvent
    }
    return resultCreate({ user: userPublicViewCreate(updated.data) })
  })
}
