import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { machineCredentialPublicViewCreate } from "../domain/machineCredentialPublicViewCreate.js"
import { machineScopesParse } from "../domain/machineScopesParse.js"
import { machineSecretCreate } from "../domain/machineSecretCreate.js"
import { machineSecretHashCreate } from "../domain/machineSecretHashCreate.js"
import { machineCredentialIssuedEventPayloadSchema } from "../events/machineCredentialIssuedEventPayloadSchema.js"
import { machineEventTypes } from "../events/machineEventTypes.js"
import { machineRepositoryCreate } from "../persistence/machineRepositoryCreate.js"
import {
  type MachineCredentialIssueRequest,
  machineCredentialIssueRequestSchema,
} from "../public/machineCredentialIssueRequestSchema.js"
import type { MachineCredentialIssueResponse } from "../public/machineCredentialIssueResponseSchema.js"
import type { MachineCredentialKind } from "../public/machineCredentialKindSchema.js"
import { machineUserContextAuthorize } from "./machineUserContextAuthorize.js"

type MachineCredentialIssueOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly input: MachineCredentialIssueRequest
  readonly realmId: string
  readonly kind: Exclude<MachineCredentialKind, "access_token" | "client_secret">
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function machineCredentialIssue(options: MachineCredentialIssueOptions): Result<MachineCredentialIssueResponse> {
  const op = "machineCredentialIssue"
  const authorized = machineUserContextAuthorize({ ...options, permission: "machine.credential.manage" })
  if (!authorized.success) return authorized
  const parsed = v.safeParse(machineCredentialIssueRequestSchema, options.input)
  if (!parsed.success)
    return resultErrorCreate(op, "The machine credential request is invalid.", "machine-users.invalid")
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0)
    return resultErrorCreate(op, "The machine credential timestamp is invalid.", "machine-users.invalid-timestamp")
  const expiresAt = parsed.output.expiresAt ?? now + 365 * 24 * 60 * 60 * 1_000
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now)
    return resultErrorCreate(op, "The machine credential expiry must be in the future.", "machine-users.invalid")
  const secret = machineSecretCreate(runtime)
  if (!secret.success) return secret
  const secretHash = machineSecretHashCreate(secret.data, runtime)
  if (!secretHash.success) return secretHash
  const credentialId = uuidv7Create(runtime)
  const correlationId = options.correlationId ?? uuidv7Create(runtime)

  return storageTransactionRun(options.database, (transaction) => {
    const repository = machineRepositoryCreate(transaction)
    const machineUser = repository.userGet(options.realmId, parsed.output.machineUserId)
    if (!machineUser.success) return machineUser
    if (machineUser.data === null)
      return resultErrorCreate(op, "The machine user was not found.", "machine-users.not-found")
    if (machineUser.data.status !== "active")
      return resultErrorCreate(op, "The machine user is not active.", "machine-users.not-active")
    const configuredScopes = machineScopesParse(machineUser.data.scopes)
    if (!configuredScopes.success) return configuredScopes
    const scopes = [...new Set(parsed.output.scopes ?? configuredScopes.data)]
    if (scopes.some((scope) => !configuredScopes.data.includes(scope)))
      return resultErrorCreate(op, "The requested machine scopes are not allowed.", "machine-users.invalid-scope")
    const credential = repository.credentialCreate({
      createdAt: now,
      expiresAt,
      id: credentialId,
      realmId: options.realmId,
      kind: options.kind,
      machineUserId: parsed.output.machineUserId,
      name: parsed.output.name,
      replacedById: null,
      revokedAt: null,
      scopes: JSON.stringify(scopes),
      secretHash: secretHash.data,
      version: 1,
    })
    if (!credential.success) return credential
    const payload = v.safeParse(machineCredentialIssuedEventPayloadSchema, {
      credentialId,
      credentialKind: options.kind,
      expiresAt,
      machineUserId: parsed.output.machineUserId,
      name: parsed.output.name,
      scopes,
    })
    if (!payload.success)
      return resultErrorCreate(op, "The machine credential event payload is invalid.", "machine-users.event-invalid")
    const event = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: credentialId,
        aggregateType: "machine_credential",
        aggregateVersion: 1,
        commandIndex: 0,
        correlationId,
        eventType: machineEventTypes.credentialIssued,
        realmId: options.realmId,
        metadata: { auditSafe: true, source: "machine-users" },
        occurredAt: now,
        payload: payload.output,
      },
      runtime,
    )
    if (!event.success) return event
    return resultCreate({
      credential: machineCredentialPublicViewCreate(credential.data, scopes),
      secret: secret.data,
    })
  })
}
