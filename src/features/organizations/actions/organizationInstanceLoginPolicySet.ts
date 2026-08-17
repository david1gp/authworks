import type { Result } from "#result"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { InstanceSystemContext } from "../../instances/domain/instanceSystemContext.js"
import type { OrganizationLoginPolicyResponse } from "../public/organizationLoginPolicyResponseSchema.js"
import type { OrganizationLoginPolicySetRequest } from "../public/organizationLoginPolicySetRequestSchema.js"
import { organizationLoginPolicySet } from "./organizationLoginPolicySet.js"

type OrganizationInstanceLoginPolicySetOptions = {
  readonly context: InstanceSystemContext
  readonly database: StorageDatabase
  readonly input: OrganizationLoginPolicySetRequest
  readonly instanceId: string
}

export function organizationInstanceLoginPolicySet(
  options: OrganizationInstanceLoginPolicySetOptions,
): Result<OrganizationLoginPolicyResponse> {
  return organizationLoginPolicySet(options)
}
