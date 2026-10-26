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
import { machineScopesParse } from "../domain/machineScopesParse.js"
import { machineScopesPermissionValidate } from "../domain/machineScopesPermissionValidate.js"
import { machineUserPublicViewCreate } from "../domain/machineUserPublicViewCreate.js"
import { machineEventTypes } from "../events/machineEventTypes.js"
import { machineUserUpdatedEventPayloadSchema } from "../events/machineUserUpdatedEventPayloadSchema.js"
import { machineRepositoryCreate } from "../persistence/machineRepositoryCreate.js"
import {
  type MachineUserUpdateRequest,
  machineUserUpdateRequestSchema,
} from "../public/machineUserUpdateRequestSchema.js"
import type { MachineUserResponse } from "../public/machineUserResponseSchema.js"
import { machineUserContextAuthorize } from "./machineUserContextAuthorize.js"

type MachineUserUpdateOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly input: MachineUserUpdateRequest
  readonly organizationId: string
  readonly realmId: string
  readonly machineUserId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function machineUserUpdate(options: MachineUserUpdateOptions): Result<MachineUserResponse> {
  const op = "machineUserUpdate"
  const authorized = machineUserContextAuthorize(options)
  if (!authorized.success) return authorized
  const parsed = v.safeParse(machineUserUpdateRequestSchema, options.input)
  if (!parsed.success) return resultErrorCreate(op, "The machine user request is invalid.", "machine-users.invalid")
  const displayName = parsed.output.displayName.trim()
  if (displayName.length === 0)
    return resultErrorCreate(op, "The machine user request is invalid.", "machine-users.invalid")
  const scopes = parsed.output.scopes === undefined ? undefined : [...new Set(parsed.output.scopes)]
  if (scopes !== undefined) {
    const catalogScopes = machineScopesPermissionValidate(scopes)
    if (!catalogScopes.success) return catalogScopes
  }
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0)
    return resultErrorCreate(op, "The machine user timestamp is invalid.", "machine-users.invalid-timestamp")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  return storageTransactionRun(options.database, (transaction) => {
    const repository = machineRepositoryCreate(transaction)
    const found = repository.userGet(options.realmId, options.organizationId, options.machineUserId)
    if (!found.success) return found
    if (found.data === null) return resultErrorCreate(op, "The machine user was not found.", "machine-users.not-found")
    if (found.data.status === "removed")
      return resultErrorCreate(op, "A removed machine user cannot be updated.", "machine-users.not-active")
    const stored = machineScopesParse(found.data.scopes)
    if (!stored.success) return stored
    const nextScopes = scopes ?? stored.data
    const updated = repository.userUpdate(options.realmId, options.organizationId, options.machineUserId, {
      displayName,
      scopes: JSON.stringify(nextScopes),
      updatedAt: now,
      version: found.data.version + 1,
    })
    if (!updated.success) return updated
    if (updated.data === null)
      return resultErrorCreate(op, "The machine user was not found.", "machine-users.not-found")
    const payload = v.safeParse(machineUserUpdatedEventPayloadSchema, {
      displayName: updated.data.displayName,
      scopes: nextScopes,
    })
    if (!payload.success)
      return resultErrorCreate(op, "The machine user event payload is invalid.", "machine-users.event-invalid")
    const event = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: options.machineUserId,
        aggregateType: "machine_user",
        aggregateVersion: updated.data.version,
        commandIndex: 0,
        correlationId,
        eventType: machineEventTypes.userUpdated,
        realmId: options.realmId,
        metadata: { auditSafe: true, source: "machine-users" },
        occurredAt: now,
        payload: payload.output,
      },
      runtime,
    )
    if (!event.success) return event
    return resultCreate({ machineUser: machineUserPublicViewCreate(updated.data, nextScopes) })
  })
}
