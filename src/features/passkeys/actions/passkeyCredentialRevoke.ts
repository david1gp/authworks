import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { eventSecurityEventAppend } from "../../events/server/eventSecurityEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { externalIdentityUsableAuthenticationMethodRead } from "../../externalIdentities/server/externalIdentityUsableAuthenticationMethodRead.js"
import { passwordUsableAuthenticationMethodRead } from "../../passwords/server/passwordUsableAuthenticationMethodRead.js"
import { passkeyCredentialViewCreate } from "../domain/passkeyCredentialViewCreate.js"
import { passkeyEventPayloadSchema } from "../events/passkeyEventPayloadSchema.js"
import { passkeyEventTypes } from "../events/passkeyEventTypes.js"
import { passkeyRepositoryCreate } from "../persistence/passkeyRepositoryCreate.js"
import type { PasskeyCredentialRevokeRequest } from "../public/passkeyCredentialRevokeRequestSchema.js"
import { passkeyCredentialRevokeRequestSchema } from "../public/passkeyCredentialRevokeRequestSchema.js"
import type { PasskeyCredentialRevokeResponse } from "../public/passkeyCredentialRevokeResponseSchema.js"

type PasskeyCredentialRevokeOptions = {
  readonly actorId?: string | null
  readonly correlationId?: string
  readonly database: StorageDatabase
  readonly input: PasskeyCredentialRevokeRequest
  readonly realmId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly userId: string
}

export function passkeyCredentialRevoke(
  options: PasskeyCredentialRevokeOptions,
): Result<PasskeyCredentialRevokeResponse> {
  const op = "passkeyCredentialRevoke"
  const input = v.safeParse(passkeyCredentialRevokeRequestSchema, options.input)
  if (!input.success) return resultErrorCreate(op, "The passkey credential is invalid.", "passkeys.invalid")
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0)
    return resultErrorCreate(op, "The passkey timestamp is invalid.", "passkeys.invalid-timestamp")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  return storageTransactionRun(options.database, (transaction) => {
    const repository = passkeyRepositoryCreate(transaction)
    const credential = repository.passkeyCredentialGet(options.realmId, options.userId, input.output.credentialId)
    if (!credential.success) return credential
    if (credential.data === null || credential.data.revokedAt !== null)
      return resultErrorCreate(op, "The passkey credential is invalid.", "passkeys.invalid")
    const usablePasskeys = repository.passkeyCredentialList(options.realmId, options.userId)
    if (!usablePasskeys.success) return usablePasskeys
    const password = passwordUsableAuthenticationMethodRead({
      executor: transaction,
      realmId: options.realmId,
      userId: options.userId,
    })
    if (!password.success) return password
    const externalIdentity = externalIdentityUsableAuthenticationMethodRead({
      executor: transaction,
      realmId: options.realmId,
      userId: options.userId,
    })
    if (!externalIdentity.success) return externalIdentity
    if (
      usablePasskeys.data.filter((candidate) => candidate.revokedAt === null).length <= 1 &&
      !password.data.available &&
      !externalIdentity.data.available
    )
      return resultErrorCreate(op, "The last usable authentication method cannot be removed.", "passkeys.conflict")
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
        actorId: options.actorId ?? options.userId,
        aggregateId: credential.data.id,
        aggregateType: "passkey_credential",
        aggregateVersion: eventVersion.data + 1,
        commandIndex: 0,
        correlationId,
        eventType: passkeyEventTypes.credentialRevoked,
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
