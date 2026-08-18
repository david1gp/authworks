import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const realmBootstrapAdminTable = sqliteTable("realm_bootstrap_admins", {
  createdAt: integer("created_at").notNull(),
  realmId: text("realm_id").primaryKey(),
  secretHash: text("secret_hash").notNull(),
  adminId: text("admin_id").notNull().unique(),
})

export type RealmBootstrapAdminRow = typeof realmBootstrapAdminTable.$inferSelect
