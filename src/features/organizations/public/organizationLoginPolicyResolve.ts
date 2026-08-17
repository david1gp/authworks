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
  readonly instanceId: string
  readonly organizationId?: string
}

export function organizationLoginPolicyResolve(
  options: OrganizationLoginPolicyResolveOptions,
): Result<OrganizationLoginPolicy> {
  const repository = organizationLoginPolicyRepositoryCreate(options.database.db)
  const instance = repository.instanceLoginPolicyGet(options.instanceId)
  if (!instance.success) return instance
  if (options.organizationId === undefined) return resultCreate(organizationLoginPolicyViewCreate(instance.data, null))
  const organization = options.database.db
    .select({ id: organizationTable.id, instanceId: organizationTable.instanceId, status: organizationTable.status })
    .from(organizationTable)
    .where(and(eq(organizationTable.id, options.organizationId), eq(organizationTable.instanceId, options.instanceId)))
    .get()
  if (organization === undefined || organization.status !== "active")
    return resultErrorCreate("organizationLoginPolicyResolve", "The organization login policy is unavailable.")
  const override = repository.organizationLoginPolicyGet(options.organizationId)
  if (!override.success) return override
  return resultCreate(organizationLoginPolicyViewCreate(instance.data, override.data))
}
