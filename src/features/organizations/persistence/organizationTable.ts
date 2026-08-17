import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

export const organizationTable = sqliteTable(
  "organizations",
  {
    createdAt: integer("created_at").notNull(),
    id: text("id").primaryKey(),
    instanceId: text("instance_id").notNull(),
    name: text("name").notNull(),
    status: text("status").notNull(),
    updatedAt: integer("updated_at").notNull(),
    version: integer("version").notNull(),
  },
  (table) => [
    index("organizations_instance_id_idx").on(table.instanceId),
    uniqueIndex("organizations_instance_name_idx").on(table.instanceId, table.name),
  ],
)

export type OrganizationRow = typeof organizationTable.$inferSelect
