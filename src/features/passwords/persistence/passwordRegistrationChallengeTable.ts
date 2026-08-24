import { sql } from "drizzle-orm"
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

export const passwordRegistrationChallengeTable = sqliteTable(
  "password_registration_challenges",
  {
    attempts: integer("attempts").notNull(),
    codeHash: text("code_hash").notNull(),
    consumedAt: integer("consumed_at"),
    cooldownUntil: integer("cooldown_until").notNull(),
    createdAt: integer("created_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
    identityHash: text("identity_hash"),
    id: text("id").primaryKey(),
    maxAttempts: integer("max_attempts").notNull(),
    purpose: text("purpose").notNull(),
    realmId: text("realm_id").notNull(),
    userId: text("user_id"),
    version: integer("version").notNull(),
  },
  (table) => [
    uniqueIndex("password_registration_challenges_code_hash_idx").on(table.codeHash),
    uniqueIndex("password_registration_challenges_decoy_identity_idx")
      .on(table.realmId, table.identityHash, table.purpose)
      .where(sql`${table.userId} IS NULL AND ${table.consumedAt} IS NULL`),
    index("password_registration_challenges_realm_identity_idx").on(table.realmId, table.identityHash, table.purpose),
    index("password_registration_challenges_realm_user_idx").on(table.realmId, table.userId, table.purpose),
  ],
)

export type PasswordRegistrationChallengeRow = typeof passwordRegistrationChallengeTable.$inferSelect
