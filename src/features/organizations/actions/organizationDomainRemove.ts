import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { realmDomainNormalize } from "../../realms/domain/realmDomainNormalize.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import { organizationDomainRemovedEventPayloadSchema } from "../events/organizationDomainRemovedEventPayloadSchema.js"
import { organizationEventTypes } from "../events/organizationEventTypes.js"
import { organizationDomainRepositoryCreate } from "../persistence/organizationDomainRepositoryCreate.js"
import { organizationRepositoryCreate } from "../persistence/organizationRepositoryCreate.js"
import { organizationContextAuthorize } from "./organizationContextAuthorize.js"

type OrganizationDomainRemoveOptions = {
  readonly context: RealmSystemContext
  readonly database: StorageDatabase
  readonly domain: string
  readonly realmId: string
  readonly organizationId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function organizationDomainRemove(options: OrganizationDomainRemoveOptions): Result<{ removed: true }> {
  const op = "organizationDomainRemove"
  const normalized = realmDomainNormalize(options.domain)
  if (!normalized.success) return resultErrorCreate(op, "The organization domain is invalid.")
  const domain = normalized.data
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  return storageTransactionRun(options.database, (transaction) => {
    const organizations = organizationRepositoryCreate(transaction)
    const organization = organizations.organizationGet(options.organizationId)
    if (!organization.success) return organization
    if (
      organization.data === null ||
      organization.data.realmId !== options.realmId ||
      organization.data.status === "removed"
    )
      return resultErrorCreate(op, "The organization was not found.")
    const authorized = organizationContextAuthorize({
      context: options.context,
      organization: organization.data,
      repository: organizations,
      requiredPermission: "organization.manage",
    })
    if (!authorized.success) return authorized
    const repository = organizationDomainRepositoryCreate(transaction)
    const current = repository.organizationDomainGet(domain)
    if (!current.success) return current
    if (current.data === null || current.data.organizationId !== options.organizationId)
      return resultErrorCreate(op, "The organization domain was not found.")
    const domains = repository.organizationDomainList(options.organizationId)
    if (!domains.success) return domains
    if (current.data.isPrimary && domains.data.length > 1)
      return resultErrorCreate(op, "The primary organization domain must be changed before removal.")
    const removed = repository.organizationDomainDelete(domain, options.organizationId)
    if (!removed.success) return removed
    if (removed.data === null) return resultErrorCreate(op, "The organization domain was not found.")
    const payload = v.safeParse(organizationDomainRemovedEventPayloadSchema, { domain })
    if (!payload.success) return resultErrorCreate(op, "The domain event payload is invalid.")
    const event = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: domain,
        aggregateType: "organization_domain",
        aggregateVersion: removed.data.version + 1,
        commandIndex: 0,
        correlationId,
        eventType: organizationEventTypes.domainRemoved,
        realmId: options.realmId,
        metadata: { source: "organizations" },
        occurredAt: now,
        payload: payload.output,
      },
      runtime,
    )
    if (!event.success) return event
    return resultCreate({ removed: true as const })
  })
}
