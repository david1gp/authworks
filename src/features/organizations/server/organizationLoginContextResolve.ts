import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { realmLoginContextResolve } from "../../realms/server/realmLoginContextResolve.js"
import type { OrganizationLoginContext } from "../public/organizationLoginContextSchema.js"
import { organizationRepositoryCreate } from "../persistence/organizationRepositoryCreate.js"

type OrganizationLoginContextResolveOptions = {
  readonly executor: StorageExecutor
  readonly organizationId?: string | null
  readonly realmId: string
}

export function organizationLoginContextResolve(
  options: OrganizationLoginContextResolveOptions,
): Result<OrganizationLoginContext> {
  const op = "organizationLoginContextResolve"
  if (options.realmId.length === 0)
    return resultErrorCodedCreate(op, "The organization login context is invalid.", "organizations.not-found")
  const realm = realmLoginContextResolve({ executor: options.executor, realmId: options.realmId })
  if (!realm.success)
    return resultErrorCodedCreate(op, "The organization login context is unavailable.", "organizations.not-found")
  if (options.organizationId === undefined || options.organizationId === null)
    return resultCreate({ realmId: options.realmId })
  const organization = organizationRepositoryCreate(options.executor).organizationGet(options.organizationId)
  if (!organization.success) return organization
  if (
    organization.data === null ||
    organization.data.realmId !== options.realmId ||
    organization.data.status !== "active"
  )
    return resultErrorCodedCreate(op, "The organization login context is unavailable.", "organizations.not-found")
  return resultCreate({ organizationId: organization.data.id, realmId: organization.data.realmId })
}
