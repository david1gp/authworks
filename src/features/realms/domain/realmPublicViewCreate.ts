import type { RealmRow } from "../persistence/realmTable.js"
import type { Realm } from "../public/realmSchema.js"

export function realmPublicViewCreate(row: RealmRow, domains: string[]): Realm {
  return {
    createdAt: row.createdAt,
    domain: row.primaryDomain,
    domains,
    id: row.id,
    name: row.name,
    status: row.status as Realm["status"],
    updatedAt: row.updatedAt,
  }
}
