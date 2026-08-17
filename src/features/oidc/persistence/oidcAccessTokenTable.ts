import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

export const oidcAccessTokenTable = sqliteTable(
  "oidc_access_tokens",
  {
    clientId: text("client_id").notNull(),
    createdAt: integer("created_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
    id: text("id").primaryKey(),
    instanceId: text("instance_id").notNull(),
    refreshFamilyId: text("refresh_family_id"),
    scope: text("scope").notNull(),
    sessionId: text("session_id").notNull(),
    tokenHash: text("token_hash").notNull(),
    userId: text("user_id").notNull(),
    revokedAt: integer("revoked_at"),
  },
  (table) => [
    uniqueIndex("oidc_access_tokens_token_hash_idx").on(table.tokenHash),
    index("oidc_access_tokens_instance_user_idx").on(table.instanceId, table.userId),
    index("oidc_access_tokens_refresh_family_idx").on(table.refreshFamilyId),
  ],
)

export type OidcAccessTokenRow = typeof oidcAccessTokenTable.$inferSelect
