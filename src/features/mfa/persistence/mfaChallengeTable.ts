import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

export const mfaChallengeTable = sqliteTable(
  "mfa_challenges",
  {
    attempts: integer("attempts").notNull(),
    availableFactors: text("available_factors"),
    emailAddress: text("email_address"),
    emailCodeHash: text("email_code_hash"),
    emailRetryAt: integer("email_retry_at"),
    consumedAt: integer("consumed_at"),
    createdAt: integer("created_at").notNull(),
    deviceDescription: text("device_description"),
    deviceFingerprint: text("device_fingerprint"),
    expiresAt: integer("expires_at").notNull(),
    factor: text("factor"),
    id: text("id").primaryKey(),
    realmId: text("realm_id").notNull(),
    ipAddress: text("ip_address"),
    maxAttempts: integer("max_attempts").notNull(),
    organizationId: text("organization_id"),
    primaryAuthenticationMethod: text("primary_authentication_method").notNull(),
    purpose: text("purpose").notNull(),
    requiredAssurance: text("required_assurance").notNull(),
    sessionId: text("session_id"),
    tokenHash: text("token_hash").notNull(),
    userAgent: text("user_agent"),
    userId: text("user_id").notNull(),
    version: integer("version").notNull(),
  },
  (table) => [
    uniqueIndex("mfa_challenges_token_hash_idx").on(table.tokenHash),
    index("mfa_challenges_realm_user_idx").on(table.realmId, table.userId, table.purpose),
  ],
)

export type MfaChallengeRow = typeof mfaChallengeTable.$inferSelect
