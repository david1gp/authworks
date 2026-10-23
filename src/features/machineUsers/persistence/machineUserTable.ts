import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

export const machineUserTable = sqliteTable(
  "machine_users",
  {
    createdAt: integer("created_at").notNull(),
    displayName: text("display_name").notNull(),
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    realmId: text("realm_id").notNull(),
    scopes: text("scopes").notNull(),
    status: text("status").notNull(),
    updatedAt: integer("updated_at").notNull(),
    userName: text("user_name").notNull(),
    version: integer("version").notNull(),
  },
  (table) => [
    index("machine_users_realm_id_idx").on(table.realmId),
    index("machine_users_organization_id_idx").on(table.realmId, table.organizationId),
    uniqueIndex("machine_users_organization_user_name_idx").on(table.organizationId, table.userName),
  ],
)

export type MachineUserRow = typeof machineUserTable.$inferSelect
