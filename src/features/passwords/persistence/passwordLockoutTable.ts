import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const passwordLockoutTable = sqliteTable("password_lockouts", {
  failedAttempts: integer("failed_attempts").notNull(),
  realmId: text("realm_id").notNull(),
  lockedUntil: integer("locked_until"),
  updatedAt: integer("updated_at").notNull(),
  userId: text("user_id").primaryKey(),
  version: integer("version").notNull(),
})

export type PasswordLockoutRow = typeof passwordLockoutTable.$inferSelect
