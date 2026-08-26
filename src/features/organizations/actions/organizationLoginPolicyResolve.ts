import { and, eq } from "drizzle-orm"
import { type Result } from "#result"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import type { MfaPolicyFactor } from "../../mfa/public/mfaPolicyFactorSchema.js"
import { organizationLoginPolicyViewCreate } from "../domain/organizationLoginPolicyViewCreate.js"
import { organizationLoginPolicyRepositoryCreate } from "../persistence/organizationLoginPolicyRepositoryCreate.js"
import { organizationTable } from "../persistence/organizationTable.js"
import type { OrganizationLoginPolicy } from "../public/organizationLoginPolicySchema.js"

type OrganizationLoginPolicyResolveOptions = {
  readonly database: StorageDatabase
  readonly executor?: StorageExecutor
  readonly realmId: string
  readonly organizationId?: string
  readonly runtimeAvailableFactors?: readonly MfaPolicyFactor[]
}

export function organizationLoginPolicyResolve(
  options: OrganizationLoginPolicyResolveOptions,
): Result<OrganizationLoginPolicy> {
  const executor = options.executor ?? options.database.db
  const repository = organizationLoginPolicyRepositoryCreate(executor)
  const realm = repository.realmLoginPolicyGet(options.realmId)
  if (!realm.success) return realm
  if (options.organizationId === undefined)
    return organizationLoginPolicyViewCreate(realm.data, null, {
      runtimeAvailableFactors: options.runtimeAvailableFactors,
    })
  const organization = executor
    .select({ id: organizationTable.id, realmId: organizationTable.realmId, status: organizationTable.status })
    .from(organizationTable)
    .where(and(eq(organizationTable.id, options.organizationId), eq(organizationTable.realmId, options.realmId)))
    .get()
  if (organization === undefined || organization.status !== "active")
    return resultErrorCodedCreate(
      "organizationLoginPolicyResolve",
      "The organization login policy is unavailable.",
      "organizations.not-found",
    )
  const override = repository.organizationLoginPolicyGet(options.organizationId)
  if (!override.success) return override
  return organizationLoginPolicyViewCreate(realm.data, override.data, {
    runtimeAvailableFactors: options.runtimeAvailableFactors,
  })
}
