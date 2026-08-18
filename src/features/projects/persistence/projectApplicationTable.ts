import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const projectApplicationTable = sqliteTable(
  "project_applications",
  {
    applicationType: text("application_type").notNull(),
    createdAt: integer("created_at").notNull(),
    id: text("id").primaryKey(),
    realmId: text("realm_id").notNull(),
    name: text("name").notNull(),
    projectId: text("project_id").notNull(),
    status: text("status").notNull(),
    updatedAt: integer("updated_at").notNull(),
    version: integer("version").notNull(),
  },
  (table) => [
    index("project_applications_realm_id_idx").on(table.realmId),
    index("project_applications_project_id_idx").on(table.projectId),
  ],
)

export type ProjectApplicationRow = typeof projectApplicationTable.$inferSelect
