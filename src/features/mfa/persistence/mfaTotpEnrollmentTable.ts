import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const mfaTotpEnrollmentTable = sqliteTable(
  "mfa_totp_enrollments",
  {
    confirmedAt: integer("confirmed_at"),
    createdAt: integer("created_at").notNull(),
    encryptedSecret: text("encrypted_secret").notNull(),
    id: text("id").primaryKey(),
    realmId: text("realm_id").notNull(),
    label: text("label").notNull(),
    lastUsedStep: integer("last_used_step"),
    status: text("status").notNull(),
    userId: text("user_id").notNull(),
    version: integer("version").notNull(),
  },
  (table) => [index("mfa_totp_enrollments_realm_user_idx").on(table.realmId, table.userId)],
)

export type MfaTotpEnrollmentRow = typeof mfaTotpEnrollmentTable.$inferSelect
