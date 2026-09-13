import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { organizationDomainRepositoryCreate } from "../persistence/organizationDomainRepositoryCreate.js"
import { organizationRepositoryCreate } from "../persistence/organizationRepositoryCreate.js"

type OrganizationPrimaryDomainResolveOptions = {
  readonly executor: StorageExecutor
  readonly organizationId: string
  readonly realmId: string
}

export function organizationPrimaryDomainResolve(
  options: OrganizationPrimaryDomainResolveOptions,
): Result<string | undefined> {
  const organization = organizationRepositoryCreate(options.executor).organizationGet(options.organizationId)
  if (!organization.success) return organization
  if (
    organization.data === null ||
    organization.data.realmId !== options.realmId ||
    organization.data.status !== "active"
  )
    return resultCreate(undefined)

  const domains = organizationDomainRepositoryCreate(options.executor).organizationDomainList(options.organizationId)
  if (!domains.success) return domains
  const primary = domains.data.find(
    (domain) =>
      domain.realmId === options.realmId &&
      domain.organizationId === options.organizationId &&
      domain.isPrimary &&
      domain.verified,
  )
  return resultCreate(primary?.domain)
}
