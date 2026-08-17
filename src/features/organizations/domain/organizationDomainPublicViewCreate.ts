import type { OrganizationDomainRow } from "../persistence/organizationDomainTable.js"
import type { OrganizationDomain } from "../public/organizationDomainSchema.js"

export function organizationDomainPublicViewCreate(row: OrganizationDomainRow): OrganizationDomain {
  return {
    createdAt: row.createdAt,
    domain: row.domain,
    instanceId: row.instanceId,
    isPrimary: row.isPrimary,
    organizationId: row.organizationId,
    updatedAt: row.updatedAt,
    verified: row.verified,
    version: row.version,
  }
}
