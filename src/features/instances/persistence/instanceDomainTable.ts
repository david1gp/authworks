import { sqliteTable, text } from "drizzle-orm/sqlite-core"

export const instanceDomainTable = sqliteTable("instance_domains", {
  domain: text("domain").primaryKey(),
  instanceId: text("instance_id").notNull(),
  isPrimary: text("is_primary").notNull(),
})

export type InstanceDomainRow = typeof instanceDomainTable.$inferSelect
