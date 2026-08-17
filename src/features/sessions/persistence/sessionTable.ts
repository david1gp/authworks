import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

export const sessionTable = sqliteTable(
  "sessions",
  {
    assurance: text("assurance").notNull(),
    authenticationMethod: text("authentication_method").notNull(),
    createdAt: integer("created_at").notNull(),
    deviceDescription: text("device_description"),
    deviceFingerprint: text("device_fingerprint"),
    expiresAt: integer("expires_at").notNull(),
    id: text("id").primaryKey(),
    instanceId: text("instance_id").notNull(),
    ipAddress: text("ip_address"),
    lastUsedAt: integer("last_used_at").notNull(),
    mfaMethod: text("mfa_method"),
    revokedAt: integer("revoked_at"),
    revocationReason: text("revocation_reason"),
    tokenHash: text("token_hash").notNull(),
    userAgent: text("user_agent"),
    userId: text("user_id").notNull(),
    version: integer("version").notNull(),
  },
  (table) => [
    uniqueIndex("sessions_token_hash_idx").on(table.tokenHash),
    index("sessions_instance_user_idx").on(table.instanceId, table.userId),
    index("sessions_instance_last_used_idx").on(table.instanceId, table.userId, table.lastUsedAt),
  ],
)

export type SessionRow = typeof sessionTable.$inferSelect
