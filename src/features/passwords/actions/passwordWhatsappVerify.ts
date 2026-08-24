import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { Secret } from "../../../platform/secrets/Secret.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { realmGet } from "../../realms/actions/realmGet.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { userPublicViewCreate } from "../../users/domain/userPublicViewCreate.js"
import { userEventTypes } from "../../users/events/userEventTypes.js"
import { userRegistrationVerificationChangedEventPayloadSchema } from "../../users/events/userRegistrationVerificationChangedEventPayloadSchema.js"
import { userStateChangedEventPayloadSchema } from "../../users/events/userStateChangedEventPayloadSchema.js"
import { userRepositoryCreate } from "../../users/persistence/userRepositoryCreate.js"
import { passwordRegistrationCodeMatches } from "../domain/passwordRegistrationCodeMatches.js"
import { passwordEventTypes } from "../events/passwordEventTypes.js"
import { passwordWhatsappVerifiedEventPayloadSchema } from "../events/passwordWhatsappVerifiedEventPayloadSchema.js"
import { passwordRepositoryCreate } from "../persistence/passwordRepositoryCreate.js"
import {
  type PasswordWhatsappVerificationRequest,
  passwordWhatsappVerificationRequestSchema,
} from "../public/passwordWhatsappVerificationRequestSchema.js"
import type { PasswordWhatsappVerificationResponse } from "../public/passwordWhatsappVerificationResponseSchema.js"
import { passwordRegistrationRateLimitConsume } from "./passwordRegistrationRateLimitConsume.js"

type PasswordWhatsappVerifyOptions = {
  readonly clientIp?: string
  readonly context: RealmSystemContext | RealmTenantContext
  readonly correlationId?: string
  readonly database: StorageDatabase
  readonly input: PasswordWhatsappVerificationRequest
  readonly rateLimitSecret?: Secret | string
  readonly realmId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
}

type PasswordWhatsappVerifyCommit =
  | { readonly failure: true; readonly rateLimited?: false }
  | { readonly failure: false; readonly response: PasswordWhatsappVerificationResponse }
  | { readonly failure: true; readonly rateLimited: true; readonly retryAt: number }

export function passwordWhatsappVerify(
  options: PasswordWhatsappVerifyOptions,
): Result<PasswordWhatsappVerificationResponse> {
  const op = "passwordWhatsappVerify"
  if (options.context === undefined || options.context === null)
    return resultErrorCreate(op, "A tenant context is required.", "passwords.tenant-required")
  if (options.context.kind === "tenant" && options.context.realmId !== options.realmId)
    return resultErrorCreate(
      op,
      "The verification is not available in this tenant context.",
      "passwords.tenant-mismatch",
    )
  const parsed = v.safeParse(passwordWhatsappVerificationRequestSchema, options.input)
  if (!parsed.success) return resultErrorCreate(op, "The WhatsApp verification code is invalid.", "passwords.invalid")
  const realm = realmGet({ context: options.context, database: options.database, realmId: options.realmId })
  if (!realm.success || realm.data.realm.status !== "active")
    return resultErrorCreate(op, "The WhatsApp verification code is invalid.", "passwords.invalid")
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0)
    return resultErrorCreate(op, "The verification timestamp is invalid.", "passwords.invalid-timestamp")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  const committed = storageTransactionRun(options.database, (transaction) =>
    passwordWhatsappVerifyTransaction({
      clientIp: options.clientIp ?? "unknown",
      context: options.context,
      correlationId,
      database: transaction,
      input: parsed.output,
      now,
      rateLimitSecret: options.rateLimitSecret,
      realmId: options.realmId,
      runtime,
    }),
  )
  if (!committed.success) return committed
  if ("retryAt" in committed.data)
    return resultErrorCreate(op, "Too many verification requests.", "passwords.rate-limited", {
      retryAfterSeconds: Math.max(1, Math.ceil((committed.data.retryAt - now) / 1_000)),
    })
  if (committed.data.failure)
    return resultErrorCreate(op, "The WhatsApp verification code is invalid.", "passwords.invalid")
  return resultCreate(committed.data.response)
}

type PasswordWhatsappVerifyTransactionOptions = {
  readonly clientIp: string
  readonly context: RealmSystemContext | RealmTenantContext
  readonly correlationId: string
  readonly database: StorageExecutor
  readonly input: PasswordWhatsappVerificationRequest
  readonly now: number
  readonly rateLimitSecret?: Secret | string
  readonly realmId: string
  readonly runtime: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
}

