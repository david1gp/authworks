import { sqliteTable, text } from "drizzle-orm/sqlite-core"

export const storageEventPurgeTable = sqliteTable("event_purges", {
  aggregateId: text("aggregate_id").primaryKey(),
})

export type StorageEventPurgeRow = typeof storageEventPurgeTable.$inferSelect
