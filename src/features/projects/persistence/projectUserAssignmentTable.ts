import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

export const projectUserAssignmentTable = sqliteTable(
  "project_user_assignments",
  {
    createdAt: integer("created_at").notNull(),
    id: text("id").primaryKey(),
    realmId: text("realm_id").notNull(),
    projectId: text("project_id").notNull(),
    roleKeys: text("role_keys").notNull(),
    updatedAt: integer("updated_at").notNull(),
    userId: text("user_id").notNull(),
    version: integer("version").notNull(),
  },
  (table) => [
    index("project_user_assignments_realm_id_idx").on(table.realmId),
    index("project_user_assignments_project_id_idx").on(table.projectId),
    index("project_user_assignments_user_id_idx").on(table.userId),
    uniqueIndex("project_user_assignments_realm_project_user_idx").on(table.realmId, table.projectId, table.userId),
  ],
)

export type ProjectUserAssignmentRow = typeof projectUserAssignmentTable.$inferSelect
