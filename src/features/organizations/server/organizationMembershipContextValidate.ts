import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { organizationRepositoryCreate } from "../persistence/organizationRepositoryCreate.js"
import { organizationLoginContextResolve } from "./organizationLoginContextResolve.js"

type OrganizationMembershipContextValidateOptions = {
  readonly executor: StorageExecutor
  readonly organizationId: string
  readonly realmId: string
  readonly userId: string
}

export function organizationMembershipContextValidate(
  options: OrganizationMembershipContextValidateOptions,
): Result<void> {
  const op = "organizationMembershipContextValidate"
  const context = organizationLoginContextResolve({
    executor: options.executor,
    organizationId: options.organizationId,
    realmId: options.realmId,
  })
  if (!context.success)
    return resultErrorCodedCreate(op, "The organization membership context is unavailable.", "organizations.not-found")
  const membership = organizationRepositoryCreate(options.executor).organizationMembershipGetByOrganizationUser(
    options.organizationId,
    options.userId,
  )
  if (!membership.success) return membership
  if (membership.data === null || membership.data.realmId !== options.realmId)
    return resultErrorCodedCreate(
      op,
      "The user is not an active member of this organization.",
      "organizations.not-member",
    )
  return resultCreate(undefined)
}
