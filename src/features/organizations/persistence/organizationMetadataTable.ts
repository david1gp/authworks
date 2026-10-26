import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const organizationMetadataTable = sqliteTable(
  "organization_metadata",
  {
    createdAt: integer("created_at").notNull(),
    key: text("key").notNull(),
    organizationId: text("organization_id").notNull(),
    realmId: text("realm_id").notNull(),
    updatedAt: integer("updated_at").notNull(),
    value: text("value").notNull(),
    version: integer("version").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.realmId, table.organizationId, table.key] }),
    index("organization_metadata_realm_organization_idx").on(table.realmId, table.organizationId),
  ],
)

export type OrganizationMetadataRow = typeof organizationMetadataTable.$inferSelect
