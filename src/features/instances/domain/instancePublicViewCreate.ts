import type { InstanceRow } from "../persistence/instanceTable.js"
import type { Instance } from "../public/instanceSchema.js"

export function instancePublicViewCreate(row: InstanceRow, domains: string[]): Instance {
  return {
    createdAt: row.createdAt,
    domain: row.primaryDomain,
    domains,
    id: row.id,
    name: row.name,
    status: row.status as Instance["status"],
    updatedAt: row.updatedAt,
  }
}
