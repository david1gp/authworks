import { type Result } from "#result"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import type { OrganizationLoginContext } from "../public/organizationLoginContextSchema.js"
import { organizationLoginContextResolve } from "./organizationLoginContextResolve.js"

type OrganizationLoginContextValidateOptions = {
  readonly context: OrganizationLoginContext
  readonly executor: StorageExecutor
  readonly expectedOrganizationId?: string
  readonly expectedRealmId: string
}

export function organizationLoginContextValidate(
  options: OrganizationLoginContextValidateOptions,
): Result<OrganizationLoginContext> {
  const op = "organizationLoginContextValidate"
  if (options.context.realmId !== options.expectedRealmId)
    return resultErrorCodedCreate(
      op,
      "The organization login context does not match the realm.",
      "organizations.not-found",
    )
  if (options.expectedOrganizationId !== undefined && options.context.organizationId !== options.expectedOrganizationId)
    return resultErrorCodedCreate(
      op,
      "The organization login context does not match the requested organization.",
      "organizations.not-found",
    )
  return organizationLoginContextResolve({
    executor: options.executor,
    organizationId: options.context.organizationId,
    realmId: options.expectedRealmId,
  })
}
