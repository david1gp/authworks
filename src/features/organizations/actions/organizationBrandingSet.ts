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
import { organizationBrandingChangedEventPayloadSchema } from "../events/organizationBrandingChangedEventPayloadSchema.js"
import { organizationEventTypes } from "../events/organizationEventTypes.js"
import { organizationBrandingRepositoryCreate } from "../persistence/organizationBrandingRepositoryCreate.js"
import { organizationRepositoryCreate } from "../persistence/organizationRepositoryCreate.js"
import type { OrganizationBrandingResponse } from "../public/organizationBrandingResponseSchema.js"
import {
  type OrganizationBrandingSetRequest,
  organizationBrandingSetRequestSchema,
} from "../public/organizationBrandingSetRequestSchema.js"
import { organizationContextAuthorize } from "./organizationContextAuthorize.js"

type OrganizationBrandingSetOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly input: OrganizationBrandingSetRequest
  readonly realmId: string
  readonly organizationId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function organizationBrandingSet(options: OrganizationBrandingSetOptions): Result<OrganizationBrandingResponse> {
  const op = "organizationBrandingSet"
  const parsed = v.safeParse(organizationBrandingSetRequestSchema, options.input)
  if (!parsed.success)
    return resultErrorCodedCreate(op, "The organization branding is invalid.", "organizations.invalid")
  if (options.context.kind === "tenant" && options.context.realmId !== options.realmId)
    return resultErrorCodedCreate(
      op,
      "The organization is not available in this tenant context.",
      "organizations.tenant-mismatch",
    )
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0)
    return resultErrorCodedCreate(op, "The branding timestamp is invalid.", "organizations.invalid-timestamp")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  return storageTransactionRun(options.database, (transaction) => {
    const organizations = organizationRepositoryCreate(transaction)
    const organization = organizations.organizationGet(options.organizationId)
    if (!organization.success) return organization
    if (
      organization.data === null ||
      organization.data.realmId !== options.realmId ||
      organization.data.status !== "active"
    )
      return resultErrorCodedCreate(op, "The organization was not found.", "organizations.not-found")
    const authorized = organizationContextAuthorize({
      context: options.context,
      organization: organization.data,
      repository: organizations,
      requiredPermission: "organization.manage",
    })
    if (!authorized.success) return authorized
    const repository = organizationBrandingRepositoryCreate(transaction)
    const current = repository.organizationBrandingGet(options.organizationId)
    if (!current.success) return current
    const version = (current.data?.version ?? 0) + 1
    const saved =
      current.data === null
        ? repository.organizationBrandingCreate({
            branding: JSON.stringify(parsed.output),
            realmId: options.realmId,
            organizationId: options.organizationId,
            updatedAt: now,
            version,
          })
        : repository.organizationBrandingUpdate(options.organizationId, {
            branding: JSON.stringify(parsed.output),
            updatedAt: now,
            version,
          })
    if (!saved.success) return saved
    if (saved.data === null)
      return resultErrorCodedCreate(op, "The organization branding could not be saved.", "organizations.write-failed")
    const payload = v.safeParse(organizationBrandingChangedEventPayloadSchema, {
      organizationId: options.organizationId,
      version,
    })
    if (!payload.success)
      return resultErrorCodedCreate(op, "The branding event payload is invalid.", "organizations.event-invalid")
    const event = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: options.organizationId,
        aggregateType: "organization_branding",
        aggregateVersion: version,
        commandIndex: 0,
        correlationId,
        eventType: organizationEventTypes.brandingChanged,
        realmId: options.realmId,
        metadata: { source: "organizations" },
        occurredAt: now,
        payload: payload.output,
      },
      runtime,
    )
    if (!event.success) return event
    return resultCreate({
      branding: parsed.output,
      organizationId: options.organizationId,
      updatedAt: now,
      version,
    })
  })
}
