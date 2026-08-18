import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const mfaPolicyTable = sqliteTable("mfa_policies", {
  realmId: text("realm_id").primaryKey(),
  lockoutDurationMs: integer("lockout_duration_ms").notNull(),
  maxAttempts: integer("max_attempts").notNull(),
  mode: text("mode").notNull(),
  totpWindow: integer("totp_window").notNull(),
  updatedAt: integer("updated_at").notNull(),
  version: integer("version").notNull(),
})

export type MfaPolicyRow = typeof mfaPolicyTable.$inferSelect
