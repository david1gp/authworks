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
import { machineUserStatusChangedEventPayloadSchema } from "../events/machineUserStatusChangedEventPayloadSchema.js"
import { machineScopesParse } from "../domain/machineScopesParse.js"
import { machineUserPublicViewCreate } from "../domain/machineUserPublicViewCreate.js"
import { machineRepositoryCreate } from "../persistence/machineRepositoryCreate.js"
import { machineUserContextAuthorize } from "./machineUserContextAuthorize.js"
import {
  machineUserLifecycleRequestSchema,
  type MachineUserLifecycleRequest,
} from "../public/machineUserLifecycleRequestSchema.js"
import type { MachineUserResponse } from "../public/machineUserResponseSchema.js"

type MachineUserLifecycleSetOptions = {
  readonly context: InstanceSystemContext | InstanceTenantContext
  readonly database: StorageDatabase
  readonly input: MachineUserLifecycleRequest
  readonly instanceId: string
  readonly machineUserId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function machineUserLifecycleSet(options: MachineUserLifecycleSetOptions): Result<MachineUserResponse> {
  const op = "machineUserLifecycleSet"
  const authorized = machineUserContextAuthorize(options)
  if (!authorized.success) return authorized
  const parsed = v.safeParse(machineUserLifecycleRequestSchema, options.input)
  if (!parsed.success) return resultErrorCreate(op, "The machine user lifecycle request is invalid.")
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0) return resultErrorCreate(op, "The machine user timestamp is invalid.")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  return storageTransactionRun(options.database, (transaction) => {
    const repository = machineRepositoryCreate(transaction)
    const found = repository.userGet(options.instanceId, options.machineUserId)
    if (!found.success) return found
    if (found.data === null) return resultErrorCreate(op, "The machine user was not found.")
    if (found.data.status === "removed" && parsed.output.status !== "removed")
      return resultErrorCreate(op, "A removed machine user cannot be reactivated.")
    if (found.data.status === parsed.output.status)
      return resultErrorCreate(op, "The machine user already has that status.")
    const updated = repository.userUpdate(options.instanceId, options.machineUserId, {
      status: parsed.output.status,
      updatedAt: now,
      version: found.data.version + 1,
    })
    if (!updated.success) return updated
    if (updated.data === null) return resultErrorCreate(op, "The machine user was not found.")
    const scopes = machineScopesParse(updated.data.scopes)
    if (!scopes.success) return scopes
    const statusPayload = v.safeParse(machineUserStatusChangedEventPayloadSchema, { status: updated.data.status })
    if (!statusPayload.success) return resultErrorCreate(op, "The machine user event payload is invalid.")
    const statusEvent = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: options.machineUserId,
        aggregateType: "machine_user",
        aggregateVersion: updated.data.version,
        commandIndex: 0,
        correlationId,
        eventType: machineEventTypes.userStatusChanged,
        instanceId: options.instanceId,
        metadata: { auditSafe: true, source: "machine-users" },
        occurredAt: now,
        payload: statusPayload.output,
      },
      runtime,
    )
    if (!statusEvent.success) return statusEvent
    if (parsed.output.status === "active")
      return resultCreate({ machineUser: machineUserPublicViewCreate(updated.data, scopes.data) })
    const revoked = repository.credentialRevokeForUser(options.instanceId, options.machineUserId, now)
    if (!revoked.success) return revoked
    let commandIndex = 1
    for (const credential of revoked.data) {
      const payload = v.safeParse(machineCredentialRevokedEventPayloadSchema, {
        credentialId: credential.id,
        credentialKind: credential.kind,
      })
      if (!payload.success) return resultErrorCreate(op, "The machine credential event payload is invalid.")
      const event = storageEventAppend(
        transaction,
        {
          actorId: options.context.actorId,
          aggregateId: credential.id,
          aggregateType: "machine_credential",
          aggregateVersion: credential.version,
          commandIndex,
          correlationId,
          eventType: machineEventTypes.credentialRevoked,
          instanceId: options.instanceId,
          metadata: { auditSafe: true, source: "machine-users" },
          occurredAt: now,
          payload: payload.output,
        },
        runtime,
      )
      if (!event.success) return event
      commandIndex += 1
    }
    return resultCreate({ machineUser: machineUserPublicViewCreate(updated.data, scopes.data) })
  })
}
