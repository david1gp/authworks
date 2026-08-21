import { and, eq } from "drizzle-orm"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { organizationLoginPolicyViewCreate } from "../domain/organizationLoginPolicyViewCreate.js"
import { organizationLoginPolicyRepositoryCreate } from "../persistence/organizationLoginPolicyRepositoryCreate.js"
import { organizationTable } from "../persistence/organizationTable.js"
import type { OrganizationLoginPolicy } from "../public/organizationLoginPolicySchema.js"

type OrganizationLoginPolicyResolveOptions = {
  readonly database: StorageDatabase
  readonly realmId: string
  readonly organizationId?: string
}

export function organizationLoginPolicyResolve(
  options: OrganizationLoginPolicyResolveOptions,
): Result<OrganizationLoginPolicy> {
  const repository = organizationLoginPolicyRepositoryCreate(options.database.db)
  const realm = repository.realmLoginPolicyGet(options.realmId)
  if (!realm.success) return realm
  if (options.organizationId === undefined) return resultCreate(organizationLoginPolicyViewCreate(realm.data, null))
  const organization = options.database.db
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
  return resultCreate(organizationLoginPolicyViewCreate(realm.data, override.data))
}
