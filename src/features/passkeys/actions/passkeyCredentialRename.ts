import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { eventSecurityEventAppend } from "../../events/server/eventSecurityEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { passkeyCredentialViewCreate } from "../domain/passkeyCredentialViewCreate.js"
import { passkeyEventPayloadSchema } from "../events/passkeyEventPayloadSchema.js"
import { passkeyEventTypes } from "../events/passkeyEventTypes.js"
import { passkeyRepositoryCreate } from "../persistence/passkeyRepositoryCreate.js"
import type { PasskeyCredentialRenameRequest } from "../public/passkeyCredentialRenameRequestSchema.js"
import { passkeyCredentialRenameRequestSchema } from "../public/passkeyCredentialRenameRequestSchema.js"
import type { PasskeyCredentialRenameResponse } from "../public/passkeyCredentialRenameResponseSchema.js"

type PasskeyCredentialRenameOptions = {
  readonly actorId?: string | null
  readonly correlationId?: string
  readonly credentialId: string
  readonly database: StorageDatabase
  readonly input: PasskeyCredentialRenameRequest
  readonly realmId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly userId: string
}

export function passkeyCredentialRename(
  options: PasskeyCredentialRenameOptions,
): Result<PasskeyCredentialRenameResponse> {
  const op = "passkeyCredentialRename"
  const input = v.safeParse(passkeyCredentialRenameRequestSchema, options.input)
  if (!input.success) return resultErrorCreate(op, "The passkey credential nickname is invalid.", "passkeys.invalid")
  if (options.credentialId.length === 0)
    return resultErrorCreate(op, "The passkey credential was not found.", "passkeys.not-found")
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
      return resultErrorCreate(op, "The passkey credential was not found.", "passkeys.not-found")
    if (credential.data.nickname === input.output.nickname)
      return resultCreate({ credential: passkeyCredentialViewCreate(credential.data) })
    const updated = repository.passkeyCredentialRename(
      options.realmId,
      options.userId,
      credential.data.id,
      credential.data.version,
      input.output.nickname,
    )
    if (!updated.success) return updated
    if (updated.data === null) return resultErrorCreate(op, "The passkey credential is stale.", "passkeys.conflict")
    const payload = v.safeParse(passkeyEventPayloadSchema, {
      credentialId: updated.data.id,
      nickname: updated.data.nickname,
      ...(credential.data.nickname === null ? {} : { previousNickname: credential.data.nickname }),
      userId: options.userId,
    })
    if (!payload.success)
      return resultErrorCreate(op, "The passkey event payload is invalid.", "passkeys.event-invalid")
    const eventVersion = repository.passkeyEventVersionGet(options.realmId, "passkey_credential", credential.data.id)
    if (!eventVersion.success) return eventVersion
    const event = eventSecurityEventAppend(
      transaction,
      {
        actorId: options.actorId ?? options.userId,
        aggregateId: updated.data.id,
        aggregateType: "passkey_credential",
        aggregateVersion: eventVersion.data + 1,
        commandIndex: 0,
        correlationId,
        eventType: passkeyEventTypes.credentialRenamed,
        realmId: options.realmId,
        metadata: { auditSafe: true, source: "passkeys" },
        occurredAt: now,
        payload: payload.output,
        userSubjectId: options.userId,
      },
      runtime,
    )
    if (!event.success) return event
    return resultCreate({ credential: passkeyCredentialViewCreate(updated.data) })
  })
}
