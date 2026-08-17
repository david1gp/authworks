import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { InstanceSystemContext } from "../../instances/domain/instanceSystemContext.js"
import type { InstanceTenantContext } from "../../instances/domain/instanceTenantContext.js"
import { organizationPublicViewCreate } from "../domain/organizationPublicViewCreate.js"
import { organizationRepositoryCreate } from "../persistence/organizationRepositoryCreate.js"
import type { Organization } from "../public/organizationSchema.js"
import { organizationContextAuthorize } from "./organizationContextAuthorize.js"

type OrganizationListOptions = {
  readonly context: InstanceSystemContext | InstanceTenantContext
  readonly database: StorageDatabase
  readonly instanceId: string
}

export function organizationList(options: OrganizationListOptions): Result<{ organizations: Organization[] }> {
  const op = "organizationList"
  if (options.context.kind === "tenant" && options.context.instanceId !== options.instanceId)
    return resultErrorCreate(op, "The organizations are not available in this tenant context.")
  const repository = organizationRepositoryCreate(options.database.db)
  const rows = repository.organizationList(options.instanceId)
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
        requiredRole: "member",
      })
      if (!authorized.success) continue
    }
    organizations.push(organizationPublicViewCreate(row))
  }
  return resultCreate({ organizations })
}
