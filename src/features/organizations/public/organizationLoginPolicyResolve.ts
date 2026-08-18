import { and, eq } from "drizzle-orm"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { organizationTable } from "../persistence/organizationTable.js"
import { organizationLoginPolicyRepositoryCreate } from "../persistence/organizationLoginPolicyRepositoryCreate.js"
import type { OrganizationLoginPolicy } from "./organizationLoginPolicySchema.js"
import { organizationLoginPolicyViewCreate } from "../domain/organizationLoginPolicyViewCreate.js"

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
    return resultErrorCreate("organizationLoginPolicyResolve", "The organization login policy is unavailable.")
  const override = repository.organizationLoginPolicyGet(options.organizationId)
  if (!override.success) return override
  return resultCreate(organizationLoginPolicyViewCreate(realm.data, override.data))
}
