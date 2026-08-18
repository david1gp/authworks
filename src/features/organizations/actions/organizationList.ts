import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { organizationPublicViewCreate } from "../domain/organizationPublicViewCreate.js"
import { organizationRepositoryCreate } from "../persistence/organizationRepositoryCreate.js"
import type { Organization } from "../public/organizationSchema.js"
import { organizationContextAuthorize } from "./organizationContextAuthorize.js"

type OrganizationListOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly realmId: string
}

export function organizationList(options: OrganizationListOptions): Result<{ organizations: Organization[] }> {
  const op = "organizationList"
  if (options.context.kind === "tenant" && options.context.realmId !== options.realmId)
    return resultErrorCreate(op, "The organizations are not available in this tenant context.")
  const repository = organizationRepositoryCreate(options.database.db)
  const rows = repository.organizationList(options.realmId)
  if (!rows.success) return rows
  const organizations: Organization[] = []
  for (const row of rows.data) {
    if (row.status === "removed") continue
    if (options.context.kind === "tenant" && row.status !== "active") continue
    if (options.context.kind === "tenant") {
      const authorized = organizationContextAuthorize({
        context: options.context,
        organization: row,
        repository,
        requiredPermission: "organization.read",
      })
      if (!authorized.success) continue
    }
    organizations.push(organizationPublicViewCreate(row))
  }
  return resultCreate({ organizations })
}
