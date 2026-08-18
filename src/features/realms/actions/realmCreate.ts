import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { realmDomainNormalize } from "../domain/realmDomainNormalize.js"
import { realmNameNormalize } from "../domain/realmNameNormalize.js"
import { realmPublicViewCreate } from "../domain/realmPublicViewCreate.js"
import type { RealmSystemContext } from "../domain/realmSystemContext.js"
import type { RealmTenantContext } from "../domain/realmTenantContext.js"
import { realmCreatedEventPayloadSchema } from "../events/realmCreatedEventPayloadSchema.js"
import { realmEventTypes } from "../events/realmEventTypes.js"
import { realmRepositoryCreate } from "../persistence/realmRepositoryCreate.js"
import type { RealmCreateRequest } from "../public/realmCreateRequestSchema.js"
import type { Realm } from "../public/realmSchema.js"

type RealmCreateOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly input: RealmCreateRequest
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function realmCreate(options: RealmCreateOptions): Result<{ realm: Realm }> {
  const op = "realmCreate"
  if (options.context?.kind !== "system")
    return resultErrorCreate(op, "Only the system context can create realms.", "realms.system-required")

  const name = realmNameNormalize(options.input.name)
  if (!name.success) return name
  const primaryDomain = realmDomainNormalize(options.input.domain)
  if (!primaryDomain.success) return primaryDomain
  const domains = [primaryDomain.data]
  for (const candidate of options.input.domains ?? []) {
    const domain = realmDomainNormalize(candidate)
    if (!domain.success) return domain
    if (domains.includes(domain.data))
      return resultErrorCreate(op, "Realm domains must be unique.", "realms.domain-not-unique")
    domains.push(domain.data)
  }

  const runtime = options.runtime ?? options.database.runtime
  const realmId = uuidv7Create(runtime)
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  const createdAt = runtime.now()
  if (!Number.isSafeInteger(createdAt) || createdAt < 0)
    return resultErrorCreate(op, "The realm timestamp is invalid.", "realms.invalid-timestamp")

  return storageTransactionRun(options.database, (transaction) => {
    const repository = realmRepositoryCreate(transaction)
    const created = repository.realmCreate(
      {
        createdAt,
        id: realmId,
        name: name.data,
        primaryDomain: primaryDomain.data,
        status: "active",
        updatedAt: createdAt,
        version: 1,
      },
      domains,
    )
    if (!created.success) {
      if (created.errorMessage === "The realm could not be created.")
        return resultErrorCreate(op, "A realm with that domain already exists.", "realms.already-exists")
      return created
    }

    const payloadResult = v.safeParse(realmCreatedEventPayloadSchema, {
      domain: primaryDomain.data,
      name: name.data,
    })
    if (!payloadResult.success)
      return resultErrorCreate(op, "The realm event payload is invalid.", "realms.event-invalid")
    const event = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: realmId,
        aggregateType: "realm",
        aggregateVersion: 1,
        commandIndex: 0,
        correlationId,
        eventType: realmEventTypes.created,
        realmId: realmId,
        metadata: { source: "realms" },
        occurredAt: createdAt,
        payload: payloadResult.output,
      },
      runtime,
    )
    if (!event.success) return event

    return resultCreate({ realm: realmPublicViewCreate(created.data, domains) })
  })
}
