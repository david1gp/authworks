import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { organizationEventTypes } from "../events/organizationEventTypes.js"
import { organizationMetadataRemovedEventPayloadSchema } from "../events/organizationMetadataRemovedEventPayloadSchema.js"
import { organizationMetadataRepositoryCreate } from "../persistence/organizationMetadataRepositoryCreate.js"
import { organizationRepositoryCreate } from "../persistence/organizationRepositoryCreate.js"
import { organizationMetadataKeySchema } from "../public/organizationMetadataKeySchema.js"
import { organizationMetadataAuthorize } from "./organizationMetadataAuthorize.js"

type OrganizationMetadataRemoveOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly key: string
  readonly organizationId: string
  readonly realmId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function organizationMetadataRemove(options: OrganizationMetadataRemoveOptions): Result<{ removed: true }> {
  const op = "organizationMetadataRemove"
  if (!v.safeParse(organizationMetadataKeySchema, options.key).success)
    return resultErrorCodedCreate(op, "The metadata key is invalid.", "organizations.invalid")
  const organizations = organizationRepositoryCreate(options.database.db)
  const organization = organizations.organizationGet(options.organizationId)
  if (!organization.success) return organization
  if (
    organization.data === null ||
    organization.data.realmId !== options.realmId ||
    organization.data.status !== "active"
  )
    return resultErrorCodedCreate(op, "The organization was not found.", "organizations.not-found")
  const authorized = organizationMetadataAuthorize({
    context: options.context,
    database: options.database,
    organization: organization.data,
    repository: organizations,
    requiredPermission: "organization.manage",
  })
  if (!authorized.success) return authorized
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0)
    return resultErrorCodedCreate(op, "The metadata timestamp is invalid.", "organizations.invalid-timestamp")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  return storageTransactionRun(options.database, (transaction) => {
    const repository = organizationMetadataRepositoryCreate(transaction)
    const removed = repository.organizationMetadataDelete(options.realmId, options.organizationId, options.key)
    if (!removed.success) return removed
    if (removed.data === null)
      return resultErrorCodedCreate(op, "The organization metadata was not found.", "organizations.not-found")
    const payload = v.safeParse(organizationMetadataRemovedEventPayloadSchema, {
      key: options.key,
      organizationId: options.organizationId,
    })
    if (!payload.success)
      return resultErrorCodedCreate(op, "The metadata event payload is invalid.", "organizations.event-invalid")
    const event = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: options.organizationId,
        aggregateType: "organization_metadata",
        aggregateVersion: removed.data.version + 1,
        commandIndex: 0,
        correlationId,
        eventType: organizationEventTypes.metadataRemoved,
        metadata: { source: "organizations" },
        occurredAt: now,
        payload: payload.output,
        realmId: options.realmId,
      },
      runtime,
    )
    if (!event.success) return event
    return resultCreate({ removed: true as const })
  })
}
