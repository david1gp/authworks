import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

export const userTable = sqliteTable(
  "users",
  {
    createdAt: integer("created_at").notNull(),
    deletedAt: integer("deleted_at"),
    email: text("email").notNull(),
    emailVerifiedAt: integer("email_verified_at"),
    id: text("id").primaryKey(),
    realmId: text("realm_id").notNull(),
    state: text("state").notNull(),
    updatedAt: integer("updated_at").notNull(),
    userName: text("user_name").notNull(),
    version: integer("version").notNull(),
  },
  (table) => [
    index("users_realm_id_idx").on(table.realmId),
    uniqueIndex("users_realm_user_name_idx").on(table.realmId, table.userName),
    uniqueIndex("users_realm_email_idx").on(table.realmId, table.email),
  ],
)

export type UserRow = typeof userTable.$inferSelect
