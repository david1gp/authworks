import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { organizationLoginPolicyOverrideViewCreate } from "../domain/organizationLoginPolicyOverrideViewCreate.js"
import { organizationLoginPolicyRepositoryCreate } from "../persistence/organizationLoginPolicyRepositoryCreate.js"
import type { OrganizationLoginPolicyResponse } from "../public/organizationLoginPolicyResponseSchema.js"
import { organizationLoginPolicyResolve } from "../public/organizationLoginPolicyResolve.js"

type OrganizationInstanceLoginPolicyGetOptions = {
  readonly database: StorageDatabase
  readonly instanceId: string
}

export function organizationInstanceLoginPolicyGet(
  options: OrganizationInstanceLoginPolicyGetOptions,
): Result<OrganizationLoginPolicyResponse> {
  const policy = organizationLoginPolicyResolve(options)
  if (!policy.success) return policy
  const override = organizationLoginPolicyRepositoryCreate(options.database.db).instanceLoginPolicyGet(
    options.instanceId,
  )
  if (!override.success) return override
  return resultCreate({
    instanceId: options.instanceId,
    organizationId: null,
    overrides: organizationLoginPolicyOverrideViewCreate(override.data),
    policy: policy.data,
  })
}
