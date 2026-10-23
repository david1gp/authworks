import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const realmAdministratorTable = sqliteTable(
  "realm_administrators",
  {
    createdAt: integer("created_at").notNull(),
    createdBy: text("created_by"),
    realmId: text("realm_id").notNull(),
    userId: text("user_id").notNull(),
  },
  (table) => [primaryKey({ columns: [table.realmId, table.userId] })],
)

export type RealmAdministratorRow = typeof realmAdministratorTable.$inferSelect
