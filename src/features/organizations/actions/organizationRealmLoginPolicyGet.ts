import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { organizationLoginPolicyOverrideViewCreate } from "../domain/organizationLoginPolicyOverrideViewCreate.js"
import { organizationLoginPolicyRepositoryCreate } from "../persistence/organizationLoginPolicyRepositoryCreate.js"
import type { OrganizationLoginPolicyResponse } from "../public/organizationLoginPolicyResponseSchema.js"
import { organizationLoginPolicyResolve } from "../public/organizationLoginPolicyResolve.js"

type OrganizationRealmLoginPolicyGetOptions = {
  readonly database: StorageDatabase
  readonly realmId: string
}

export function organizationRealmLoginPolicyGet(
  options: OrganizationRealmLoginPolicyGetOptions,
): Result<OrganizationLoginPolicyResponse> {
  const policy = organizationLoginPolicyResolve(options)
  if (!policy.success) return policy
  const override = organizationLoginPolicyRepositoryCreate(options.database.db).realmLoginPolicyGet(options.realmId)
  if (!override.success) return override
  return resultCreate({
    realmId: options.realmId,
    organizationId: null,
    overrides: organizationLoginPolicyOverrideViewCreate(override.data),
    policy: policy.data,
  })
}
