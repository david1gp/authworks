import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const passwordPolicyTable = sqliteTable("password_policies", {
  realmId: text("realm_id").primaryKey(),
  minimumLength: integer("minimum_length").notNull(),
  requireLowercase: integer("require_lowercase").notNull(),
  requireNumber: integer("require_number").notNull(),
  requireSymbol: integer("require_symbol").notNull(),
  requireUppercase: integer("require_uppercase").notNull(),
  maximumAttempts: integer("maximum_attempts").notNull(),
  lockoutDurationMs: integer("lockout_duration_ms").notNull(),
  updatedAt: integer("updated_at").notNull(),
  version: integer("version").notNull(),
})

export type PasswordPolicyRow = typeof passwordPolicyTable.$inferSelect
