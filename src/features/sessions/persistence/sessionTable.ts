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
    realmId: text("realm_id").notNull(),
    impersonationOrganizationId: text("impersonation_organization_id"),
    impersonationPermissions: text("impersonation_permissions"),
    impersonationReason: text("impersonation_reason"),
    impersonatorId: text("impersonator_id"),
    ipAddress: text("ip_address"),
    lastUsedAt: integer("last_used_at").notNull(),
    mfaMethod: text("mfa_method"),
    revokedAt: integer("revoked_at"),
    revocationReason: text("revocation_reason"),
    subjectId: text("subject_id").notNull(),
    subjectType: text("subject_type").notNull(),
    tokenHash: text("token_hash").notNull(),
    userAgent: text("user_agent"),
    userId: text("user_id"),
    version: integer("version").notNull(),
  },
  (table) => [
    uniqueIndex("sessions_token_hash_idx").on(table.tokenHash),
    index("sessions_realm_subject_idx").on(table.realmId, table.subjectType, table.subjectId),
    index("sessions_realm_user_idx").on(table.realmId, table.userId),
    index("sessions_realm_last_used_idx").on(table.realmId, table.userId, table.lastUsedAt),
    index("sessions_impersonator_idx").on(table.realmId, table.impersonatorId),
  ],
)

export type SessionRow = typeof sessionTable.$inferSelect
