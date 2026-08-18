import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { Secret } from "../../../platform/secrets/Secret.js"
import { secretGenerate } from "../../../platform/secrets/secretGenerate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { realmPublicViewCreate } from "../domain/realmPublicViewCreate.js"
import { realmSecretHashCreate } from "../domain/realmSecretHashCreate.js"
import type { RealmSystemContext } from "../domain/realmSystemContext.js"
import { realmBootstrapAdminCreatedEventPayloadSchema } from "../events/realmBootstrapAdminCreatedEventPayloadSchema.js"
import { realmEventTypes } from "../events/realmEventTypes.js"
import { realmRepositoryCreate } from "../persistence/realmRepositoryCreate.js"
import type { Realm } from "../public/realmSchema.js"

type RealmBootstrapAdminCreateOptions = {
  readonly context: RealmSystemContext
  readonly database: StorageDatabase
  readonly realmId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function realmBootstrapAdminCreate(
  options: RealmBootstrapAdminCreateOptions,
): Result<{ bootstrapAdmin: { adminId: string; secret: Secret }; realm: Realm }> {
  const op = "realmBootstrapAdminCreate"
  if (options.context?.kind !== "system")
    return resultErrorCreate(op, "Only the system context can create the bootstrap administrator.")

  const runtime = options.runtime ?? options.database.runtime
  const secret = secretGenerate(32, runtime)
  const adminId = uuidv7Create(runtime)
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  const createdAt = runtime.now()
  if (!Number.isSafeInteger(createdAt) || createdAt < 0)
    return resultErrorCreate(op, "The bootstrap timestamp is invalid.")

  return storageTransactionRun(options.database, (transaction) => {
    const repository = realmRepositoryCreate(transaction)
    const current = repository.realmGet(options.realmId)
    if (!current.success) return current
    if (current.data === null) return resultErrorCreate(op, "The realm was not found.")
    const existing = repository.realmBootstrapAdminGet(options.realmId)
    if (!existing.success) return existing
    if (existing.data !== null) return resultErrorCreate(op, "The bootstrap administrator already exists.")

    const admin = repository.realmBootstrapAdminCreate({
      adminId,
      createdAt,
      realmId: options.realmId,
      secretHash: realmSecretHashCreate(secret.valueGet()),
    })
    if (!admin.success) return admin
    const version = current.data.version + 1
    const updated = repository.realmUpdate(options.realmId, {
      bootstrapAdminId: adminId,
      bootstrapCompletedAt: createdAt,
      updatedAt: createdAt,
      version,
    })
    if (!updated.success) return updated
    if (updated.data === null) return resultErrorCreate(op, "The realm was not found.")

    const payloadResult = v.safeParse(realmBootstrapAdminCreatedEventPayloadSchema, { adminId })
    if (!payloadResult.success) return resultErrorCreate(op, "The bootstrap event payload is invalid.")
    const event = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: options.realmId,
        aggregateType: "realm",
        aggregateVersion: version,
        commandIndex: 0,
        correlationId,
        eventType: realmEventTypes.bootstrapAdminCreated,
        realmId: options.realmId,
        metadata: { source: "realms" },
        occurredAt: createdAt,
        payload: payloadResult.output,
      },
      runtime,
    )
    if (!event.success) return event
    const domains = repository.realmDomainList(options.realmId)
    if (!domains.success) return domains

    return resultCreate({
      bootstrapAdmin: { adminId, secret },
      realm: realmPublicViewCreate(updated.data, domains.data),
    })
  })
}
