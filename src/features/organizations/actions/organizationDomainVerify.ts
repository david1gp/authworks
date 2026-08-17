import { createHash } from "node:crypto"
import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { instanceDomainNormalize } from "../../instances/domain/instanceDomainNormalize.js"
import type { InstanceSystemContext } from "../../instances/domain/instanceSystemContext.js"
import { organizationDomainVerifiedEventPayloadSchema } from "../events/organizationDomainVerifiedEventPayloadSchema.js"
import { organizationEventTypes } from "../events/organizationEventTypes.js"
import { organizationDomainPublicViewCreate } from "../domain/organizationDomainPublicViewCreate.js"
import { organizationDomainVerificationRecordNameCreate } from "../domain/organizationDomainVerificationRecordNameCreate.js"
import type { OrganizationDomainDnsVerificationPort } from "../domain/organizationDomainDnsVerificationPort.js"
import { organizationDomainRepositoryCreate } from "../persistence/organizationDomainRepositoryCreate.js"
import { organizationRepositoryCreate } from "../persistence/organizationRepositoryCreate.js"
import type { OrganizationDomainResponse } from "../public/organizationDomainResponseSchema.js"
import { organizationContextAuthorize } from "./organizationContextAuthorize.js"

type OrganizationDomainVerifyOptions = {
  readonly context: InstanceSystemContext
  readonly database: StorageDatabase
  readonly dnsPort: OrganizationDomainDnsVerificationPort
  readonly domain: string
  readonly instanceId: string
  readonly organizationId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export async function organizationDomainVerify(
  options: OrganizationDomainVerifyOptions,
): Promise<Result<OrganizationDomainResponse>> {
  const op = "organizationDomainVerify"
  const normalized = instanceDomainNormalize(options.domain)
  if (!normalized.success) return resultErrorCreate(op, "The organization domain is invalid.")
  const domain = normalized.data
  const organizations = organizationRepositoryCreate(options.database.db)
  const organization = organizations.organizationGet(options.organizationId)
  if (!organization.success) return organization
  if (
    organization.data === null ||
    organization.data.instanceId !== options.instanceId ||
    organization.data.status !== "active"
  )
    return resultErrorCreate(op, "The organization domain was not found.")
  const authorized = organizationContextAuthorize({
    context: options.context,
    organization: organization.data,
    repository: organizations,
    requiredPermission: "organization.manage",
  })
  if (!authorized.success) return authorized
  const repository = organizationDomainRepositoryCreate(options.database.db)
  const current = repository.organizationDomainGet(domain)
  if (!current.success) return current
  if (current.data === null || current.data.organizationId !== options.organizationId)
    return resultErrorCreate(op, "The organization domain was not found.")
  if (current.data.verified) return resultCreate({ domain: organizationDomainPublicViewCreate(current.data) })

  // DNS is an external network port and is intentionally called before the commit transaction.
  const recordName = organizationDomainVerificationRecordNameCreate(domain)
  const records = await options.dnsPort.txtRecordsGet(recordName)
  if (!records.success) return resultErrorCreate(op, "The domain verification record could not be read.")
  const expectedHash = current.data.verificationTokenHash
  const verified = records.data.some(
    (record) => createHash("sha256").update(record, "utf8").digest("hex") === expectedHash,
  )
  if (!verified) return resultErrorCreate(op, "The domain verification record was not found.")

  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0) return resultErrorCreate(op, "The domain timestamp is invalid.")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  return storageTransactionRun(options.database, (transaction) => {
    const currentRepository = organizationDomainRepositoryCreate(transaction)
    const latest = currentRepository.organizationDomainGet(domain)
    if (!latest.success) return latest
    if (
      latest.data === null ||
      latest.data.organizationId !== options.organizationId ||
      latest.data.verificationTokenHash !== expectedHash
    )
      return resultErrorCreate(op, "The domain verification state changed.")
    if (latest.data.verified) return resultCreate({ domain: organizationDomainPublicViewCreate(latest.data) })
    const updated = currentRepository.organizationDomainUpdate(domain, {
      updatedAt: now,
      verified: true,
      version: latest.data.version + 1,
    })
    if (!updated.success) return updated
    if (updated.data === null) return resultErrorCreate(op, "The organization domain was not found.")
    const payload = v.safeParse(organizationDomainVerifiedEventPayloadSchema, { domain, verified: true })
    if (!payload.success) return resultErrorCreate(op, "The domain event payload is invalid.")
    const event = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: domain,
        aggregateType: "organization_domain",
        aggregateVersion: updated.data.version,
        commandIndex: 0,
        correlationId,
        eventType: organizationEventTypes.domainVerified,
        instanceId: options.instanceId,
        metadata: { source: "organizations" },
        occurredAt: now,
        payload: payload.output,
      },
      runtime,
    )
    if (!event.success) return event
    return resultCreate({ domain: organizationDomainPublicViewCreate(updated.data) })
  })
}
