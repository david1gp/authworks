import { and, eq } from "drizzle-orm"
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
import { userEventTypes } from "../../users/events/userEventTypes.js"
import { userStateChangedEventPayloadSchema } from "../../users/events/userStateChangedEventPayloadSchema.js"
import { userEmailRepositoryCreate } from "../../users/persistence/userEmailRepositoryCreate.js"
import { userTable } from "../../users/persistence/userTable.js"
import { passwordHashCreate } from "../domain/passwordHashCreate.js"
import { passwordPolicyCheck } from "../domain/passwordPolicyCheck.js"
import { passwordPolicyDefaults } from "../domain/passwordPolicyDefaults.js"
import { passwordPolicyViewCreate } from "../domain/passwordPolicyViewCreate.js"
import { passwordTokenHashCreate } from "../domain/passwordTokenHashCreate.js"
import { passwordCredentialChangedEventPayloadSchema } from "../events/passwordCredentialChangedEventPayloadSchema.js"
import { passwordEventTypes } from "../events/passwordEventTypes.js"
import { passwordRecoveryEventPayloadSchema } from "../events/passwordRecoveryEventPayloadSchema.js"
import { passwordRepositoryCreate } from "../persistence/passwordRepositoryCreate.js"
import {
  type PasswordRecoveryCompleteRequest,
  passwordRecoveryCompleteRequestSchema,
} from "../public/passwordRecoveryCompleteRequestSchema.js"
import type { PasswordRecoveryCompleteResponse } from "../public/passwordRecoveryCompleteResponseSchema.js"

type PasswordRecoveryCompleteOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly input: PasswordRecoveryCompleteRequest
  readonly realmId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function passwordRecoveryComplete(
  options: PasswordRecoveryCompleteOptions,
): Result<PasswordRecoveryCompleteResponse> {
  const op = "passwordRecoveryComplete"
  if (options.context === undefined || options.context === null)
    return resultErrorCreate(op, "A tenant context is required.", "passwords.tenant-required")
  if (options.context.kind === "tenant" && options.context.realmId !== options.realmId)
    return resultErrorCreate(op, "The recovery is not available in this tenant context.", "passwords.tenant-mismatch")
  const parsed = v.safeParse(passwordRecoveryCompleteRequestSchema, options.input)
  if (!parsed.success) return resultErrorCreate(op, "The recovery token is invalid.", "passwords.invalid")
  const realm = realmGet({ context: options.context, database: options.database, realmId: options.realmId })
  if (!realm.success || realm.data.realm.status !== "active")
    return resultErrorCreate(op, "The recovery token is invalid.", "passwords.invalid")
  const repository = passwordRepositoryCreate(options.database.db)
  const policyRow = repository.passwordPolicyGet(options.realmId)
  if (!policyRow.success) return resultErrorCreate(op, "The recovery token is invalid.", "passwords.invalid")
  const policy = policyRow.data === null ? passwordPolicyDefaults : passwordPolicyViewCreate(policyRow.data)
  const policyCheck = passwordPolicyCheck(parsed.output.newPassword, policy)
  if (!policyCheck.success) return policyCheck
  const hash = passwordHashCreate(parsed.output.newPassword, options.runtime ?? options.database.runtime)
  if (!hash.success) return hash
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0)
    return resultErrorCreate(op, "The recovery timestamp is invalid.", "passwords.invalid-timestamp")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)

  return storageTransactionRun(options.database, (transaction) => {
    const txRepository = passwordRepositoryCreate(transaction)
    const challenge = txRepository.passwordChallengeGet(
      options.realmId,
      passwordTokenHashCreate(parsed.output.token),
      "recovery",
    )
    if (
      !challenge.success ||
      challenge.data === null ||
      challenge.data.consumedAt !== null ||
      challenge.data.expiresAt <= now
    )
      return resultErrorCreate(op, "The recovery token is invalid.", "passwords.invalid")
    const user = txRepository.passwordUserGet(options.realmId, challenge.data.userId)
    if (!user.success || user.data === null || user.data.state === "deleted")
      return resultErrorCreate(op, "The recovery token is invalid.", "passwords.invalid")
    const emails = userEmailRepositoryCreate(transaction).userEmailList(options.realmId, user.data.id)
    if (!emails.success || !emails.data.some((email) => email.verifiedAt !== null))
      return resultErrorCreate(op, "The recovery token is invalid.", "passwords.invalid")
    const credential = txRepository.passwordCredentialGet(options.realmId, user.data.id)
    if (!credential.success || credential.data === null)
      return resultErrorCreate(op, "The recovery token is invalid.", "passwords.invalid")
    const consumed = txRepository.passwordChallengeConsume(challenge.data.id, now)
    if (!consumed.success || consumed.data === null)
      return resultErrorCreate(op, "The recovery token is invalid.", "passwords.write-failed")
    const updatedCredential = txRepository.passwordCredentialUpdate(options.realmId, user.data.id, {
      changedAt: now,
      hash: hash.data,
      version: credential.data.version + 1,
    })
    if (!updatedCredential.success || updatedCredential.data === null)
      return resultErrorCreate(op, "The recovery token is invalid.", "passwords.write-failed")
    const previousLockout = txRepository.passwordLockoutGet(options.realmId, user.data.id)
    if (!previousLockout.success)
      return resultErrorCreate(op, "The recovery token is invalid.", "passwords.read-failed")
    const lockout = txRepository.passwordLockoutSet({
      failedAttempts: 0,
      realmId: options.realmId,
      lockedUntil: null,
      updatedAt: now,
      userId: user.data.id,
      version: (previousLockout.data?.version ?? 0) + 1,
    })
    if (!lockout.success) return lockout
    let userVersion = user.data.version
    if (user.data.state === "locked") {
      const unlocked = transaction
        .update(userTable)
        .set({ state: "active", updatedAt: now, version: user.data.version + 1 })
        .where(and(eq(userTable.id, user.data.id), eq(userTable.realmId, options.realmId)))
        .returning()
        .get()
      if (unlocked === undefined)
        return resultErrorCreate(op, "The recovery token is invalid.", "passwords.write-failed")
      userVersion = unlocked.version
      const statePayload = v.safeParse(userStateChangedEventPayloadSchema, { from: "locked", to: "active" })
      if (!statePayload.success)
        return resultErrorCreate(op, "The recovery unlock event payload is invalid.", "passwords.event-invalid")
      const stateEvent = storageEventAppend(
        transaction,
        {
          actorId: options.context.actorId,
          aggregateId: user.data.id,
          aggregateType: "user",
          aggregateVersion: userVersion,
          commandIndex: 0,
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
    const eventVersion = txRepository.passwordEventVersionGet(options.realmId, user.data.id)
    if (!eventVersion.success)
      return resultErrorCreate(op, "The recovery event version is invalid.", "passwords.invalid")
    const changedPayload = v.safeParse(passwordCredentialChangedEventPayloadSchema, { reason: "recovery" })
    if (!changedPayload.success)
      return resultErrorCreate(op, "The password event payload is invalid.", "passwords.event-invalid")
    const changedEvent = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: user.data.id,
        aggregateType: "password",
        aggregateVersion: eventVersion.data + 1,
        commandIndex: userVersion === user.data.version ? 0 : 1,
        correlationId,
        eventType: passwordEventTypes.credentialChanged,
        realmId: options.realmId,
        metadata: { auditSafe: true, source: "passwords" },
        occurredAt: now,
        payload: changedPayload.output,
      },
      runtime,
    )
    if (!changedEvent.success) return changedEvent
    const recoveredPayload = v.safeParse(passwordRecoveryEventPayloadSchema, { accepted: true })
    if (!recoveredPayload.success)
      return resultErrorCreate(op, "The recovery event payload is invalid.", "passwords.event-invalid")
    const recoveredEvent = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: user.data.id,
        aggregateType: "password",
        aggregateVersion: eventVersion.data + 2,
        commandIndex: userVersion === user.data.version ? 1 : 2,
        correlationId,
        eventType: passwordEventTypes.recovered,
        realmId: options.realmId,
        metadata: { auditSafe: true, source: "passwords" },
        occurredAt: now,
        payload: recoveredPayload.output,
      },
      runtime,
    )
    if (!recoveredEvent.success) return recoveredEvent
    return resultCreate({ changed: true })
  })
}
