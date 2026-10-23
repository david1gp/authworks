import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import type { RealmSystemContext } from "../domain/realmSystemContext.js"
import type { RealmTenantContext } from "../domain/realmTenantContext.js"
import { realmAdministratorRevokedEventPayloadSchema } from "../events/realmAdministratorRevokedEventPayloadSchema.js"
import { realmEventTypes } from "../events/realmEventTypes.js"
import { realmAdministratorRepositoryCreate } from "../persistence/realmAdministratorRepositoryCreate.js"
import { realmGet } from "./realmGet.js"

type RealmAdministratorRevokeOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly realmId: string
  readonly userId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
}

export function realmAdministratorRevoke(options: RealmAdministratorRevokeOptions): Result<{ userId: string }> {
  const op = "realmAdministratorRevoke"
  if (options.context === undefined || options.context === null)
    return resultErrorCreate(op, "A tenant context is required.", "realms.tenant-required")
  if (options.context.kind === "tenant" && options.context.realmId !== options.realmId)
    return resultErrorCreate(op, "The realm is not available in this tenant context.", "realms.tenant-mismatch")
  const runtime = options.runtime ?? options.database.runtime
  const revokedAt = runtime.now()
  if (!Number.isSafeInteger(revokedAt) || revokedAt < 0)
    return resultErrorCreate(op, "The realm administrator timestamp is invalid.", "realms.invalid-timestamp")
  return storageTransactionRun(options.database, (transaction) => {
    const realm = realmGet({ context: options.context, database: options.database, realmId: options.realmId })
    if (!realm.success) return realm
    const repository = realmAdministratorRepositoryCreate(transaction)
    const current = repository.realmAdministratorList(options.realmId)
    if (!current.success) return current
    const target = current.data.find((row) => row.userId === options.userId)
    if (target === undefined)
      return resultErrorCreate(op, "The realm administrator was not found.", "realms.administrator-not-found")
    if (current.data.length <= 1)
      return resultErrorCreate(op, "The last realm administrator cannot be removed.", "realms.administrator-last")
    const removed = repository.realmAdministratorDelete(options.realmId, options.userId)
    if (!removed.success) return removed
    const payload = v.safeParse(realmAdministratorRevokedEventPayloadSchema, { userId: options.userId })
    if (!payload.success)
      return resultErrorCreate(op, "The realm administrator event payload is invalid.", "realms.event-invalid")
    const event = storageEventAppend(transaction, {
      actorId: options.context.actorId,
      aggregateId: options.userId,
      aggregateType: "realm_administrator",
      aggregateVersion: 1,
      commandIndex: 0,
      correlationId: uuidv7Create(runtime),
      eventType: realmEventTypes.administratorRevoked,
      metadata: { source: "realms" },
      occurredAt: revokedAt,
      payload: payload.output,
      realmId: options.realmId,
    })
    if (!event.success) return event
    return resultCreate({ userId: options.userId })
  })
}
