import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

export const machineUserTable = sqliteTable(
  "machine_users",
  {
    createdAt: integer("created_at").notNull(),
    displayName: text("display_name").notNull(),
    id: text("id").primaryKey(),
    instanceId: text("instance_id").notNull(),
    scopes: text("scopes").notNull(),
    status: text("status").notNull(),
    updatedAt: integer("updated_at").notNull(),
    userName: text("user_name").notNull(),
    version: integer("version").notNull(),
  },
  (table) => [
    index("machine_users_instance_id_idx").on(table.instanceId),
    uniqueIndex("machine_users_instance_user_name_idx").on(table.instanceId, table.userName),
  ],
)

export type MachineUserRow = typeof machineUserTable.$inferSelect
