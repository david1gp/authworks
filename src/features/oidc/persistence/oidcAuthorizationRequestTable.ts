import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const oidcAuthorizationRequestTable = sqliteTable(
  "oidc_authorization_requests",
  {
    clientId: text("client_id").notNull(),
    codeChallenge: text("code_challenge").notNull(),
    codeChallengeMethod: text("code_challenge_method").notNull(),
    createdAt: integer("created_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
    id: text("id").primaryKey(),
    realmId: text("realm_id").notNull(),
    issuer: text("issuer").notNull(),
    nonceEncrypted: text("nonce_encrypted"),
    prompt: text("prompt"),
    redirectUri: text("redirect_uri").notNull(),
    scope: text("scope").notNull(),
    sessionId: text("session_id").notNull(),
    stateEncrypted: text("state_encrypted"),
    userId: text("user_id").notNull(),
    approvedAt: integer("approved_at"),
    rejectedAt: integer("rejected_at"),
  },
  (table) => [
    index("oidc_authorization_requests_realm_idx").on(table.realmId),
    index("oidc_authorization_requests_expiry_idx").on(table.expiresAt),
  ],
)

export type OidcAuthorizationRequestRow = typeof oidcAuthorizationRequestTable.$inferSelect
