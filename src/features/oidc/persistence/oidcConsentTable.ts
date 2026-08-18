import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

export const oidcConsentTable = sqliteTable(
  "oidc_consents",
  {
    clientId: text("client_id").notNull(),
    createdAt: integer("created_at").notNull(),
    realmId: text("realm_id").notNull(),
    scope: text("scope").notNull(),
    updatedAt: integer("updated_at").notNull(),
    revokedAt: integer("revoked_at"),
    userId: text("user_id").notNull(),
  },
  (table) => [
    uniqueIndex("oidc_consents_user_client_idx").on(table.realmId, table.userId, table.clientId),
    index("oidc_consents_realm_idx").on(table.realmId),
  ],
)

export type OidcConsentRow = typeof oidcConsentTable.$inferSelect
