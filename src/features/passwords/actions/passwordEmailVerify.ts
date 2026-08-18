import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { realmGet } from "../../realms/actions/realmGet.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { userPublicViewCreate } from "../../users/domain/userPublicViewCreate.js"
import { userStateChangedEventPayloadSchema } from "../../users/events/userStateChangedEventPayloadSchema.js"
import { userEmailVerificationChangedEventPayloadSchema } from "../../users/events/userEmailVerificationChangedEventPayloadSchema.js"
import { userEventTypes } from "../../users/events/userEventTypes.js"
import { userRepositoryCreate } from "../../users/persistence/userRepositoryCreate.js"
import { passwordTokenHashCreate } from "../domain/passwordTokenHashCreate.js"
import { passwordEmailVerifiedEventPayloadSchema } from "../events/passwordEmailVerifiedEventPayloadSchema.js"
import { passwordEventTypes } from "../events/passwordEventTypes.js"
import { passwordRepositoryCreate } from "../persistence/passwordRepositoryCreate.js"
import {
  type PasswordEmailVerificationRequest,
  passwordEmailVerificationRequestSchema,
} from "../public/passwordEmailVerificationRequestSchema.js"
import type { PasswordEmailVerificationResponse } from "../public/passwordEmailVerificationResponseSchema.js"

type PasswordEmailVerifyOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly input: PasswordEmailVerificationRequest
  readonly realmId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function passwordEmailVerify(options: PasswordEmailVerifyOptions): Result<PasswordEmailVerificationResponse> {
  const op = "passwordEmailVerify"
  if (options.context === undefined || options.context === null)
    return resultErrorCreate(op, "A tenant context is required.", "passwords.tenant-required")
  if (options.context.kind === "tenant" && options.context.realmId !== options.realmId)
    return resultErrorCreate(
      op,
      "The verification is not available in this tenant context.",
      "passwords.tenant-mismatch",
    )
  const parsed = v.safeParse(passwordEmailVerificationRequestSchema, options.input)
  if (!parsed.success) return resultErrorCreate(op, "The verification token is invalid.", "passwords.invalid")
  const realm = realmGet({ context: options.context, database: options.database, realmId: options.realmId })
  if (!realm.success) return resultErrorCreate(op, "The verification token is invalid.", "passwords.invalid")
  if (realm.data.realm.status !== "active")
    return resultErrorCreate(op, "The verification token is invalid.", "passwords.invalid")
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0)
    return resultErrorCreate(op, "The verification timestamp is invalid.", "passwords.invalid-timestamp")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  return storageTransactionRun(options.database, (transaction) => {
    const repository = passwordRepositoryCreate(transaction)
    const challenge = repository.passwordChallengeGet(
      options.realmId,
      passwordTokenHashCreate(parsed.output.token),
      "verification",
    )
    if (!challenge.success || challenge.data === null)
      return resultErrorCreate(op, "The verification token is invalid.", "passwords.invalid")
    if (challenge.data.consumedAt !== null || challenge.data.expiresAt <= now)
      return resultErrorCreate(op, "The verification token is invalid.", "passwords.invalid")
    const user = userRepositoryCreate(transaction).userGet(options.realmId, challenge.data.userId)
    if (!user.success || user.data === null || user.data.state === "deleted" || user.data.emailVerifiedAt !== null)
      return resultErrorCreate(op, "The verification token is invalid.", "passwords.invalid")
    const consumed = repository.passwordChallengeConsume(challenge.data.id, now)
    if (!consumed.success || consumed.data === null)
      return resultErrorCreate(op, "The verification token is invalid.", "passwords.invalid")
    const nextState = user.data.state === "initial" ? "active" : user.data.state
    const updated = userRepositoryCreate(transaction).userUpdate(options.realmId, user.data.id, {
      emailVerifiedAt: now,
      state: nextState,
      updatedAt: now,
      version: user.data.version + (nextState === user.data.state ? 1 : 2),
    })
    if (!updated.success || updated.data === null)
      return resultErrorCreate(op, "The verification token is invalid.", "passwords.invalid")
    const verificationPayload = v.safeParse(userEmailVerificationChangedEventPayloadSchema, { state: "verified" })
    if (!verificationPayload.success)
      return resultErrorCreate(op, "The verification event payload is invalid.", "passwords.event-invalid")
    const verificationEvent = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: user.data.id,
        aggregateType: "user",
        aggregateVersion: user.data.version + 1,
        commandIndex: 0,
        correlationId,
        eventType: userEventTypes.emailVerificationChanged,
        realmId: options.realmId,
        metadata: { auditSafe: true, source: "passwords" },
        occurredAt: now,
        payload: verificationPayload.output,
      },
      runtime,
    )
    if (!verificationEvent.success) return verificationEvent
    if (nextState !== user.data.state) {
      const statePayload = v.safeParse(userStateChangedEventPayloadSchema, { from: user.data.state, to: nextState })
      if (!statePayload.success)
        return resultErrorCreate(op, "The verification state event payload is invalid.", "passwords.event-invalid")
      const stateEvent = storageEventAppend(
        transaction,
        {
          actorId: options.context.actorId,
          aggregateId: user.data.id,
          aggregateType: "user",
          aggregateVersion: user.data.version + 2,
          commandIndex: 1,
          correlationId,
          eventType: userEventTypes.stateChanged,
          realmId: options.realmId,
          metadata: { auditSafe: true, source: "passwords" },
          occurredAt: now,
          payload: statePayload.output,
        },
        runtime,
      )
      if (!stateEvent.success) return stateEvent
    }
    const eventVersion = repository.passwordEventVersionGet(options.realmId, user.data.id)
    if (!eventVersion.success)
      return resultErrorCreate(op, "The verification event version is invalid.", "passwords.invalid")
    const payload = v.safeParse(passwordEmailVerifiedEventPayloadSchema, { verified: true })
    if (!payload.success)
      return resultErrorCreate(op, "The verification event payload is invalid.", "passwords.event-invalid")
    const event = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: user.data.id,
        aggregateType: "password",
        aggregateVersion: eventVersion.data + 1,
        commandIndex: nextState === user.data.state ? 1 : 2,
        correlationId,
        eventType: passwordEventTypes.emailVerified,
        realmId: options.realmId,
        metadata: { auditSafe: true, source: "passwords" },
        occurredAt: now,
        payload: payload.output,
      },
      runtime,
    )
    if (!event.success) return event
    return resultCreate({ user: userPublicViewCreate(updated.data) })
  })
}
