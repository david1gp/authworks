import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

export const passkeyCeremonyTable = sqliteTable(
  "passkey_ceremonies",
  {
    challengeHash: text("challenge_hash").notNull(),
    consumedAt: integer("consumed_at"),
    createdAt: integer("created_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
    id: text("id").primaryKey(),
    realmId: text("realm_id").notNull(),
    kind: text("kind").notNull(),
    organizationId: text("organization_id"),
    origins: text("origins").notNull(),
    purpose: text("purpose").notNull(),
    rpId: text("rp_id").notNull(),
    sessionId: text("session_id"),
    tokenHash: text("token_hash").notNull(),
    userId: text("user_id"),
    userVerification: text("user_verification").notNull(),
    version: integer("version").notNull(),
  },
  (table) => [
    uniqueIndex("passkey_ceremonies_token_hash_idx").on(table.tokenHash),
    index("passkey_ceremonies_realm_expiry_idx").on(table.realmId, table.expiresAt),
    index("passkey_ceremonies_realm_user_idx").on(table.realmId, table.userId),
  ],
)

export type PasskeyCeremonyRow = typeof passkeyCeremonyTable.$inferSelect
