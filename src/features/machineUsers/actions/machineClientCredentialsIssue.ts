import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { machineScopesParse } from "../domain/machineScopesParse.js"
import { machineSecretCreate } from "../domain/machineSecretCreate.js"
import { machineSecretHashCreate } from "../domain/machineSecretHashCreate.js"
import { machineSecretHashVerify } from "../domain/machineSecretHashVerify.js"
import { machineCredentialIssuedEventPayloadSchema } from "../events/machineCredentialIssuedEventPayloadSchema.js"
import { machineEventTypes } from "../events/machineEventTypes.js"
import { machineRepositoryCreate } from "../persistence/machineRepositoryCreate.js"
import {
  type MachineClientCredentialsRequest,
  machineClientCredentialsRequestSchema,
} from "../public/machineClientCredentialsRequestSchema.js"
import type { MachineClientCredentialsResponse } from "../public/machineClientCredentialsResponseSchema.js"

const machineAccessTokenLifetimeMs = 5 * 60 * 1_000

type MachineClientCredentialsIssueOptions = {
  readonly accessToken?: string
  readonly database: StorageDatabase
  readonly input: MachineClientCredentialsRequest
  readonly realmId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function machineClientCredentialsIssue(
  options: MachineClientCredentialsIssueOptions,
): Result<MachineClientCredentialsResponse> {
  const op = "machineClientCredentialsIssue"
  const parsed = v.safeParse(machineClientCredentialsRequestSchema, options.input)
  if (!parsed.success)
    return resultErrorCreate(
      "machineClientCredentialsInvalidClient",
      "Client authentication failed.",
      "machine-users.invalid-client",
    )
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0)
    return resultErrorCreate(op, "The client credentials timestamp is invalid.", "machine-users.invalid-timestamp")
  const expiresAt = now + machineAccessTokenLifetimeMs
  if (!Number.isSafeInteger(expiresAt))
    return resultErrorCreate(op, "The client credentials expiry is invalid.", "machine-users.invalid")
  const generatedAccessToken =
    options.accessToken === undefined ? machineSecretCreate(runtime) : resultCreate(options.accessToken)
  if (!generatedAccessToken.success) return generatedAccessToken
  const accessTokenHash = machineSecretHashCreate(generatedAccessToken.data, runtime)
  if (!accessTokenHash.success) return accessTokenHash
  const correlationId = options.correlationId ?? uuidv7Create(runtime)

  return storageTransactionRun(options.database, (transaction) => {
    const repository = machineRepositoryCreate(transaction)
    const machineUser = repository.userGetByName(options.realmId, parsed.output.clientId.trim().toLowerCase())
    if (!machineUser.success) return machineUser
    if (machineUser.data === null || machineUser.data.status !== "active")
      return resultErrorCreate(
        "machineClientCredentialsInvalidClient",
        "Client authentication failed.",
        "machine-users.invalid-client",
      )
    const configuredScopes = machineScopesParse(machineUser.data.scopes)
    if (!configuredScopes.success) return configuredScopes
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
    const verified = machineSecretHashVerify(parsed.output.clientSecret, clientCredential.secretHash)
    if (!verified.success) return verified
    if (!verified.data)
      return resultErrorCreate(
        "machineClientCredentialsInvalidClient",
        "Client authentication failed.",
        "machine-users.invalid-client",
      )
    const scopes = parsed.output.scope ?? configuredScopes.data
    if (scopes.some((scope) => !configuredScopes.data.includes(scope)))
      return resultErrorCreate(
        "machineClientCredentialsInvalidScope",
        "The requested machine scopes are invalid.",
        "machine-users.invalid-scope",
      )
    const uniqueScopes = [...new Set(scopes)]
    const credentialId = uuidv7Create(runtime)
    const created = repository.credentialCreate({
      createdAt: now,
      expiresAt,
      id: credentialId,
      realmId: options.realmId,
      kind: "access_token",
      machineUserId: machineUser.data.id,
      name: "OAuth client credentials",
      replacedById: null,
      revokedAt: null,
      scopes: JSON.stringify(uniqueScopes),
      secretHash: accessTokenHash.data,
      version: 1,
    })
    if (!created.success) return created
    const payload = v.safeParse(machineCredentialIssuedEventPayloadSchema, {
      credentialId,
      credentialKind: "access_token",
      expiresAt,
      machineUserId: machineUser.data.id,
      name: "OAuth client credentials",
      scopes: uniqueScopes,
    })
    if (!payload.success)
      return resultErrorCreate(op, "The machine credential event payload is invalid.", "machine-users.event-invalid")
    const event = storageEventAppend(
      transaction,
      {
        actorId: machineUser.data.id,
        aggregateId: credentialId,
        aggregateType: "machine_credential",
        aggregateVersion: 1,
        commandIndex: 0,
        correlationId,
        eventType: machineEventTypes.credentialIssued,
        realmId: options.realmId,
        metadata: { auditSafe: true, source: "machine-users", protocol: "oauth2" },
        occurredAt: now,
        payload: payload.output,
      },
      runtime,
    )
    if (!event.success) return event
    return resultCreate({
      accessToken: generatedAccessToken.data,
      expiresIn: Math.floor(machineAccessTokenLifetimeMs / 1_000),
      scope: uniqueScopes.join(" "),
      tokenType: "Bearer",
    })
  })
}
