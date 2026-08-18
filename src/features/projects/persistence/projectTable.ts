import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

export const projectTable = sqliteTable(
  "projects",
  {
    authorizationRequired: integer("authorization_required").notNull(),
    createdAt: integer("created_at").notNull(),
    id: text("id").primaryKey(),
    realmId: text("realm_id").notNull(),
    name: text("name").notNull(),
    organizationId: text("organization_id").notNull(),
    projectAccessRequired: integer("project_access_required").notNull(),
    status: text("status").notNull(),
    updatedAt: integer("updated_at").notNull(),
    version: integer("version").notNull(),
  },
  (table) => [
    index("projects_realm_id_idx").on(table.realmId),
    index("projects_organization_id_idx").on(table.organizationId),
    uniqueIndex("projects_organization_name_idx").on(table.organizationId, table.name),
  ],
)

export type ProjectRow = typeof projectTable.$inferSelect
