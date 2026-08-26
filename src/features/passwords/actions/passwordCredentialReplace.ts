import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { Secret } from "../../../platform/secrets/Secret.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { eventSecurityEventAppend } from "../../events/server/eventSecurityEventAppend.js"
import { realmGet } from "../../realms/actions/realmGet.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import { passwordHashCreate } from "../domain/passwordHashCreate.js"
import { passwordHashVerify } from "../domain/passwordHashVerify.js"
import { passwordPolicyCheck } from "../domain/passwordPolicyCheck.js"
import { passwordPolicyDefaults } from "../domain/passwordPolicyDefaults.js"
import { passwordPolicyViewCreate } from "../domain/passwordPolicyViewCreate.js"
import { passwordCredentialChangedEventPayloadSchema } from "../events/passwordCredentialChangedEventPayloadSchema.js"
import { passwordEventTypes } from "../events/passwordEventTypes.js"
import { passwordRepositoryCreate } from "../persistence/passwordRepositoryCreate.js"
import type { PasswordCredentialReplaceResponse } from "../public/passwordCredentialReplaceResponseSchema.js"

type PasswordCredentialReplaceOptions = {
  readonly context: RealmSystemContext
  readonly database: StorageDatabase
  readonly password: Secret
  readonly realmId: string
  readonly userId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function passwordCredentialReplace(
  options: PasswordCredentialReplaceOptions,
): Result<PasswordCredentialReplaceResponse> {
  const op = "passwordCredentialReplace"
  if (options.context === undefined || options.context === null || options.context.kind !== "system")
    return resultErrorCreate(op, "System authorization is required.", "passwords.forbidden")
  const realm = realmGet({ context: options.context, database: options.database, realmId: options.realmId })
  if (!realm.success) return realm
  if (realm.data.realm.status !== "active")
    return resultErrorCreate(op, "The realm is not active.", "passwords.forbidden")
  const repository = passwordRepositoryCreate(options.database.db)
  const policyRow = repository.passwordPolicyGet(options.realmId)
  if (!policyRow.success) return resultErrorCreate(op, "The password could not be replaced.", "passwords.write-failed")
  const policy = policyRow.data === null ? passwordPolicyDefaults : passwordPolicyViewCreate(policyRow.data)
  const password = options.password.valueGet()
  const checked = passwordPolicyCheck(password, policy)
  if (!checked.success) return checked
  const currentCredential = repository.passwordCredentialGet(options.realmId, options.userId)
  if (!currentCredential.success) return currentCredential
  const currentMatches =
    currentCredential.data === null ? resultCreate(false) : passwordHashVerify(password, currentCredential.data.hash)
  if (!currentMatches.success) return currentMatches
  const hash = currentMatches.data
    ? undefined
    : passwordHashCreate(password, options.runtime ?? options.database.runtime)
  if (hash !== undefined && !hash.success) return hash
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0)
    return resultErrorCreate(op, "The password timestamp is invalid.", "passwords.invalid-timestamp")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)

  return storageTransactionRun(options.database, (transaction) => {
    const txRepository = passwordRepositoryCreate(transaction)
    const user = txRepository.passwordUserGet(options.realmId, options.userId)
    if (!user.success) return user
    if (user.data === null || user.data.state === "deleted")
      return resultErrorCreate(op, "The user was not found.", "passwords.not-found")
    const existing = txRepository.passwordCredentialGet(options.realmId, options.userId)
    if (!existing.success) return existing
    const matches = existing.data === null ? resultCreate(false) : passwordHashVerify(password, existing.data.hash)
    if (!matches.success) return matches
    let credentialChanged = false
    if (!matches.data) {
      const replacementHash = hash ?? passwordHashCreate(password, runtime)
      if (!replacementHash.success) return replacementHash
      const replaced =
        existing.data === null
          ? txRepository.passwordCredentialCreate({
              changedAt: now,
              createdAt: now,
              hash: replacementHash.data,
              realmId: options.realmId,
              userId: options.userId,
              version: 1,
            })
          : txRepository.passwordCredentialUpdate(options.realmId, options.userId, {
              changedAt: now,
              hash: replacementHash.data,
              version: existing.data.version + 1,
            })
      if (!replaced.success || replaced.data === null)
        return resultErrorCreate(op, "The password could not be replaced.", "passwords.write-failed")
      credentialChanged = true
    }
    const lockout = txRepository.passwordLockoutGet(options.realmId, options.userId)
    if (!lockout.success) return lockout
    const lockoutChanged =
      lockout.data !== null && (lockout.data.failedAttempts !== 0 || lockout.data.lockedUntil !== null)
    if (credentialChanged || lockoutChanged) {
      const reset = txRepository.passwordLockoutSet({
        failedAttempts: 0,
        realmId: options.realmId,
        lockedUntil: null,
        updatedAt: now,
        userId: options.userId,
        version: (lockout.data?.version ?? 0) + 1,
      })
      if (!reset.success) return reset
    }
    if (!credentialChanged) return resultCreate({ changed: lockoutChanged })
    const eventVersion = txRepository.passwordEventVersionGet(options.realmId, options.userId)
    if (!eventVersion.success)
      return resultErrorCreate(op, "The password event version is invalid.", "passwords.invalid")
    const payload = v.safeParse(passwordCredentialChangedEventPayloadSchema, { reason: "operator" })
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
