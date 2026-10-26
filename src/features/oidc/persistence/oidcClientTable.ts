import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

export const oidcClientTable = sqliteTable(
  "oidc_clients",
  {
    allowedScopes: text("allowed_scopes").notNull(),
    accessTokenRoleAssertion: integer("access_token_role_assertion").notNull().default(0),
    idTokenRoleAssertion: integer("id_token_role_assertion").notNull().default(0),
    clientType: text("client_type").notNull(),
    createdAt: integer("created_at").notNull(),
    id: text("id").primaryKey(),
    idTokenUserinfoAssertion: integer("id_token_userinfo_assertion").notNull().default(0),
    realmId: text("realm_id").notNull(),
    name: text("name").notNull(),
    postLogoutRedirectUris: text("post_logout_redirect_uris").notNull(),
    additionalOrigins: text("additional_origins").notNull().default("[]"),
    accessTokenLifetimeSeconds: integer("access_token_lifetime_seconds"),
    idTokenLifetimeSeconds: integer("id_token_lifetime_seconds"),
    refreshTokenIdleLifetimeSeconds: integer("refresh_token_idle_lifetime_seconds"),
    refreshTokenAbsoluteLifetimeSeconds: integer("refresh_token_absolute_lifetime_seconds"),
    grantTypes: text("grant_types").notNull().default('["authorization_code","refresh_token"]'),
    responseTypes: text("response_types").notNull().default('["code"]'),
    devMode: integer("dev_mode").notNull().default(0),
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
