import type { Result } from "#result"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import type { OrganizationLoginPolicyResponse } from "../public/organizationLoginPolicyResponseSchema.js"
import type { OrganizationLoginPolicySetRequest } from "../public/organizationLoginPolicySetRequestSchema.js"
import { organizationLoginPolicySet } from "./organizationLoginPolicySet.js"

type OrganizationRealmLoginPolicySetOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly input: OrganizationLoginPolicySetRequest
  readonly realmId: string
}

export function organizationRealmLoginPolicySet(
  options: OrganizationRealmLoginPolicySetOptions,
): Result<OrganizationLoginPolicyResponse> {
  return organizationLoginPolicySet(options)
}
