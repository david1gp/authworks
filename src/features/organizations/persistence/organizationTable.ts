import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

export const organizationTable = sqliteTable(
  "organizations",
  {
    createdAt: integer("created_at").notNull(),
    id: text("id").primaryKey(),
    realmId: text("realm_id").notNull(),
    name: text("name").notNull(),
    status: text("status").notNull(),
    updatedAt: integer("updated_at").notNull(),
    version: integer("version").notNull(),
  },
  (table) => [
    index("organizations_realm_id_idx").on(table.realmId),
    uniqueIndex("organizations_realm_name_idx").on(table.realmId, table.name),
  ],
)

export type OrganizationRow = typeof organizationTable.$inferSelect
