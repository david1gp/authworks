import { sqliteTable, text } from "drizzle-orm/sqlite-core"

export const realmDomainTable = sqliteTable("realm_domains", {
  domain: text("domain").primaryKey(),
  realmId: text("realm_id").notNull(),
  isPrimary: text("is_primary").notNull(),
})

export type RealmDomainRow = typeof realmDomainTable.$inferSelect
