import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const storageCurrentStateTable = sqliteTable("current_state", {
  key: text("key").primaryKey(),
  value: text("value", { mode: "json" }).notNull(),
  version: integer("version").notNull(),
  updatedAt: integer("updated_at").notNull(),
})

export type StorageCurrentState = typeof storageCurrentStateTable.$inferSelect