function passwordWhatsappVerifyTransaction(
  options: PasswordWhatsappVerifyTransactionOptions,
): Result<PasswordWhatsappVerifyCommit> {
  const limited = passwordRegistrationRateLimitConsume(options.database, {
    clientIp: options.clientIp,
    delivery: false,
    identifier: options.input.challengeId,
    now: options.now,
    rateLimitSecret: options.rateLimitSecret,
    realmId: options.realmId,
    verify: true,
  })
  if (!limited.success) return limited
  if (!limited.data.allowed) return resultCreate({ failure: true, rateLimited: true, retryAt: limited.data.retryAt })

  const repository = passwordRepositoryCreate(options.database)
  const challenge = repository.passwordRegistrationChallengeGet(options.realmId, options.input.challengeId)
  if (!challenge.success) return challenge
  if (challenge.data === null || challenge.data.purpose !== "registration") return resultCreate({ failure: true })
  const current = challenge.data
  if (current.consumedAt !== null || current.attempts >= current.maxAttempts) return resultCreate({ failure: true })
  if (current.expiresAt <= options.now) {
    const consumed = repository.passwordRegistrationChallengeConsume(
      options.realmId,
      current.id,
      current.version,
      options.now,
    )
    if (!consumed.success) return consumed
    if (consumed.data === null) return resultCreate({ failure: true })
    return resultCreate({ failure: true })
  }

  const matched = passwordRegistrationCodeMatches(current.id, options.input.code, current.codeHash)
  if (!matched) {
    const attempts = current.attempts + 1
    const updated = repository.passwordRegistrationChallengeAttemptRecord({
      attempts,
      consumedAt: attempts >= current.maxAttempts ? options.now : null,
      expectedVersion: current.version,
      id: current.id,
      realmId: options.realmId,
      version: current.version + 1,
    })
    if (!updated.success) return updated
    if (updated.data === null) return resultCreate({ failure: true })
    return resultCreate({ failure: true })
  }

  if (current.userId === null) return resultCreate({ failure: true })
  const user = userRepositoryCreate(options.database).userGet(options.realmId, current.userId)
  if (!user.success) return user
  if (user.data === null || user.data.state === "deleted" || user.data.phoneNumber === null)
    return resultCreate({ failure: true })
  const consumed = repository.passwordRegistrationChallengeConsume(
    options.realmId,
    current.id,
    current.version,
    options.now,
  )
  if (!consumed.success) return consumed
  if (consumed.data === null) return resultCreate({ failure: true })
  const stateChanged = user.data.state !== "active"
  const updated = userRepositoryCreate(options.database).userUpdate(options.realmId, user.data.id, {
    phoneNumberVerifiedAt: options.now,
    registrationVerifiedAt: options.now,
    registrationVerificationMethod: "whatsapp",
    state: stateChanged ? "active" : user.data.state,
    updatedAt: options.now,
    version: user.data.version + 1 + (stateChanged ? 1 : 0),
  })
  if (!updated.success) return updated
  if (updated.data === null) return resultCreate({ failure: true })

  const registrationPayload = v.safeParse(userRegistrationVerificationChangedEventPayloadSchema, {
    registrationVerificationMethod: "whatsapp",
    state: "verified",
  })
  if (!registrationPayload.success)
    return resultErrorCreate(
      "passwordWhatsappVerify",
      "The verification event payload is invalid.",
      "passwords.event-invalid",
    )
  const registrationEvent = storageEventAppend(
    options.database,
    {
      actorId: options.context.actorId,
      aggregateId: user.data.id,
      aggregateType: "user",
      aggregateVersion: user.data.version + 1,
      commandIndex: 0,
      correlationId: options.correlationId,
      eventType: userEventTypes.registrationVerificationChanged,
      realmId: options.realmId,
      metadata: { auditSafe: true, source: "passwords" },
      occurredAt: options.now,
      payload: registrationPayload.output,
    },
    options.runtime,
  )
  if (!registrationEvent.success) return registrationEvent
  if (stateChanged) {
    const statePayload = v.safeParse(userStateChangedEventPayloadSchema, { from: user.data.state, to: "active" })
    if (!statePayload.success)
      return resultErrorCreate(
        "passwordWhatsappVerify",
        "The verification event payload is invalid.",
        "passwords.event-invalid",
      )
    const stateEvent = storageEventAppend(
      options.database,
      {
        actorId: options.context.actorId,
        aggregateId: user.data.id,
        aggregateType: "user",
        aggregateVersion: updated.data.version,
        commandIndex: 1,
        correlationId: options.correlationId,
        eventType: userEventTypes.stateChanged,
        realmId: options.realmId,
        metadata: { auditSafe: true, source: "passwords" },
        occurredAt: options.now,
        payload: statePayload.output,
      },
      options.runtime,
    )
    if (!stateEvent.success) return stateEvent
  }
  const passwordPayload = v.safeParse(passwordWhatsappVerifiedEventPayloadSchema, { verified: true })
  if (!passwordPayload.success)
    return resultErrorCreate(
      "passwordWhatsappVerify",
      "The verification event payload is invalid.",
      "passwords.event-invalid",
    )
  const eventVersion = repository.passwordEventVersionGet(options.realmId, user.data.id)
  if (!eventVersion.success) return eventVersion
  const passwordEvent = storageEventAppend(
    options.database,
    {
      actorId: options.context.actorId,
      aggregateId: user.data.id,
      aggregateType: "password",
      aggregateVersion: eventVersion.data + 1,
      commandIndex: stateChanged ? 2 : 1,
      correlationId: options.correlationId,
      eventType: passwordEventTypes.whatsappVerified,
      realmId: options.realmId,
      metadata: { auditSafe: true, source: "passwords" },
      occurredAt: options.now,
      payload: passwordPayload.output,
    },
    options.runtime,
  )
  if (!passwordEvent.success) return passwordEvent
  return resultCreate({ failure: false, response: { user: userPublicViewCreate(updated.data) } })
}
