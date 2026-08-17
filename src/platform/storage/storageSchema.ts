import type { ExtractTablesWithRelations } from "drizzle-orm"
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite"
import type { SQLiteTransaction } from "drizzle-orm/sqlite-core"
import { instanceBootstrapAdminTable } from "../../features/instances/persistence/instanceBootstrapAdminTable.js"
import { instanceDomainTable } from "../../features/instances/persistence/instanceDomainTable.js"
import { instanceTable } from "../../features/instances/persistence/instanceTable.js"
import { organizationInvitationTable } from "../../features/organizations/persistence/organizationInvitationTable.js"
import { organizationMembershipTable } from "../../features/organizations/persistence/organizationMembershipTable.js"
import { organizationTable } from "../../features/organizations/persistence/organizationTable.js"
import { storageCurrentStateTable } from "./storageCurrentStateTable.js"
import { storageEventTable } from "./storageEventTable.js"

export const storageSchema = {
  instanceBootstrapAdminTable,
  instanceDomainTable,
  instanceTable,
  organizationInvitationTable,
  organizationMembershipTable,
  organizationTable,
  storageCurrentStateTable,
  storageEventTable,
}

export type StorageClient = BunSQLiteDatabase<typeof storageSchema>
export type StorageTransaction = SQLiteTransaction<
  "sync",
  void,
  typeof storageSchema,
  ExtractTablesWithRelations<typeof storageSchema>
>
export type StorageExecutor = StorageClient | StorageTransaction
