import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const storageEventTable = sqliteTable(
  "events",
  {
    position: integer("position").primaryKey({ autoIncrement: true }),
    id: text("id").notNull().unique(),
    commandIndex: integer("command_index").notNull(),
    instanceId: text("instance_id").notNull(),
    aggregateType: text("aggregate_type").notNull(),
    aggregateId: text("aggregate_id").notNull(),
    aggregateVersion: integer("aggregate_version").notNull(),
    actorId: text("actor_id"),
    correlationId: text("correlation_id").notNull(),
    causationId: text("causation_id"),
    occurredAt: integer("occurred_at").notNull(),
    eventType: text("event_type").notNull(),
    payload: text("payload", { mode: "json" }).notNull(),
    metadata: text("metadata", { mode: "json" }).notNull(),
  },
  (table) => [index("events_aggregate_version_idx").on(table.aggregateType, table.aggregateId, table.aggregateVersion)],
)

export type StorageEvent = typeof storageEventTable.$inferSelect
