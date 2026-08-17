import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const passwordCredentialTable = sqliteTable("password_credentials", {
  changedAt: integer("changed_at").notNull(),
  createdAt: integer("created_at").notNull(),
  hash: text("hash").notNull(),
  instanceId: text("instance_id").notNull(),
  userId: text("user_id").primaryKey(),
  version: integer("version").notNull(),
})

export type PasswordCredentialRow = typeof passwordCredentialTable.$inferSelect
