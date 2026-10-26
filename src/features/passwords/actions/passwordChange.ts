import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { eventSecurityEventAppend } from "../../events/server/eventSecurityEventAppend.js"
import { organizationLoginPolicyEnforce } from "../../organizations/actions/organizationLoginPolicyEnforce.js"
import { realmGet } from "../../realms/actions/realmGet.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { passwordHashCreate } from "../domain/passwordHashCreate.js"
import { passwordHashVerify } from "../domain/passwordHashVerify.js"
import { passwordPolicyCheck } from "../domain/passwordPolicyCheck.js"
import { passwordPolicyResolve } from "../domain/passwordPolicyResolve.js"
import { passwordCredentialChangedEventPayloadSchema } from "../events/passwordCredentialChangedEventPayloadSchema.js"
import { passwordEventTypes } from "../events/passwordEventTypes.js"
import { passwordRepositoryCreate } from "../persistence/passwordRepositoryCreate.js"
import type { PasswordChangeResponse } from "../public/passwordChangeResponseSchema.js"

const passwordChangeInputSchema = v.strictObject({
  currentPassword: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(1024))),
  newPassword: v.pipe(v.string(), v.minLength(1), v.maxLength(1024)),
})

type PasswordChangeOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly input: { readonly currentPassword?: string; readonly newPassword: string } & Record<string, unknown>
  readonly realmId: string
  readonly organizationId?: string
  readonly userId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
  readonly allowInitialSet?: boolean
}

export function passwordChange(options: PasswordChangeOptions): Result<PasswordChangeResponse> {
  const op = "passwordChange"
  if (options.context === undefined || options.context === null)
    return resultErrorCreate(op, "A tenant context is required.", "passwords.tenant-required")
  if (options.context.kind === "tenant" && options.context.realmId !== options.realmId)
    return resultErrorCreate(op, "The password is not available in this tenant context.", "passwords.tenant-mismatch")
  const parsed = v.safeParse(passwordChangeInputSchema, options.input)
  if (!parsed.success) return resultErrorCreate(op, "The password change request is invalid.", "passwords.invalid")
  const realm = realmGet({ context: options.context, database: options.database, realmId: options.realmId })
  if (!realm.success) return resultErrorCreate(op, "The current password is invalid.", "passwords.unauthorized")
  if (realm.data.realm.status !== "active")
    return resultErrorCreate(op, "The current password is invalid.", "passwords.unauthorized")
  const loginPolicy = organizationLoginPolicyEnforce({
    database: options.database,
    method: "password",
    organizationId: options.organizationId,
    realmId: options.realmId,
  })
  if (!loginPolicy.success)
    return resultErrorCreate(op, "Password changes are disabled for this organization.", "passwords.forbidden")
  const repository = passwordRepositoryCreate(options.database.db)
  const credential = repository.passwordCredentialGet(options.realmId, options.userId)
  if (!credential.success)
    return resultErrorCreate(op, "The password change could not be completed.", "passwords.write-failed")
  if (credential.data === null) {
    if (options.allowInitialSet !== true)
      return resultErrorCreate(op, "The current password is invalid.", "passwords.unauthorized")
  } else {
    if (parsed.output.currentPassword === undefined)
      return resultErrorCreate(op, "The current password is invalid.", "passwords.unauthorized")
    const current = passwordHashVerify(parsed.output.currentPassword, credential.data.hash)
    if (!current.success || !current.data)
      return resultErrorCreate(op, "The current password is invalid.", "passwords.unauthorized")
  }
  const resolved = passwordPolicyResolve({ executor: options.database.db, realmId: options.realmId })
  if (!resolved.success)
    return resultErrorCreate(op, "The password change could not be completed.", "passwords.write-failed")
  const checked = passwordPolicyCheck(parsed.output.newPassword, resolved.data)
  if (!checked.success) return checked
  const hash = passwordHashCreate(parsed.output.newPassword, options.runtime ?? options.database.runtime)
  if (!hash.success) return hash
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0)
    return resultErrorCreate(op, "The password timestamp is invalid.", "passwords.invalid-timestamp")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  const currentPassword = parsed.output.currentPassword

  return storageTransactionRun(options.database, (transaction) => {
    const txRepository = passwordRepositoryCreate(transaction)
    const user = txRepository.passwordUserGet(options.realmId, options.userId)
    if (!user.success || user.data === null || user.data.state === "deleted" || user.data.state === "locked")
      return resultErrorCreate(op, "The current password is invalid.", "passwords.unauthorized")
    const existing = txRepository.passwordCredentialGet(options.realmId, options.userId)
    if (!existing.success)
      return resultErrorCreate(op, "The password change could not be completed.", "passwords.write-failed")
    if (existing.data === null) {
      if (options.allowInitialSet !== true)
        return resultErrorCreate(op, "The current password is invalid.", "passwords.unauthorized")
      const created = txRepository.passwordCredentialCreate({
        changedAt: now,
        createdAt: now,
        hash: hash.data,
        passwordChangeRequired: 0,
        realmId: options.realmId,
        userId: options.userId,
        version: 1,
      })
      if (!created.success || created.data === null)
        return resultErrorCreate(op, "The password change could not be completed.", "passwords.write-failed")
    } else {
      if (currentPassword === undefined)
        return resultErrorCreate(op, "The current password is invalid.", "passwords.unauthorized")
      const currentCheck = passwordHashVerify(currentPassword, existing.data.hash)
      if (!currentCheck.success || !currentCheck.data)
        return resultErrorCreate(op, "The current password is invalid.", "passwords.unauthorized")
      const updated = txRepository.passwordCredentialUpdate(options.realmId, options.userId, {
        changedAt: now,
        hash: hash.data,
        passwordChangeRequired: 0,
        version: existing.data.version + 1,
      })
      if (!updated.success || updated.data === null)
        return resultErrorCreate(op, "The password change could not be completed.", "passwords.write-failed")
    }
    const lockout = txRepository.passwordLockoutGet(options.realmId, options.userId)
    if (!lockout.success)
      return resultErrorCreate(op, "The password change could not be completed.", "passwords.write-failed")
    const reset = txRepository.passwordLockoutSet({
      failedAttempts: 0,
      realmId: options.realmId,
      lockedUntil: null,
      updatedAt: now,
      userId: options.userId,
      version: (lockout.data?.version ?? 0) + 1,
    })
    if (!reset.success) return reset
    const eventVersion = txRepository.passwordEventVersionGet(options.realmId, options.userId)
    if (!eventVersion.success)
      return resultErrorCreate(op, "The password change event version is invalid.", "passwords.invalid")
    const payload = v.safeParse(passwordCredentialChangedEventPayloadSchema, { reason: "change" })
    if (!payload.success)
      return resultErrorCreate(op, "The password event payload is invalid.", "passwords.event-invalid")
    const event = eventSecurityEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: options.userId,
        aggregateType: "password",
        aggregateVersion: eventVersion.data + 1,
        commandIndex: 0,
        correlationId,
        eventType: passwordEventTypes.credentialChanged,
        realmId: options.realmId,
        metadata: { auditSafe: true, source: "passwords" },
        occurredAt: now,
        payload: payload.output,
        userSubjectId: options.userId,
      },
      runtime,
    )
    if (!event.success) return event
    return resultCreate({ changed: true })
  })
}
