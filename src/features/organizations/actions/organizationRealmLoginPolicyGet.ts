import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { authorizationEnforce } from "../../authorization/actions/authorizationEnforce.js"
import { authorizationPermissionDefinitions } from "../../authorization/public/authorizationPermissionDefinitions.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { organizationLoginPolicyOverrideViewCreate } from "../domain/organizationLoginPolicyOverrideViewCreate.js"
import { organizationLoginPolicyRepositoryCreate } from "../persistence/organizationLoginPolicyRepositoryCreate.js"
import type { OrganizationLoginPolicyResponse } from "../public/organizationLoginPolicyResponseSchema.js"
import { organizationLoginPolicyResolve } from "./organizationLoginPolicyResolve.js"

type OrganizationRealmLoginPolicyGetOptions = {
  readonly context?: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly realmId: string
}

export function organizationRealmLoginPolicyGet(
  options: OrganizationRealmLoginPolicyGetOptions,
): Result<OrganizationLoginPolicyResponse> {
  if (options.context !== undefined) {
    if (options.context.kind === "tenant" && options.context.realmId !== options.realmId)
      return resultErrorCodedCreate(
        "organizationRealmLoginPolicyGet",
        "The login policy is not available in this tenant context.",
        "organizations.tenant-mismatch",
      )
    const authorized = authorizationEnforce({
      actor: options.context.actor,
      realmId: options.realmId,
      permission: authorizationPermissionDefinitions.organizationRead,
    })
    if (!authorized.success) return authorized
  }
  const policy = organizationLoginPolicyResolve(options)
  if (!policy.success) return policy
  const override = organizationLoginPolicyRepositoryCreate(options.database.db).realmLoginPolicyGet(options.realmId)
  if (!override.success) return override
  const overrides = organizationLoginPolicyOverrideViewCreate(override.data)
  if (!overrides.success) return overrides
  return resultCreate({
    realmId: options.realmId,
    organizationId: null,
    overrides: overrides.data,
    policy: policy.data,
  })
}
