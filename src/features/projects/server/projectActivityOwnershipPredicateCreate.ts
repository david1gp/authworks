import { sql } from "drizzle-orm"
import { storageEventTable } from "../../../platform/storage/storageEventTable.js"
import { projectTable } from "../persistence/projectTable.js"

/** Project ownership is fixed at creation; absent rows cannot establish historical ownership. */
export function projectActivityOwnershipPredicateCreate(realmId: string, organizationId: string) {
  return sql`exists (select 1 from ${projectTable} where ${projectTable.id} = ${storageEventTable.aggregateId} and ${projectTable.realmId} = ${realmId} and ${projectTable.organizationId} = ${organizationId})`
}
