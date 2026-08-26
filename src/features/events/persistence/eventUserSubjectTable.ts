import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const eventUserSubjectTable = sqliteTable(
  "event_user_subjects",
  {
    category: text("category").notNull(),
    displayCode: text("display_code").notNull(),
    eventPosition: integer("event_position").primaryKey(),
    eventType: text("event_type").notNull(),
    realmId: text("realm_id").notNull(),
    userId: text("user_id").notNull(),
  },
  (table) => [
    index("event_user_subjects_realm_user_position_idx").on(table.realmId, table.userId, table.eventPosition),
  ],
)

export type EventUserSubject = typeof eventUserSubjectTable.$inferSelect
