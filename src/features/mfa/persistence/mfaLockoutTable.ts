import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const mfaLockoutTable = sqliteTable(
  "mfa_lockouts",
  {
    failedAttempts: integer("failed_attempts").notNull(),
    instanceId: text("instance_id").notNull(),
    lockedUntil: integer("locked_until"),
    updatedAt: integer("updated_at").notNull(),
    userId: text("user_id").primaryKey(),
    version: integer("version").notNull(),
  },
  (table) => [index("mfa_lockouts_instance_idx").on(table.instanceId)],
)

export type MfaLockoutRow = typeof mfaLockoutTable.$inferSelect
