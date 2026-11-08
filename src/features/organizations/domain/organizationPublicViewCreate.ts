import type { OrganizationRow } from "../persistence/organizationTable.js"
import type { Organization } from "../public/organizationSchema.js"

export function organizationPublicViewCreate(row: OrganizationRow): Organization {
  return {
    createdAt: row.createdAt,
    id: row.id,
    realmId: row.realmId,
    name: row.name,
    slug: row.slug,
    status: row.status as Organization["status"],
    updatedAt: row.updatedAt,
  }
}
