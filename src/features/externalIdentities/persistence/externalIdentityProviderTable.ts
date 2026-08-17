import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

export const externalIdentityProviderTable = sqliteTable(
  "external_identity_providers",
  {
    allowAccountCreation: integer("allow_account_creation", { mode: "boolean" }).notNull(),
    clientId: text("client_id").notNull(),
    clientSecret: text("client_secret").notNull(),
    createdAt: integer("created_at").notNull(),
    displayName: text("display_name").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull(),
    id: text("id").primaryKey(),
    instanceId: text("instance_id").notNull(),
    organizationId: text("organization_id"),
    redirectUri: text("redirect_uri").notNull(),
    scopes: text("scopes").notNull(),
    type: text("type").notNull(),
    updatedAt: integer("updated_at").notNull(),
    version: integer("version").notNull(),
  },
  (table) => [
    index("external_identity_providers_instance_idx").on(table.instanceId),
    index("external_identity_providers_organization_idx").on(table.instanceId, table.organizationId),
    uniqueIndex("external_identity_providers_instance_type_org_idx").on(
      table.instanceId,
      table.type,
      table.organizationId,
    ),
  ],
)

export type ExternalIdentityProviderRow = typeof externalIdentityProviderTable.$inferSelect
