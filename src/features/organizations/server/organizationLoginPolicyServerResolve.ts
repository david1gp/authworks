import { type Result } from "#result"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import type { MfaPolicyFactor } from "../../mfa/public/mfaPolicyFactorSchema.js"
import { organizationLoginPolicyResolve } from "../actions/organizationLoginPolicyResolve.js"
import type { OrganizationLoginPolicy } from "../public/organizationLoginPolicySchema.js"

type OrganizationLoginPolicyServerResolveOptions = {
  readonly database: StorageDatabase
  readonly executor?: StorageExecutor
  readonly organizationId?: string
  readonly realmId: string
  readonly runtimeAvailableFactors?: readonly MfaPolicyFactor[]
}

/** Server-surface entry point for the resolved realm/organization login policy. */
export function organizationLoginPolicyServerResolve(
  options: OrganizationLoginPolicyServerResolveOptions,
): Result<OrganizationLoginPolicy> {
  return organizationLoginPolicyResolve({
    database: options.database,
    ...(options.executor === undefined ? {} : { executor: options.executor }),
    ...(options.organizationId === undefined ? {} : { organizationId: options.organizationId }),
    realmId: options.realmId,
    ...(options.runtimeAvailableFactors === undefined
      ? {}
      : { runtimeAvailableFactors: options.runtimeAvailableFactors }),
  })
}
