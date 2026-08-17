import * as v from "valibot"
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
import { passwordHashCreate } from "../domain/passwordHashCreate.js"
import { passwordHashVerify } from "../domain/passwordHashVerify.js"
import { passwordPolicyCheck } from "../domain/passwordPolicyCheck.js"
import { passwordPolicyDefaults } from "../domain/passwordPolicyDefaults.js"
import { passwordPolicyViewCreate } from "../domain/passwordPolicyViewCreate.js"
import { passwordCredentialChangedEventPayloadSchema } from "../events/passwordCredentialChangedEventPayloadSchema.js"
import { passwordEventTypes } from "../events/passwordEventTypes.js"
import { passwordRepositoryCreate } from "../persistence/passwordRepositoryCreate.js"
import { type PasswordChangeRequest, passwordChangeRequestSchema } from "../public/passwordChangeRequestSchema.js"
import type { PasswordChangeResponse } from "../public/passwordChangeResponseSchema.js"

type PasswordChangeOptions = {
  readonly context: InstanceSystemContext | InstanceTenantContext
  readonly database: StorageDatabase
  readonly input: PasswordChangeRequest
  readonly instanceId: string
  readonly userId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function passwordChange(options: PasswordChangeOptions): Result<PasswordChangeResponse> {
  const op = "passwordChange"
  if (options.context === undefined || options.context === null)
    return resultErrorCreate(op, "A tenant context is required.")
  if (options.context.kind === "tenant" && options.context.instanceId !== options.instanceId)
    return resultErrorCreate(op, "The password is not available in this tenant context.")
  const parsed = v.safeParse(passwordChangeRequestSchema, options.input)
  if (!parsed.success) return resultErrorCreate(op, "The password change request is invalid.")
  const instance = instanceGet({ context: options.context, database: options.database, instanceId: options.instanceId })
  if (!instance.success) return resultErrorCreate(op, "The current password is invalid.")
  if (instance.data.instance.status !== "active") return resultErrorCreate(op, "The current password is invalid.")
  const repository = passwordRepositoryCreate(options.database.db)
  const credential = repository.passwordCredentialGet(options.instanceId, options.userId)
  if (!credential.success || credential.data === null) return resultErrorCreate(op, "The current password is invalid.")
  const current = passwordHashVerify(parsed.output.currentPassword, credential.data.hash)
  if (!current.success || !current.data) return resultErrorCreate(op, "The current password is invalid.")
  const policyRow = repository.passwordPolicyGet(options.instanceId)
  if (!policyRow.success) return resultErrorCreate(op, "The password change could not be completed.")
  const policy = policyRow.data === null ? passwordPolicyDefaults : passwordPolicyViewCreate(policyRow.data)
  const checked = passwordPolicyCheck(parsed.output.newPassword, policy)
  if (!checked.success) return checked
  const hash = passwordHashCreate(parsed.output.newPassword, options.runtime ?? options.database.runtime)
  if (!hash.success) return hash
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0) return resultErrorCreate(op, "The password timestamp is invalid.")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)

  return storageTransactionRun(options.database, (transaction) => {
    const txRepository = passwordRepositoryCreate(transaction)
    const user = txRepository.passwordUserGet(options.instanceId, options.userId)
    if (!user.success || user.data === null || user.data.state === "deleted" || user.data.state === "locked")
      return resultErrorCreate(op, "The current password is invalid.")
    const existing = txRepository.passwordCredentialGet(options.instanceId, options.userId)
    if (!existing.success || existing.data === null) return resultErrorCreate(op, "The current password is invalid.")
    const currentCheck = passwordHashVerify(parsed.output.currentPassword, existing.data.hash)
    if (!currentCheck.success || !currentCheck.data) return resultErrorCreate(op, "The current password is invalid.")
    const updated = txRepository.passwordCredentialUpdate(options.instanceId, options.userId, {
      changedAt: now,
      hash: hash.data,
      version: existing.data.version + 1,
    })
    if (!updated.success || updated.data === null)
      return resultErrorCreate(op, "The password change could not be completed.")
    const lockout = txRepository.passwordLockoutGet(options.instanceId, options.userId)
    if (!lockout.success) return resultErrorCreate(op, "The password change could not be completed.")
    const reset = txRepository.passwordLockoutSet({
      failedAttempts: 0,
      instanceId: options.instanceId,
      lockedUntil: null,
      updatedAt: now,
      userId: options.userId,
      version: (lockout.data?.version ?? 0) + 1,
    })
    if (!reset.success) return reset
    const eventVersion = txRepository.passwordEventVersionGet(options.instanceId, options.userId)
    if (!eventVersion.success) return resultErrorCreate(op, "The password change event version is invalid.")
    const payload = v.safeParse(passwordCredentialChangedEventPayloadSchema, { reason: "change" })
    if (!payload.success) return resultErrorCreate(op, "The password event payload is invalid.")
    const event = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: options.userId,
        aggregateType: "password",
        aggregateVersion: eventVersion.data + 1,
        commandIndex: 0,
        correlationId,
        eventType: passwordEventTypes.credentialChanged,
        instanceId: options.instanceId,
        metadata: { auditSafe: true, source: "passwords" },
        occurredAt: now,
        payload: payload.output,
      },
      runtime,
    )
    if (!event.success) return event
    return resultCreate({ changed: true })
  })
}
