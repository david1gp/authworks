import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const instanceBootstrapAdminTable = sqliteTable("instance_bootstrap_admins", {
  createdAt: integer("created_at").notNull(),
  instanceId: text("instance_id").primaryKey(),
  secretHash: text("secret_hash").notNull(),
  adminId: text("admin_id").notNull().unique(),
})

export type InstanceBootstrapAdminRow = typeof instanceBootstrapAdminTable.$inferSelect
