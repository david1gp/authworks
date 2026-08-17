import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

export const projectRoleTable = sqliteTable(
  "project_roles",
  {
    createdAt: integer("created_at").notNull(),
    displayName: text("display_name").notNull(),
    group: text("group_name"),
    id: text("id").primaryKey(),
    instanceId: text("instance_id").notNull(),
    key: text("key").notNull(),
    projectId: text("project_id").notNull(),
    updatedAt: integer("updated_at").notNull(),
    version: integer("version").notNull(),
  },
  (table) => [
    index("project_roles_instance_id_idx").on(table.instanceId),
    index("project_roles_project_id_idx").on(table.projectId),
    uniqueIndex("project_roles_project_key_idx").on(table.projectId, table.key),
  ],
)

export type ProjectRoleRow = typeof projectRoleTable.$inferSelect
