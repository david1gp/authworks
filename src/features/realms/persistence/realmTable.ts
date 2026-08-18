import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const realmTable = sqliteTable("realms", {
  bootstrapAdminId: text("bootstrap_admin_id"),
  bootstrapCompletedAt: integer("bootstrap_completed_at"),
  createdAt: integer("created_at").notNull(),
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  primaryDomain: text("primary_domain").notNull().unique(),
  status: text("status").notNull(),
  updatedAt: integer("updated_at").notNull(),
  version: integer("version").notNull(),
})

export type RealmRow = typeof realmTable.$inferSelect
