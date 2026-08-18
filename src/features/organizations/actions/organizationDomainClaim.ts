import { createHash } from "node:crypto"
import * as v from "valibot"
import { and, eq } from "drizzle-orm"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { realmDomainNormalize } from "../../realms/domain/realmDomainNormalize.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { realmDomainTable } from "../../realms/persistence/realmDomainTable.js"
import { organizationDomainTable } from "../persistence/organizationDomainTable.js"
import { organizationDomainAddedEventPayloadSchema } from "../events/organizationDomainAddedEventPayloadSchema.js"
import { organizationEventTypes } from "../events/organizationEventTypes.js"
import { organizationDomainPublicViewCreate } from "../domain/organizationDomainPublicViewCreate.js"
import { organizationDomainVerificationRecordNameCreate } from "../domain/organizationDomainVerificationRecordNameCreate.js"
import { organizationDomainVerificationValueCreate } from "../domain/organizationDomainVerificationValueCreate.js"
import { organizationDomainRepositoryCreate } from "../persistence/organizationDomainRepositoryCreate.js"
import { organizationRepositoryCreate } from "../persistence/organizationRepositoryCreate.js"
import type { OrganizationDomainResponse } from "../public/organizationDomainResponseSchema.js"
import {
  type OrganizationDomainClaimRequest,
  organizationDomainClaimRequestSchema,
} from "../public/organizationDomainClaimRequestSchema.js"
import { organizationContextAuthorize } from "./organizationContextAuthorize.js"

type OrganizationDomainClaimOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly input: OrganizationDomainClaimRequest
  readonly realmId: string
  readonly organizationId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function organizationDomainClaim(options: OrganizationDomainClaimOptions): Result<OrganizationDomainResponse> {
  const op = "organizationDomainClaim"
  const parsed = v.safeParse(organizationDomainClaimRequestSchema, options.input)
  if (!parsed.success)
    return resultErrorCodedCreate(op, "The organization domain claim is invalid.", "organizations.invalid-domain")
  if (options.context.kind === "tenant" && options.context.realmId !== options.realmId)
    return resultErrorCodedCreate(
      op,
      "The organization is not available in this tenant context.",
      "organizations.tenant-mismatch",
    )
  const domain = realmDomainNormalize(parsed.output.domain)
  if (!domain.success) return domain
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0)
    return resultErrorCodedCreate(op, "The domain timestamp is invalid.", "organizations.invalid-timestamp")
  const token = organizationDomainVerificationValueCreate(runtime)
  const tokenHash = createHash("sha256").update(token, "utf8").digest("hex")
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
    const realmDomain = transaction
      .select({ domain: realmDomainTable.domain })
      .from(realmDomainTable)
      .where(eq(realmDomainTable.domain, domain.data))
      .get()
    if (realmDomain !== undefined)
      return resultErrorCodedCreate(op, "The domain is already assigned to a realm.", "organizations.domain-assigned")
    const domains = organizationDomainRepositoryCreate(transaction)
    const current = domains.organizationDomainGet(domain.data)
    if (!current.success) return current
    if (current.data !== null)
      return resultErrorCodedCreate(op, "The domain is already claimed.", "organizations.already-exists")
    const existing = domains.organizationDomainList(options.organizationId)
    if (!existing.success) return existing
    const isPrimary = parsed.output.isPrimary === true || existing.data.length === 0
    if (isPrimary) {
      transaction
        .update(organizationDomainTable)
        .set({ isPrimary: false })
        .where(eq(organizationDomainTable.organizationId, options.organizationId))
        .run()
    }
    const created = domains.organizationDomainCreate({
      createdAt: now,
      domain: domain.data,
      realmId: options.realmId,
      isPrimary,
      organizationId: options.organizationId,
      updatedAt: now,
      verificationTokenHash: tokenHash,
      verified: false,
      version: 1,
    })
    if (!created.success)
      return resultErrorCodedCreate(op, "The domain is already claimed.", "organizations.already-exists")
    const payload = v.safeParse(organizationDomainAddedEventPayloadSchema, {
      domain: domain.data,
      isPrimary,
      verified: false,
    })
    if (!payload.success)
      return resultErrorCodedCreate(op, "The domain event payload is invalid.", "organizations.event-invalid")
    const event = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: domain.data,
        aggregateType: "organization_domain",
        aggregateVersion: 1,
        commandIndex: 0,
        correlationId,
        eventType: organizationEventTypes.domainAdded,
        realmId: options.realmId,
        metadata: { source: "organizations" },
        occurredAt: now,
        payload: payload.output,
      },
      runtime,
    )
    if (!event.success) return event
    return resultCreate({
      domain: {
        ...organizationDomainPublicViewCreate(created.data),
        verification: {
          recordName: organizationDomainVerificationRecordNameCreate(domain.data),
          recordType: "TXT" as const,
          recordValue: token,
        },
      },
    })
  })
}
