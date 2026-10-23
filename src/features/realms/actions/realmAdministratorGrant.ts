import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { userDirectoryEntryResolve } from "../../users/server/userDirectoryEntryResolve.js"
import { realmAdministratorPublicViewCreate } from "../domain/realmAdministratorPublicViewCreate.js"
import type { RealmSystemContext } from "../domain/realmSystemContext.js"
import type { RealmTenantContext } from "../domain/realmTenantContext.js"
import { realmAdministratorGrantedEventPayloadSchema } from "../events/realmAdministratorGrantedEventPayloadSchema.js"
import { realmEventTypes } from "../events/realmEventTypes.js"
import { realmAdministratorRepositoryCreate } from "../persistence/realmAdministratorRepositoryCreate.js"
import type { RealmAdministrator } from "../public/realmAdministratorSchema.js"
import { realmGet } from "./realmGet.js"

type RealmAdministratorGrantOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly realmId: string
  readonly userId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
}

export function realmAdministratorGrant(options: RealmAdministratorGrantOptions): Result<{
  administrator: RealmAdministrator
}> {
  const op = "realmAdministratorGrant"
  if (options.context === undefined || options.context === null)
    return resultErrorCreate(op, "A tenant context is required.", "realms.tenant-required")
  if (options.context.kind === "tenant" && options.context.realmId !== options.realmId)
    return resultErrorCreate(op, "The realm is not available in this tenant context.", "realms.tenant-mismatch")
  const runtime = options.runtime ?? options.database.runtime
  const createdAt = runtime.now()
  if (!Number.isSafeInteger(createdAt) || createdAt < 0)
    return resultErrorCreate(op, "The realm administrator timestamp is invalid.", "realms.invalid-timestamp")
  return storageTransactionRun(options.database, (transaction) => {
    const realm = realmGet({ context: options.context, database: options.database, realmId: options.realmId })
    if (!realm.success) return realm
    const target = userDirectoryEntryResolve({
      database: options.database,
      realmId: options.realmId,
      userId: options.userId,
    })
    if (!target.success) return target
    if (target.data === undefined)
      return resultErrorCreate(op, "The user was not found in this realm.", "realms.not-found")
    const repository = realmAdministratorRepositoryCreate(transaction)
    const existing = repository.realmAdministratorGet(options.realmId, options.userId)
    if (!existing.success) return existing
    if (existing.data !== null)
      return resultErrorCreate(op, "The user is already a realm administrator.", "realms.administrator-exists")
    const inserted = repository.realmAdministratorInsert({
      createdAt,
      createdBy: options.context.actorId,
      realmId: options.realmId,
      userId: options.userId,
    })
    if (!inserted.success) return inserted
    const payload = v.safeParse(realmAdministratorGrantedEventPayloadSchema, { userId: options.userId })
    if (!payload.success)
      return resultErrorCreate(op, "The realm administrator event payload is invalid.", "realms.event-invalid")
    const event = storageEventAppend(transaction, {
      actorId: options.context.actorId,
      aggregateId: options.userId,
      aggregateType: "realm_administrator",
      aggregateVersion: 1,
      commandIndex: 0,
      correlationId: uuidv7Create(runtime),
      eventType: realmEventTypes.administratorGranted,
      metadata: { source: "realms" },
      occurredAt: createdAt,
      payload: payload.output,
      realmId: options.realmId,
    })
    if (!event.success) return event
    return resultCreate({
      administrator: realmAdministratorPublicViewCreate(inserted.data, target.data),
    })
  })
}
