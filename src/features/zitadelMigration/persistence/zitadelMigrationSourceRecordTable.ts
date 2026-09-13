import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const zitadelMigrationSourceRecordTable = sqliteTable(
  "zitadel_migration_source_records",
  {
    realmId: text("realm_id").notNull(),
    sourceInstance: text("source_instance").notNull(),
    entityType: text("entity_type").notNull(),
    sourceId: text("source_id").notNull(),
    destinationId: text("destination_id").notNull(),
    sourceVersion: text("source_version"),
    sourceUpdatedAt: integer("source_updated_at"),
  },
  (table) => [primaryKey({ columns: [table.realmId, table.sourceInstance, table.entityType, table.sourceId] })],
)

export type ZitadelMigrationSourceRecord = typeof zitadelMigrationSourceRecordTable.$inferSelect
export type ZitadelMigrationSourceRecordInsert = typeof zitadelMigrationSourceRecordTable.$inferInsert
