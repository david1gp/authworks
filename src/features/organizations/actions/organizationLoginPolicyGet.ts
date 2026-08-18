import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { organizationLoginPolicyOverrideViewCreate } from "../domain/organizationLoginPolicyOverrideViewCreate.js"
import { organizationLoginPolicyRepositoryCreate } from "../persistence/organizationLoginPolicyRepositoryCreate.js"
import { organizationRepositoryCreate } from "../persistence/organizationRepositoryCreate.js"
import type { OrganizationLoginPolicyResponse } from "../public/organizationLoginPolicyResponseSchema.js"
import { organizationLoginPolicyResolve } from "./organizationLoginPolicyResolve.js"

type OrganizationLoginPolicyGetOptions = {
  readonly database: StorageDatabase
  readonly realmId: string
  readonly organizationId: string
}

export function organizationLoginPolicyGet(
  options: OrganizationLoginPolicyGetOptions,
): Result<OrganizationLoginPolicyResponse> {
  const organization = organizationRepositoryCreate(options.database.db).organizationGet(options.organizationId)
  if (!organization.success) return organization
  if (
    organization.data === null ||
    organization.data.realmId !== options.realmId ||
    organization.data.status !== "active"
  )
    return resultErrorCodedCreate(
      "organizationLoginPolicyGet",
      "The organization was not found.",
      "organizations.not-found",
    )
  const policy = organizationLoginPolicyResolve(options)
  if (!policy.success) return policy
  const override = organizationLoginPolicyRepositoryCreate(options.database.db).organizationLoginPolicyGet(
    options.organizationId,
  )
  if (!override.success) return override
  return resultCreate({
    realmId: options.realmId,
    organizationId: options.organizationId,
    overrides: organizationLoginPolicyOverrideViewCreate(override.data),
    policy: policy.data,
  })
}
