import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import type { InstanceSystemContext } from "../../instances/domain/instanceSystemContext.js"
import type { InstanceTenantContext } from "../../instances/domain/instanceTenantContext.js"
import { machineCredentialRotatedEventPayloadSchema } from "../events/machineCredentialRotatedEventPayloadSchema.js"
import { machineEventTypes } from "../events/machineEventTypes.js"
import { machineSecretCreate } from "../domain/machineSecretCreate.js"
import { machineSecretHashCreate } from "../domain/machineSecretHashCreate.js"
import { machineScopesParse } from "../domain/machineScopesParse.js"
import { machineUserPublicViewCreate } from "../domain/machineUserPublicViewCreate.js"
import { machineRepositoryCreate } from "../persistence/machineRepositoryCreate.js"
import { machineUserContextAuthorize } from "./machineUserContextAuthorize.js"
import type { MachineUserSecretRotateResponse } from "../public/machineUserSecretRotateResponseSchema.js"

type MachineUserClientSecretRotateOptions = {
  readonly context: InstanceSystemContext | InstanceTenantContext
  readonly database: StorageDatabase
  readonly instanceId: string
  readonly machineUserId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function machineUserClientSecretRotate(
  options: MachineUserClientSecretRotateOptions,
): Result<MachineUserSecretRotateResponse> {
  const op = "machineUserClientSecretRotate"
  const authorized = machineUserContextAuthorize(options)
  if (!authorized.success) return authorized
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0) return resultErrorCreate(op, "The machine secret timestamp is invalid.")
  const secret = machineSecretCreate(runtime)
  if (!secret.success) return secret
  const secretHash = machineSecretHashCreate(secret.data, runtime)
  if (!secretHash.success) return secretHash
  const replacementId = uuidv7Create(runtime)
  const correlationId = options.correlationId ?? uuidv7Create(runtime)

  return storageTransactionRun(options.database, (transaction) => {
    const repository = machineRepositoryCreate(transaction)
    const user = repository.userGet(options.instanceId, options.machineUserId)
    if (!user.success) return user
    if (user.data === null) return resultErrorCreate(op, "The machine user was not found.")
    if (user.data.status !== "active") return resultErrorCreate(op, "The machine user is not active.")
    const scopes = machineScopesParse(user.data.scopes)
    if (!scopes.success) return scopes
    const credentials = repository.credentialList(options.instanceId, options.machineUserId)
    if (!credentials.success) return credentials
    const current = credentials.data.find(
      (credential) => credential.kind === "client_secret" && credential.revokedAt === null,
    )
    if (current === undefined) return resultErrorCreate(op, "The machine user has no active client secret.")
    const revoked = repository.credentialUpdate(options.instanceId, current.id, {
      replacedById: replacementId,
      revokedAt: now,
      version: current.version + 1,
    })
    if (!revoked.success) return revoked
    if (revoked.data === null) return resultErrorCreate(op, "The machine secret could not be rotated.")
    const replacement = repository.credentialCreate({
      createdAt: now,
      expiresAt: null,
      id: replacementId,
      instanceId: options.instanceId,
      kind: "client_secret",
      machineUserId: options.machineUserId,
      name: null,
      replacedById: null,
      revokedAt: null,
      scopes: JSON.stringify(scopes.data),
      secretHash: secretHash.data,
      version: 1,
    })
    if (!replacement.success) return replacement
    const payload = v.safeParse(machineCredentialRotatedEventPayloadSchema, {
      credentialId: current.id,
      credentialKind: "client_secret",
      replacementCredentialId: replacementId,
    })
    if (!payload.success) return resultErrorCreate(op, "The machine credential event payload is invalid.")
    const event = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: current.id,
        aggregateType: "machine_credential",
        aggregateVersion: revoked.data.version,
        commandIndex: 0,
        correlationId,
        eventType: machineEventTypes.credentialRotated,
        instanceId: options.instanceId,
        metadata: { auditSafe: true, source: "machine-users" },
        occurredAt: now,
        payload: payload.output,
      },
      runtime,
    )
    if (!event.success) return event
    return resultCreate({
      clientId: user.data.userName,
      clientSecret: secret.data,
      machineUser: machineUserPublicViewCreate(user.data, scopes.data),
    })
  })
}
