import * as v from "valibot"
import { and, eq } from "drizzle-orm"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { instanceGet } from "../../instances/actions/instanceGet.js"
import type { InstanceSystemContext } from "../../instances/domain/instanceSystemContext.js"
import type { InstanceTenantContext } from "../../instances/domain/instanceTenantContext.js"
import { userEventTypes } from "../../users/events/userEventTypes.js"
import { userStateChangedEventPayloadSchema } from "../../users/events/userStateChangedEventPayloadSchema.js"
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
  readonly context: InstanceSystemContext | InstanceTenantContext
  readonly database: StorageDatabase
  readonly input: PasswordRecoveryCompleteRequest
  readonly instanceId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function passwordRecoveryComplete(
  options: PasswordRecoveryCompleteOptions,
): Result<PasswordRecoveryCompleteResponse> {
  const op = "passwordRecoveryComplete"
  if (options.context === undefined || options.context === null)
    return resultErrorCreate(op, "A tenant context is required.")
  if (options.context.kind === "tenant" && options.context.instanceId !== options.instanceId)
    return resultErrorCreate(op, "The recovery is not available in this tenant context.")
  const parsed = v.safeParse(passwordRecoveryCompleteRequestSchema, options.input)
  if (!parsed.success) return resultErrorCreate(op, "The recovery token is invalid.")
  const instance = instanceGet({ context: options.context, database: options.database, instanceId: options.instanceId })
  if (!instance.success || instance.data.instance.status !== "active")
    return resultErrorCreate(op, "The recovery token is invalid.")
  const repository = passwordRepositoryCreate(options.database.db)
  const policyRow = repository.passwordPolicyGet(options.instanceId)
  if (!policyRow.success) return resultErrorCreate(op, "The recovery token is invalid.")
  const policy = policyRow.data === null ? passwordPolicyDefaults : passwordPolicyViewCreate(policyRow.data)
  const policyCheck = passwordPolicyCheck(parsed.output.newPassword, policy)
  if (!policyCheck.success) return policyCheck
  const hash = passwordHashCreate(parsed.output.newPassword, options.runtime ?? options.database.runtime)
  if (!hash.success) return hash
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0) return resultErrorCreate(op, "The recovery timestamp is invalid.")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)

  return storageTransactionRun(options.database, (transaction) => {
    const txRepository = passwordRepositoryCreate(transaction)
    const challenge = txRepository.passwordChallengeGet(
      options.instanceId,
      passwordTokenHashCreate(parsed.output.token),
      "recovery",
    )
    if (
      !challenge.success ||
      challenge.data === null ||
      challenge.data.consumedAt !== null ||
      challenge.data.expiresAt <= now
    )
      return resultErrorCreate(op, "The recovery token is invalid.")
    const user = txRepository.passwordUserGet(options.instanceId, challenge.data.userId)
    if (!user.success || user.data === null || user.data.state === "deleted" || user.data.emailVerifiedAt === null)
      return resultErrorCreate(op, "The recovery token is invalid.")
    const credential = txRepository.passwordCredentialGet(options.instanceId, user.data.id)
    if (!credential.success || credential.data === null) return resultErrorCreate(op, "The recovery token is invalid.")
    const consumed = txRepository.passwordChallengeConsume(challenge.data.id, now)
    if (!consumed.success || consumed.data === null) return resultErrorCreate(op, "The recovery token is invalid.")
    const updatedCredential = txRepository.passwordCredentialUpdate(options.instanceId, user.data.id, {
      changedAt: now,
      hash: hash.data,
      version: credential.data.version + 1,
    })
    if (!updatedCredential.success || updatedCredential.data === null)
      return resultErrorCreate(op, "The recovery token is invalid.")
    const previousLockout = txRepository.passwordLockoutGet(options.instanceId, user.data.id)
    if (!previousLockout.success) return resultErrorCreate(op, "The recovery token is invalid.")
    const lockout = txRepository.passwordLockoutSet({
      failedAttempts: 0,
      instanceId: options.instanceId,
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
        .where(and(eq(userTable.id, user.data.id), eq(userTable.instanceId, options.instanceId)))
        .returning()
        .get()
      if (unlocked === undefined) return resultErrorCreate(op, "The recovery token is invalid.")
      userVersion = unlocked.version
      const statePayload = v.safeParse(userStateChangedEventPayloadSchema, { from: "locked", to: "active" })
      if (!statePayload.success) return resultErrorCreate(op, "The recovery unlock event payload is invalid.")
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
          instanceId: options.instanceId,
          metadata: { auditSafe: true, source: "passwords" },
          occurredAt: now,
          payload: statePayload.output,
        },
        runtime,
      )
      if (!stateEvent.success) return stateEvent
    }
    const eventVersion = txRepository.passwordEventVersionGet(options.instanceId, user.data.id)
    if (!eventVersion.success) return resultErrorCreate(op, "The recovery event version is invalid.")
    const changedPayload = v.safeParse(passwordCredentialChangedEventPayloadSchema, { reason: "recovery" })
    if (!changedPayload.success) return resultErrorCreate(op, "The password event payload is invalid.")
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
        instanceId: options.instanceId,
        metadata: { auditSafe: true, source: "passwords" },
        occurredAt: now,
        payload: changedPayload.output,
      },
      runtime,
    )
    if (!changedEvent.success) return changedEvent
    const recoveredPayload = v.safeParse(passwordRecoveryEventPayloadSchema, { accepted: true })
    if (!recoveredPayload.success) return resultErrorCreate(op, "The recovery event payload is invalid.")
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
        instanceId: options.instanceId,
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
