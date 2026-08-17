import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

export const externalIdentityOAuthTransactionTable = sqliteTable(
  "external_identity_oauth_transactions",
  {
    callbackValidatedAt: integer("callback_validated_at"),
    confirmationTokenHash: text("confirmation_token_hash"),
    consumedAt: integer("consumed_at"),
    createdAt: integer("created_at").notNull(),
    externalDisplayName: text("external_display_name"),
    externalEmail: text("external_email"),
    externalEmailVerified: integer("external_email_verified", { mode: "boolean" }),
    externalIssuer: text("external_issuer"),
    externalSubject: text("external_subject"),
    externalUsername: text("external_username"),
    expiresAt: integer("expires_at").notNull(),
    id: text("id").primaryKey(),
    instanceId: text("instance_id").notNull(),
    intent: text("intent").notNull(),
    nonceHash: text("nonce_hash"),
    nonce: text("nonce"),
    organizationId: text("organization_id"),
    pkceVerifier: text("pkce_verifier").notNull(),
    providerId: text("provider_id").notNull(),
    redirectUri: text("redirect_uri").notNull(),
    stateHash: text("state_hash").notNull(),
    userId: text("user_id"),
    version: integer("version").notNull(),
  },
  (table) => [
    uniqueIndex("external_identity_oauth_transactions_state_idx").on(table.stateHash),
    index("external_identity_oauth_transactions_instance_idx").on(table.instanceId, table.providerId),
    index("external_identity_oauth_transactions_expiry_idx").on(table.expiresAt),
  ],
)

export type ExternalIdentityOAuthTransactionRow = typeof externalIdentityOAuthTransactionTable.$inferSelect
