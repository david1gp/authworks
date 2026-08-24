import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const rateLimitTable = sqliteTable(
  "rate_limits",
  {
    count: integer("count").notNull(),
    expiresAt: integer("expires_at").notNull(),
    keyHash: text("key_hash").notNull(),
    scope: text("scope").notNull(),
    updatedAt: integer("updated_at").notNull(),
    version: integer("version").notNull(),
    windowStartedAt: integer("window_started_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.scope, table.keyHash] })],
)

export type RateLimitRow = typeof rateLimitTable.$inferSelect
