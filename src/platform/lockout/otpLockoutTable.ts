import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const otpLockoutTable = sqliteTable(
  "otp_lockouts",
  {
    failedAttempts: integer("failed_attempts").notNull(),
    realmId: text("realm_id").notNull(),
    lockedUntil: integer("locked_until"),
    updatedAt: integer("updated_at").notNull(),
    userId: text("user_id").primaryKey(),
    version: integer("version").notNull(),
  },
  (table) => [index("otp_lockouts_realm_idx").on(table.realmId)],
)

export type OtpLockoutRow = typeof otpLockoutTable.$inferSelect
