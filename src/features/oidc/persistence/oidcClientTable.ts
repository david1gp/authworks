import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

export const oidcClientTable = sqliteTable(
  "oidc_clients",
  {
    allowedScopes: text("allowed_scopes").notNull(),
    clientType: text("client_type").notNull(),
    createdAt: integer("created_at").notNull(),
    id: text("id").primaryKey(),
    realmId: text("realm_id").notNull(),
    name: text("name").notNull(),
    postLogoutRedirectUris: text("post_logout_redirect_uris").notNull(),
    redirectUris: text("redirect_uris").notNull(),
    requireConsent: integer("require_consent").notNull(),
    secretHash: text("secret_hash"),
    status: text("status").notNull(),
    trusted: integer("trusted").notNull(),
    updatedAt: integer("updated_at").notNull(),
    version: integer("version").notNull(),
    projectId: text("project_id"),
    applicationId: text("application_id"),
  },
  (table) => [
    index("oidc_clients_realm_id_idx").on(table.realmId),
    uniqueIndex("oidc_clients_realm_application_idx").on(table.realmId, table.applicationId),
  ],
)

export type OidcClientRow = typeof oidcClientTable.$inferSelect
