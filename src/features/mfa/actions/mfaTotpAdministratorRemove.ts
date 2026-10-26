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
import type { MfaTotpEnrollmentRemoveResponse } from "../public/mfaTotpEnrollmentRemoveResponseSchema.js"

type MfaTotpAdministratorRemoveOptions = {
  readonly actor: AuthorizationActorContext
  readonly database: StorageDatabase
  readonly realmId: string
  readonly userId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

/** Removes every TOTP enrollment of a realm-local user after administrator authorization. */
export function mfaTotpAdministratorRemove(
  options: MfaTotpAdministratorRemoveOptions,
): Result<MfaTotpEnrollmentRemoveResponse> {
  const op = "mfaTotpAdministratorRemove"
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
    return resultErrorCreate(op, "The TOTP removal timestamp is invalid.", "mfa.invalid-timestamp")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  return storageTransactionRun(options.database, (transaction) => {
    const repository = mfaRepositoryCreate(transaction)
    const enrollments = repository.mfaEnrollmentList(options.realmId, options.userId)
    if (!enrollments.success) return enrollments
    const removable = enrollments.data.filter(
      (enrollment) => enrollment.status === "active" || enrollment.status === "pending",
    )
    if (removable.length === 0) return resultErrorCreate(op, "The TOTP enrollment was not found.", "mfa.not-found")
    for (const enrollment of removable) {
      const removed = repository.mfaEnrollmentDelete(options.realmId, options.userId, enrollment.id, enrollment.version)
      if (!removed.success) return removed
      if (!removed.data) return resultErrorCreate(op, "The TOTP enrollment was not found.", "mfa.not-found")
      const payload = v.safeParse(mfaEventPayloadSchema, {
        enrollmentId: enrollment.id,
        factor: "totp",
        userId: options.userId,
      })
      if (!payload.success) return resultErrorCreate(op, "The MFA event payload is invalid.", "mfa.event-invalid")
      const eventVersion = repository.mfaEventVersionGet(options.realmId, "mfa_totp_enrollment", enrollment.id)
      if (!eventVersion.success) return eventVersion
      const event = eventSecurityEventAppend(
        transaction,
        {
          actorId: authorized.data.actorId,
          aggregateId: enrollment.id,
          aggregateType: "mfa_totp_enrollment",
          aggregateVersion: eventVersion.data + 1,
          commandIndex: 0,
          correlationId,
          eventType: mfaEventTypes.totpAdministratorRemoved,
          realmId: options.realmId,
          metadata: { auditSafe: true, source: "mfa" },
          occurredAt: now,
          payload: payload.output,
          userSubjectId: options.userId,
        },
        runtime,
      )
      if (!event.success) return event
    }
    const invalidated = repository.mfaChallengesInvalidateFactor(options.realmId, options.userId, "totp", now)
    if (!invalidated.success) return invalidated
    return resultCreate({ removed: true })
  })
}
