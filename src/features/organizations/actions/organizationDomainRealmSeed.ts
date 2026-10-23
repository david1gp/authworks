import { createHash } from "node:crypto"
import { eq } from "drizzle-orm"
import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { realmDomainNormalize } from "../../realms/domain/realmDomainNormalize.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import { realmDomainTable } from "../../realms/persistence/realmDomainTable.js"
import { organizationDomainPublicViewCreate } from "../domain/organizationDomainPublicViewCreate.js"
import { organizationDomainAddedEventPayloadSchema } from "../events/organizationDomainAddedEventPayloadSchema.js"
import { organizationDomainVerifiedEventPayloadSchema } from "../events/organizationDomainVerifiedEventPayloadSchema.js"
import { organizationEventTypes } from "../events/organizationEventTypes.js"
import { organizationDomainRepositoryCreate } from "../persistence/organizationDomainRepositoryCreate.js"
import { organizationDomainTable } from "../persistence/organizationDomainTable.js"
import { organizationRepositoryCreate } from "../persistence/organizationRepositoryCreate.js"
import type { OrganizationDomainResponse } from "../public/organizationDomainResponseSchema.js"

type OrganizationDomainRealmSeedOptions = {
  readonly context: RealmSystemContext
  readonly database: StorageDatabase
  readonly domain: string
  readonly realmId: string
  readonly organizationId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

/**
 * Seeds a realm domain as a verified organization domain without DNS proof.
 * System-only: a realm controller owns both the realm domain and the tenant organization,
 * so no external ownership proof is required (same ownership as the zitadel import path).
 */
export function organizationDomainRealmSeed(
  options: OrganizationDomainRealmSeedOptions,
): Result<OrganizationDomainResponse> {
  const op = "organizationDomainRealmSeed"
  if (options.context?.kind !== "system")
    return resultErrorCreate(op, "Only the system context can seed realm domains.", "organizations.system-required")
  const normalized = realmDomainNormalize(options.domain)
  if (!normalized.success) return normalized
  const domain = normalized.data
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0)
    return resultErrorCreate(op, "The domain timestamp is invalid.", "organizations.invalid-timestamp")
  const tokenHash = createHash("sha256").update(uuidv7Create(runtime), "utf8").digest("hex")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  return storageTransactionRun(options.database, (transaction) => {
    const realmDomain = transaction
      .select({ realmId: realmDomainTable.realmId })
      .from(realmDomainTable)
      .where(eq(realmDomainTable.domain, domain))
      .get()
    if (realmDomain === undefined || realmDomain.realmId !== options.realmId)
      return resultErrorCreate(
        op,
        "Only a domain of the same realm can be seeded.",
        "organizations.domain-not-realm-domain",
      )
    const organizations = organizationRepositoryCreate(transaction)
    const organization = organizations.organizationGet(options.organizationId)
    if (!organization.success) return organization
    if (
      organization.data === null ||
      organization.data.realmId !== options.realmId ||
      organization.data.status !== "active"
    )
      return resultErrorCreate(op, "The organization was not found.", "organizations.not-found")
    const domains = organizationDomainRepositoryCreate(transaction)
    const current = domains.organizationDomainGet(domain)
    if (!current.success) return current
    if (current.data !== null) {
      if (
        current.data.organizationId !== options.organizationId ||
        current.data.realmId !== options.realmId ||
        !current.data.verified
      )
        return resultErrorCreate(op, "The domain is already claimed.", "organizations.already-exists")
      return resultCreate({ domain: organizationDomainPublicViewCreate(current.data) })
    }
    const existing = domains.organizationDomainList(options.organizationId)
    if (!existing.success) return existing
    const isPrimary = existing.data.length === 0
    if (isPrimary) {
      transaction
        .update(organizationDomainTable)
        .set({ isPrimary: false })
        .where(eq(organizationDomainTable.organizationId, options.organizationId))
        .run()
    }
    const created = domains.organizationDomainCreate({
      createdAt: now,
      domain,
      realmId: options.realmId,
      isPrimary,
      organizationId: options.organizationId,
      updatedAt: now,
      verificationTokenHash: tokenHash,
      verified: true,
      version: 1,
    })
    if (!created.success) return resultErrorCreate(op, "The domain is already claimed.", "organizations.already-exists")
    const addedPayload = v.safeParse(organizationDomainAddedEventPayloadSchema, {
      domain,
      isPrimary,
      verified: true,
    })
    if (!addedPayload.success)
      return resultErrorCreate(op, "The domain event payload is invalid.", "organizations.event-invalid")
    const added = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: domain,
        aggregateType: "organization_domain",
        aggregateVersion: 1,
        commandIndex: 0,
        correlationId,
        eventType: organizationEventTypes.domainAdded,
        realmId: options.realmId,
        metadata: { source: "organizations" },
        occurredAt: now,
        payload: addedPayload.output,
      },
      runtime,
    )
    if (!added.success) return added
    const verifiedPayload = v.safeParse(organizationDomainVerifiedEventPayloadSchema, { domain, verified: true })
    if (!verifiedPayload.success)
      return resultErrorCreate(op, "The domain event payload is invalid.", "organizations.event-invalid")
    const verified = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: domain,
        aggregateType: "organization_domain",
        aggregateVersion: 1,
        commandIndex: 1,
        correlationId,
        eventType: organizationEventTypes.domainVerified,
        realmId: options.realmId,
        metadata: { source: "organizations" },
        occurredAt: now,
        payload: verifiedPayload.output,
      },
      runtime,
    )
    if (!verified.success) return verified
    return resultCreate({ domain: organizationDomainPublicViewCreate(created.data) })
  })
}
