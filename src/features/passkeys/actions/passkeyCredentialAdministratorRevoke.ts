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
import { passkeyCredentialViewCreate } from "../domain/passkeyCredentialViewCreate.js"
import { passkeyEventPayloadSchema } from "../events/passkeyEventPayloadSchema.js"
import { passkeyEventTypes } from "../events/passkeyEventTypes.js"
import { passkeyRepositoryCreate } from "../persistence/passkeyRepositoryCreate.js"
import type { PasskeyCredentialRevokeResponse } from "../public/passkeyCredentialRevokeResponseSchema.js"

type PasskeyCredentialAdministratorRevokeOptions = {
  readonly actor: AuthorizationActorContext
  readonly correlationId?: string
  readonly credentialId: string
  readonly database: StorageDatabase
  readonly realmId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly userId: string
}

/**
 * Revokes one passkey credential of a realm-local user after administrator authorization.
 * Unlike self-service revocation this path has no last-usable-method guard: administrators
 * reset authentication methods explicitly and own the resulting account-recovery risk.
 */
export function passkeyCredentialAdministratorRevoke(
  options: PasskeyCredentialAdministratorRevokeOptions,
): Result<PasskeyCredentialRevokeResponse> {
  const op = "passkeyCredentialAdministratorRevoke"
  if (options.credentialId.length === 0)
    return resultErrorCreate(op, "The passkey credential is invalid.", "passkeys.invalid")
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
    return resultErrorCreate(op, "The passkey timestamp is invalid.", "passkeys.invalid-timestamp")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  return storageTransactionRun(options.database, (transaction) => {
    const repository = passkeyRepositoryCreate(transaction)
    const credential = repository.passkeyCredentialGet(options.realmId, options.userId, options.credentialId)
    if (!credential.success) return credential
    if (credential.data === null || credential.data.revokedAt !== null)
      return resultErrorCreate(op, "The passkey credential is invalid.", "passkeys.invalid")
    const eventVersion = repository.passkeyEventVersionGet(options.realmId, "passkey_credential", credential.data.id)
    if (!eventVersion.success) return eventVersion
    const revoked = repository.passkeyCredentialRevoke(
      options.realmId,
      options.userId,
      credential.data.id,
      credential.data.version,
      now,
    )
    if (!revoked.success) return revoked
    if (revoked.data === null) return resultErrorCreate(op, "The passkey credential is invalid.", "passkeys.invalid")
    const payload = v.safeParse(passkeyEventPayloadSchema, {
      credentialId: credential.data.id,
      userId: options.userId,
    })
    if (!payload.success)
      return resultErrorCreate(op, "The passkey event payload is invalid.", "passkeys.event-invalid")
    const event = eventSecurityEventAppend(
      transaction,
      {
        actorId: authorized.data.actorId,
        aggregateId: credential.data.id,
        aggregateType: "passkey_credential",
        aggregateVersion: eventVersion.data + 1,
        commandIndex: 0,
        correlationId,
        eventType: passkeyEventTypes.credentialAdministratorRevoked,
        realmId: options.realmId,
        metadata: { auditSafe: true, source: "passkeys" },
        occurredAt: now,
        payload: payload.output,
        userSubjectId: options.userId,
      },
      runtime,
    )
    if (!event.success) return event
    return resultCreate({ credential: passkeyCredentialViewCreate(revoked.data) })
  })
}
