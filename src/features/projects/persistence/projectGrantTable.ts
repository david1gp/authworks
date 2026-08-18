import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

export const projectGrantTable = sqliteTable(
  "project_grants",
  {
    createdAt: integer("created_at").notNull(),
    grantedOrganizationId: text("granted_organization_id").notNull(),
    id: text("id").primaryKey(),
    realmId: text("realm_id").notNull(),
    organizationId: text("organization_id").notNull(),
    projectId: text("project_id").notNull(),
    roleKeys: text("role_keys").notNull(),
    status: text("status").notNull(),
    updatedAt: integer("updated_at").notNull(),
    version: integer("version").notNull(),
  },
  (table) => [
    index("project_grants_realm_id_idx").on(table.realmId),
    index("project_grants_project_id_idx").on(table.projectId),
    index("project_grants_granted_organization_id_idx").on(table.grantedOrganizationId),
    uniqueIndex("project_grants_project_organization_idx").on(table.projectId, table.grantedOrganizationId),
  ],
)

export type ProjectGrantRow = typeof projectGrantTable.$inferSelect
