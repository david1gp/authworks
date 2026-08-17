import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

export const oidcAuthorizationCodeTable = sqliteTable(
  "oidc_authorization_codes",
  {
    clientId: text("client_id").notNull(),
    codeChallenge: text("code_challenge").notNull(),
    codeChallengeMethod: text("code_challenge_method").notNull(),
    createdAt: integer("created_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
    id: text("id").primaryKey(),
    instanceId: text("instance_id").notNull(),
    issuer: text("issuer").notNull(),
    nonceEncrypted: text("nonce_encrypted"),
    redirectUri: text("redirect_uri").notNull(),
    scope: text("scope").notNull(),
    sessionId: text("session_id").notNull(),
    tokenHash: text("token_hash").notNull(),
    userId: text("user_id").notNull(),
    usedAt: integer("used_at"),
  },
  (table) => [
    uniqueIndex("oidc_authorization_codes_token_hash_idx").on(table.tokenHash),
    index("oidc_authorization_codes_instance_idx").on(table.instanceId),
  ],
)

export type OidcAuthorizationCodeRow = typeof oidcAuthorizationCodeTable.$inferSelect
