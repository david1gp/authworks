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
import { machineCredentialRevokedEventPayloadSchema } from "../events/machineCredentialRevokedEventPayloadSchema.js"
import { machineEventTypes } from "../events/machineEventTypes.js"
import { machineCredentialPublicViewCreate } from "../domain/machineCredentialPublicViewCreate.js"
import { machineScopesParse } from "../domain/machineScopesParse.js"
import { machineRepositoryCreate } from "../persistence/machineRepositoryCreate.js"
import { machineUserContextAuthorize } from "./machineUserContextAuthorize.js"
import {
  machineCredentialRevokeRequestSchema,
  type MachineCredentialRevokeRequest,
} from "../public/machineCredentialRevokeRequestSchema.js"
import type { MachineCredentialRevokeResponse } from "../public/machineCredentialRevokeResponseSchema.js"

type MachineCredentialRevokeOptions = {
  readonly context: InstanceSystemContext | InstanceTenantContext
  readonly database: StorageDatabase
  readonly credentialId: string
  readonly input?: MachineCredentialRevokeRequest
  readonly instanceId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function machineCredentialRevoke(
  options: MachineCredentialRevokeOptions,
): Result<MachineCredentialRevokeResponse> {
  const op = "machineCredentialRevoke"
  const authorized = machineUserContextAuthorize({ ...options, permission: "machine.credential.manage" })
  if (!authorized.success) return authorized
  const parsed = v.safeParse(machineCredentialRevokeRequestSchema, options.input ?? {})
  if (!parsed.success) return resultErrorCreate(op, "The machine credential revocation request is invalid.")
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0)
    return resultErrorCreate(op, "The machine credential timestamp is invalid.")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  return storageTransactionRun(options.database, (transaction) => {
    const repository = machineRepositoryCreate(transaction)
    const found = repository.credentialGet(options.instanceId, options.credentialId)
    if (!found.success) return found
    if (found.data === null) return resultErrorCreate(op, "The machine credential was not found.")
    if (found.data.revokedAt !== null) return resultErrorCreate(op, "The machine credential is already revoked.")
    const revoked = repository.credentialRevoke(options.instanceId, options.credentialId, now)
    if (!revoked.success) return revoked
    if (revoked.data === null) return resultErrorCreate(op, "The machine credential is already revoked.")
    const payload = v.safeParse(machineCredentialRevokedEventPayloadSchema, {
      credentialId: revoked.data.id,
      credentialKind: revoked.data.kind,
    })
    if (!payload.success) return resultErrorCreate(op, "The machine credential event payload is invalid.")
    const event = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: revoked.data.id,
        aggregateType: "machine_credential",
        aggregateVersion: revoked.data.version,
        commandIndex: 0,
        correlationId,
        eventType: machineEventTypes.credentialRevoked,
        instanceId: options.instanceId,
        metadata: {
          auditSafe: true,
          source: "machine-users",
          ...(parsed.output.reason === undefined ? {} : { reason: parsed.output.reason }),
        },
        occurredAt: now,
        payload: payload.output,
      },
      runtime,
    )
    if (!event.success) return event
    const scopes = machineScopesParse(revoked.data.scopes)
    if (!scopes.success) return scopes
    return resultCreate({ credential: machineCredentialPublicViewCreate(revoked.data, scopes.data) })
  })
}
