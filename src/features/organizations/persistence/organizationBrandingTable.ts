import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const organizationBrandingTable = sqliteTable("organization_branding", {
  branding: text("branding").notNull(),
  instanceId: text("instance_id").notNull(),
  organizationId: text("organization_id").primaryKey(),
  updatedAt: integer("updated_at").notNull(),
  version: integer("version").notNull(),
})

export type OrganizationBrandingRow = typeof organizationBrandingTable.$inferSelect
