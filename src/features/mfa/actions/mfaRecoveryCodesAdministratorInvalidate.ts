import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import type { AuthorizationActorContext } from "../../authorization/public/authorizationActorContextSchema.js"
import { authorizationPermissionDefinitions } from "../../authorization/public/authorizationPermissionDefinitions.js"
import { eventSecurityEventAppend } from "../../events/server/eventSecurityEventAppend.js"
import { realmAdministratorContextAuthorize } from "../../realms/actions/realmAdministratorContextAuthorize.js"
import { mfaEventPayloadSchema } from "../events/mfaEventPayloadSchema.js"
import { mfaEventTypes } from "../events/mfaEventTypes.js"
import { mfaRepositoryCreate } from "../persistence/mfaRepositoryCreate.js"
import type { MfaRecoveryCodesInvalidateResponse } from "../public/mfaRecoveryCodesInvalidateResponseSchema.js"

type MfaRecoveryCodesAdministratorInvalidateOptions = {
  readonly actor: AuthorizationActorContext
  readonly database: StorageDatabase
  readonly realmId: string
  readonly userId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

/** Invalidates every remaining recovery code of a realm-local user after administrator authorization. */
export function mfaRecoveryCodesAdministratorInvalidate(
  options: MfaRecoveryCodesAdministratorInvalidateOptions,
): Result<MfaRecoveryCodesInvalidateResponse> {
  const op = "mfaRecoveryCodesAdministratorInvalidate"
  const authorized = realmAdministratorContextAuthorize({
    actor: options.actor,
    database: options.database,
    permission: authorizationPermissionDefinitions.userManage,
    realmId: options.realmId,
    targetUserId: options.userId,
  })
  if (!authorized.success) return authorized
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0)
    return resultErrorCreate(op, "The recovery code timestamp is invalid.", "mfa.invalid-timestamp")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  return storageTransactionRun(options.database, (transaction) => {
    const repository = mfaRepositoryCreate(transaction)
    const codes = repository.mfaRecoveryCodeList(options.realmId, options.userId)
    if (!codes.success) return codes
    const remaining = codes.data.filter((code) => code.consumedAt === null)
    if (remaining.length === 0) return resultErrorCreate(op, "The recovery codes were not found.", "mfa.not-found")
    const deleted = repository.mfaRecoveryCodesDelete(options.realmId, options.userId)
    if (!deleted.success) return deleted
    const payload = v.safeParse(mfaEventPayloadSchema, {
      codeCount: remaining.length,
      userId: options.userId,
    })
    if (!payload.success) return resultErrorCreate(op, "The MFA event payload is invalid.", "mfa.event-invalid")
    const eventVersion = repository.mfaEventVersionGet(options.realmId, "mfa_recovery_codes", options.userId)
    if (!eventVersion.success) return eventVersion
    const event = eventSecurityEventAppend(
      transaction,
      {
        actorId: authorized.data.actorId,
        aggregateId: options.userId,
        aggregateType: "mfa_recovery_codes",
        aggregateVersion: eventVersion.data + 1,
        commandIndex: 0,
        correlationId,
        eventType: mfaEventTypes.recoveryCodesInvalidated,
        realmId: options.realmId,
        metadata: { auditSafe: true, source: "mfa" },
        occurredAt: now,
        payload: payload.output,
        userSubjectId: options.userId,
      },
      runtime,
    )
    if (!event.success) return event
    return resultCreate({ invalidated: true, invalidatedCount: remaining.length })
  })
}
