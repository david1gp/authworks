import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const userMetadataTable = sqliteTable(
  "user_metadata",
  {
    createdAt: integer("created_at").notNull(),
    key: text("key").notNull(),
    realmId: text("realm_id").notNull(),
    updatedAt: integer("updated_at").notNull(),
    userId: text("user_id").notNull(),
    value: text("value").notNull(),
    version: integer("version").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.realmId, table.userId, table.key] }),
    index("user_metadata_realm_user_idx").on(table.realmId, table.userId),
  ],
)

export type UserMetadataRow = typeof userMetadataTable.$inferSelect
