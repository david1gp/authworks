import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { machineCredentialRevokedEventPayloadSchema } from "../events/machineCredentialRevokedEventPayloadSchema.js"
import { machineEventTypes } from "../events/machineEventTypes.js"
import { machineSecretHashVerify } from "../domain/machineSecretHashVerify.js"
import { machineRepositoryCreate } from "../persistence/machineRepositoryCreate.js"

type MachineClientCredentialsRevokeOptions = {
  readonly clientId: string
  readonly clientSecret: string
  readonly database: StorageDatabase
  readonly realmId: string
  readonly token: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function machineClientCredentialsRevoke(options: MachineClientCredentialsRevokeOptions): Result<void> {
  const op = "machineClientCredentialsRevoke"
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0)
    return resultErrorCreate(op, "The token revocation timestamp is invalid.", "machine-users.invalid-timestamp")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  return storageTransactionRun(options.database, (transaction) => {
    const repository = machineRepositoryCreate(transaction)
    const machineUser = repository.userGetByName(options.realmId, options.clientId.trim().toLowerCase())
    if (!machineUser.success) return machineUser
    if (machineUser.data === null || machineUser.data.status !== "active")
      return resultErrorCreate(
        "machineClientCredentialsInvalidClient",
        "Client authentication failed.",
        "machine-users.invalid-client",
      )
    const credentials = repository.credentialList(options.realmId, machineUser.data.id)
    if (!credentials.success) return credentials
    const clientCredential = credentials.data.find(
      (credential) => credential.kind === "client_secret" && credential.revokedAt === null,
    )
    if (clientCredential === undefined)
      return resultErrorCreate(
        "machineClientCredentialsInvalidClient",
        "Client authentication failed.",
        "machine-users.invalid-client",
      )
    const verified = machineSecretHashVerify(options.clientSecret, clientCredential.secretHash)
    if (!verified.success) return verified
    if (!verified.data)
      return resultErrorCreate(
        "machineClientCredentialsInvalidClient",
        "Client authentication failed.",
        "machine-users.invalid-client",
      )
    for (const candidate of credentials.data) {
      if (candidate.kind !== "access_token" || candidate.revokedAt !== null) continue
      const tokenMatches = machineSecretHashVerify(options.token, candidate.secretHash)
      if (!tokenMatches.success) return tokenMatches
      if (!tokenMatches.data) continue
      const revoked = repository.credentialRevoke(options.realmId, candidate.id, now)
      if (!revoked.success) return revoked
      if (revoked.data === null) return resultCreate(undefined)
      const payload = v.safeParse(machineCredentialRevokedEventPayloadSchema, {
        credentialId: candidate.id,
        credentialKind: candidate.kind,
      })
      if (!payload.success)
        return resultErrorCreate(op, "The machine credential event payload is invalid.", "machine-users.event-invalid")
      const event = storageEventAppend(
        transaction,
        {
          actorId: machineUser.data.id,
          aggregateId: candidate.id,
          aggregateType: "machine_credential",
          aggregateVersion: revoked.data.version,
          commandIndex: 0,
          correlationId,
          eventType: machineEventTypes.credentialRevoked,
          realmId: options.realmId,
          metadata: { auditSafe: true, source: "machine-users", protocol: "oauth2" },
          occurredAt: now,
          payload: payload.output,
        },
        runtime,
      )
      if (!event.success) return event
      return resultCreate(undefined)
    }
    return resultCreate(undefined)
  })
}
