import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const storageDataMigrationTable = sqliteTable("storage_data_migrations", {
  appliedAt: integer("applied_at").notNull(),
  name: text("name").primaryKey(),
})

export type StorageDataMigrationRow = typeof storageDataMigrationTable.$inferSelect
