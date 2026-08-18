import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const emailOtpChallengeTable = sqliteTable(
  "email_otp_challenges",
  {
    attempts: integer("attempts").notNull(),
    codeHash: text("code_hash").notNull(),
    consumedAt: integer("consumed_at"),
    cooldownUntil: integer("cooldown_until").notNull(),
    createdAt: integer("created_at").notNull(),
    emailHash: text("email_hash").notNull(),
    expiresAt: integer("expires_at").notNull(),
    id: text("id").primaryKey(),
    realmId: text("realm_id").notNull(),
    maxAttempts: integer("max_attempts").notNull(),
    organizationId: text("organization_id"),
    purpose: text("purpose").notNull(),
    userId: text("user_id"),
    version: integer("version").notNull(),
  },
  (table) => [
    index("email_otp_challenges_realm_email_idx").on(table.realmId, table.emailHash, table.purpose),
    index("email_otp_challenges_realm_user_idx").on(table.realmId, table.userId, table.purpose),
  ],
)

export type EmailOtpChallengeRow = typeof emailOtpChallengeTable.$inferSelect
