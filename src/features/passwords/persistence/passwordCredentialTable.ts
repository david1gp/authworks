import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const passwordCredentialTable = sqliteTable("password_credentials", {
  changedAt: integer("changed_at").notNull(),
  createdAt: integer("created_at").notNull(),
  hash: text("hash").notNull(),
  passwordChangeRequired: integer("password_change_required").notNull(),
  realmId: text("realm_id").notNull(),
  userId: text("user_id").primaryKey(),
  version: integer("version").notNull(),
})

export type PasswordCredentialRow = typeof passwordCredentialTable.$inferSelect
