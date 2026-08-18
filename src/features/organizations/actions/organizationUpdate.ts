import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { patchInputParse } from "../../../platform/http/patchInputParse.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { organizationNameNormalize } from "../domain/organizationNameNormalize.js"
import { organizationPublicViewCreate } from "../domain/organizationPublicViewCreate.js"
import { organizationEventTypes } from "../events/organizationEventTypes.js"
import { organizationUpdatedEventPayloadSchema } from "../events/organizationUpdatedEventPayloadSchema.js"
import { organizationRepositoryCreate } from "../persistence/organizationRepositoryCreate.js"
import type { Organization } from "../public/organizationSchema.js"
import {
  type OrganizationUpdateRequest,
  organizationUpdateRequestSchema,
} from "../public/organizationUpdateRequestSchema.js"
import { organizationContextAuthorize } from "./organizationContextAuthorize.js"

type OrganizationUpdateOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly input: OrganizationUpdateRequest
  readonly realmId: string
  readonly organizationId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function organizationUpdate(options: OrganizationUpdateOptions): Result<{ organization: Organization }> {
  const op = "organizationUpdate"
  const parsed = patchInputParse(
    op,
    organizationUpdateRequestSchema,
    options.input,
    "organizations.empty-patch",
    "organizations.invalid",
  )
  if (!parsed.success) return parsed
  if (options.context.kind === "tenant" && options.context.realmId !== options.realmId)
    return resultErrorCodedCreate(
      op,
      "The organization is not available in this tenant context.",
      "organizations.tenant-mismatch",
    )
  const runtime = options.runtime ?? options.database.runtime
  const updatedAt = runtime.now()
  if (!Number.isSafeInteger(updatedAt) || updatedAt < 0)
    return resultErrorCodedCreate(op, "The organization timestamp is invalid.", "organizations.invalid-timestamp")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  return storageTransactionRun(options.database, (transaction) => {
    const repository = organizationRepositoryCreate(transaction)
    const current = repository.organizationGet(options.organizationId)
    if (!current.success) return current
    if (current.data === null || current.data.realmId !== options.realmId || current.data.status !== "active")
      return resultErrorCodedCreate(op, "The organization was not found.", "organizations.not-found")
    const authorized = organizationContextAuthorize({
      context: options.context,
      organization: current.data,
      repository,
      requiredPermission: "organization.manage",
    })
    if (!authorized.success) return authorized
    const name = organizationNameNormalize(parsed.data.name ?? current.data.name)
    if (!name.success) return name
    const updated = repository.organizationUpdate(options.organizationId, {
      name: name.data,
      updatedAt,
      version: current.data.version + 1,
    })
    if (!updated.success)
      return resultErrorCodedCreate(
        op,
        "An organization with that name already exists in this realm.",
        "organizations.already-exists",
      )
    if (updated.data === null)
      return resultErrorCodedCreate(op, "The organization was not found.", "organizations.not-found")
    const payload = v.safeParse(organizationUpdatedEventPayloadSchema, { name: name.data })
    if (!payload.success)
      return resultErrorCodedCreate(op, "The organization event payload is invalid.", "organizations.event-invalid")
    const event = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: options.organizationId,
        aggregateType: "organization",
        aggregateVersion: updated.data.version,
        commandIndex: 0,
        correlationId,
        eventType: organizationEventTypes.updated,
        realmId: options.realmId,
        metadata: { source: "organizations" },
        occurredAt: updatedAt,
        payload: payload.output,
      },
      runtime,
    )
    if (!event.success) return event
    return resultCreate({ organization: organizationPublicViewCreate(updated.data) })
  })
}
