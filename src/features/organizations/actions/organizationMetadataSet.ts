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
import { organizationMetadataSetEventPayloadSchema } from "../events/organizationMetadataSetEventPayloadSchema.js"
import { organizationMetadataRepositoryCreate } from "../persistence/organizationMetadataRepositoryCreate.js"
import { organizationRepositoryCreate } from "../persistence/organizationRepositoryCreate.js"
import { organizationMetadataKeySchema } from "../public/organizationMetadataKeySchema.js"
import type { OrganizationMetadata } from "../public/organizationMetadataSchema.js"
import {
  type OrganizationMetadataSetRequest,
  organizationMetadataSetRequestSchema,
} from "../public/organizationMetadataSetRequestSchema.js"
import { organizationMetadataAuthorize } from "./organizationMetadataAuthorize.js"

const organizationMetadataMaximumEntries = 50

type OrganizationMetadataSetOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly input: OrganizationMetadataSetRequest
  readonly key: string
  readonly organizationId: string
  readonly realmId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function organizationMetadataSet(
  options: OrganizationMetadataSetOptions,
): Result<{ metadata: OrganizationMetadata }> {
  const op = "organizationMetadataSet"
  if (!v.safeParse(organizationMetadataKeySchema, options.key).success)
    return resultErrorCodedCreate(op, "The metadata key is invalid.", "organizations.invalid")
  const parsed = v.safeParse(organizationMetadataSetRequestSchema, options.input)
  if (!parsed.success)
    return resultErrorCodedCreate(op, "The organization metadata is invalid.", "organizations.invalid")
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
    const current = repository.organizationMetadataGet(options.realmId, options.organizationId, options.key)
    if (!current.success) return current
    if (current.data === null) {
      const count = repository.organizationMetadataCount(options.realmId, options.organizationId)
      if (!count.success) return count
      if (count.data >= organizationMetadataMaximumEntries)
        return resultErrorCodedCreate(
          op,
          "The organization metadata limit was reached.",
          "organizations.metadata-limit",
        )
    }
    const version = (current.data?.version ?? 0) + 1
    const saved = repository.organizationMetadataUpsert({
      createdAt: current.data?.createdAt ?? now,
      key: options.key,
      organizationId: options.organizationId,
      realmId: options.realmId,
      updatedAt: now,
      value: parsed.output.value,
      version,
    })
    if (!saved.success) return saved
    const payload = v.safeParse(organizationMetadataSetEventPayloadSchema, {
      key: options.key,
      organizationId: options.organizationId,
      version,
    })
    if (!payload.success)
      return resultErrorCodedCreate(op, "The metadata event payload is invalid.", "organizations.event-invalid")
    const event = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: options.organizationId,
        aggregateType: "organization_metadata",
        aggregateVersion: version,
        commandIndex: 0,
        correlationId,
        eventType: organizationEventTypes.metadataSet,
        metadata: { source: "organizations" },
        occurredAt: now,
        payload: payload.output,
        realmId: options.realmId,
      },
      runtime,
    )
    if (!event.success) return event
    return resultCreate({
      metadata: {
        createdAt: saved.data.createdAt,
        key: saved.data.key,
        organizationId: saved.data.organizationId,
        updatedAt: saved.data.updatedAt,
        value: saved.data.value,
        version: saved.data.version,
      },
    })
  })
}
