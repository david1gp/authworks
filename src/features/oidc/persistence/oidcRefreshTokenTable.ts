import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

export const oidcRefreshTokenTable = sqliteTable(
  "oidc_refresh_tokens",
  {
    clientId: text("client_id").notNull(),
    createdAt: integer("created_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
    familyId: text("family_id").notNull(),
    id: text("id").primaryKey(),
    instanceId: text("instance_id").notNull(),
    nonceEncrypted: text("nonce_encrypted"),
    scope: text("scope").notNull(),
    sessionId: text("session_id").notNull(),
    tokenHash: text("token_hash").notNull(),
    userId: text("user_id").notNull(),
    revokedAt: integer("revoked_at"),
    replacedByHash: text("replaced_by_hash"),
  },
  (table) => [
    uniqueIndex("oidc_refresh_tokens_token_hash_idx").on(table.tokenHash),
    index("oidc_refresh_tokens_instance_user_idx").on(table.instanceId, table.userId),
    index("oidc_refresh_tokens_family_idx").on(table.familyId),
  ],
)

export type OidcRefreshTokenRow = typeof oidcRefreshTokenTable.$inferSelect
