import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

export const oidcInteractionTable = sqliteTable(
  "oidc_interactions",
  {
    authorizationRequestId: text("authorization_request_id"),
    bindingHash: text("binding_hash").notNull(),
    completedAt: integer("completed_at"),
    createdAt: integer("created_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
    handleHash: text("handle_hash").notNull(),
    id: text("id").primaryKey(),
    realmId: text("realm_id").notNull(),
    requestEncrypted: text("request_encrypted").notNull(),
    resumePath: text("resume_path").notNull(),
    sessionId: text("session_id"),
    userId: text("user_id"),
  },
  (table) => [
    uniqueIndex("oidc_interactions_handle_idx").on(table.handleHash),
    index("oidc_interactions_realm_idx").on(table.realmId),
    index("oidc_interactions_expiry_idx").on(table.expiresAt),
  ],
)

export type OidcInteractionRow = typeof oidcInteractionTable.$inferSelect
