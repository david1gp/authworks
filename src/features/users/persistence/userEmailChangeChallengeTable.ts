import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

export const userEmailChangeChallengeTable = sqliteTable(
  "user_email_change_challenges",
  {
    attempts: integer("attempts").notNull(),
    consumedAt: integer("consumed_at"),
    cooldownUntil: integer("cooldown_until").notNull(),
    createdAt: integer("created_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
    id: text("id").primaryKey(),
    maxAttempts: integer("max_attempts").notNull(),
    pendingEmail: text("pending_email").notNull(),
    purpose: text("purpose", { enum: ["email_change", "email_address"] })
      .notNull()
      .default("email_change"),
    realmId: text("realm_id").notNull(),
    tokenHash: text("token_hash").notNull(),
    userId: text("user_id").notNull(),
    version: integer("version").notNull(),
  },
  (table) => [
    uniqueIndex("user_email_change_challenges_token_hash_idx").on(table.tokenHash),
    index("user_email_change_challenges_realm_user_email_idx").on(table.realmId, table.userId, table.pendingEmail),
  ],
)

export type UserEmailChangeChallengeRow = typeof userEmailChangeChallengeTable.$inferSelect
