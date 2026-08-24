import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const whatsappOtpChallengeTable = sqliteTable(
  "whatsapp_otp_challenges",
  {
    attempts: integer("attempts").notNull(),
    codeHash: text("code_hash").notNull(),
    consumedAt: integer("consumed_at"),
    cooldownUntil: integer("cooldown_until").notNull(),
    createdAt: integer("created_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
    id: text("id").primaryKey(),
    maxAttempts: integer("max_attempts").notNull(),
    organizationId: text("organization_id"),
    phoneHash: text("phone_hash").notNull(),
    purpose: text("purpose").notNull(),
    realmId: text("realm_id").notNull(),
    userId: text("user_id"),
    version: integer("version").notNull(),
  },
  (table) => [
    index("whatsapp_otp_challenges_realm_phone_idx").on(table.realmId, table.phoneHash, table.purpose),
    index("whatsapp_otp_challenges_realm_user_idx").on(table.realmId, table.userId, table.purpose),
  ],
)

export type WhatsappOtpChallengeRow = typeof whatsappOtpChallengeTable.$inferSelect
