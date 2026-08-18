import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { patchInputParse } from "../../../platform/http/patchInputParse.js"
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
import { realmEventTypes } from "../events/realmEventTypes.js"
import { realmUpdatedEventPayloadSchema } from "../events/realmUpdatedEventPayloadSchema.js"
import { realmRepositoryCreate } from "../persistence/realmRepositoryCreate.js"
import type { Realm } from "../public/realmSchema.js"
import { type RealmUpdateRequest, realmUpdateRequestSchema } from "../public/realmUpdateRequestSchema.js"

type RealmUpdateOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly input: RealmUpdateRequest
  readonly realmId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function realmUpdate(options: RealmUpdateOptions): Result<{ realm: Realm }> {
  const op = "realmUpdate"
  if (options.context === undefined || options.context === null)
    return resultErrorCreate(op, "A tenant context is required.", "realms.tenant-required")
  if (options.context.kind === "tenant" && options.context.realmId !== options.realmId)
    return resultErrorCreate(op, "The realm is not available in this tenant context.", "realms.tenant-mismatch")

  const parsed = patchInputParse(op, realmUpdateRequestSchema, options.input, "realms.empty-patch")
  if (!parsed.success) return parsed

  const runtime = options.runtime ?? options.database.runtime
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  const updatedAt = runtime.now()
  if (!Number.isSafeInteger(updatedAt) || updatedAt < 0)
    return resultErrorCreate(op, "The realm timestamp is invalid.", "realms.invalid-timestamp")

  return storageTransactionRun(options.database, (transaction) => {
    const repository = realmRepositoryCreate(transaction)
    const current = repository.realmGet(options.realmId)
    if (!current.success) return current
    if (current.data === null) return resultErrorCreate(op, "The realm was not found.", "realms.not-found")
    const currentRow = current.data
    const currentDomains = repository.realmDomainList(options.realmId)
    if (!currentDomains.success) return currentDomains

    const name = parsed.data.name === undefined ? resultCreate(currentRow.name) : realmNameNormalize(parsed.data.name)
    if (!name.success) return name
    const primaryDomain =
      parsed.data.domain === undefined
        ? resultCreate(currentRow.primaryDomain)
        : realmDomainNormalize(parsed.data.domain)
    if (!primaryDomain.success) return primaryDomain

    let domains = currentDomains.data
    if (parsed.data.domains !== undefined) {
      domains = [primaryDomain.data]
      for (const candidate of parsed.data.domains) {
        const domain = realmDomainNormalize(candidate)
        if (!domain.success) return domain
        if (domains.includes(domain.data))
          return resultErrorCreate(op, "Realm domains must be unique.", "realms.domain-not-unique")
        domains.push(domain.data)
      }
    } else if (parsed.data.domain !== undefined) {
      domains = [primaryDomain.data, ...currentDomains.data.filter((domain) => domain !== currentRow.primaryDomain)]
      if (new Set(domains).size !== domains.length)
        return resultErrorCreate(op, "Realm domains must be unique.", "realms.domain-not-unique")
    }

    const version = currentRow.version + 1
    const updated = repository.realmUpdate(options.realmId, {
      name: name.data,
      primaryDomain: primaryDomain.data,
      status: parsed.data.status ?? current.data.status,
      updatedAt,
      version,
    })
    if (!updated.success) return updated
    if (updated.data === null) return resultErrorCreate(op, "The realm was not found.", "realms.not-found")

    const domainUpdate = repository.realmDomainReplace(options.realmId, domains)
    if (!domainUpdate.success) return domainUpdate

    const payloadResult = v.safeParse(realmUpdatedEventPayloadSchema, {
      domain: primaryDomain.data,
      name: name.data,
      status: updated.data.status,
    })
    if (!payloadResult.success)
      return resultErrorCreate(op, "The realm event payload is invalid.", "realms.event-invalid")
    const event = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: options.realmId,
        aggregateType: "realm",
        aggregateVersion: version,
        commandIndex: 0,
        correlationId,
        eventType: realmEventTypes.updated,
        realmId: options.realmId,
        metadata: { source: "realms" },
        occurredAt: updatedAt,
        payload: payloadResult.output,
      },
      runtime,
    )
    if (!event.success) return event

    return resultCreate({ realm: realmPublicViewCreate(updated.data, domains) })
  })
}
