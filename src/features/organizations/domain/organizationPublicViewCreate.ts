import type { OrganizationRow } from "../persistence/organizationTable.js"
import type { Organization } from "../public/organizationSchema.js"

export function organizationPublicViewCreate(row: OrganizationRow): Organization {
  return {
    createdAt: row.createdAt,
    id: row.id,
    instanceId: row.instanceId,
    name: row.name,
    status: row.status as Organization["status"],
    updatedAt: row.updatedAt,
  }
}
