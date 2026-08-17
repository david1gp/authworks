import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const organizationDomainTable = sqliteTable(
  "organization_domains",
  {
    createdAt: integer("created_at").notNull(),
    domain: text("domain").primaryKey(),
    instanceId: text("instance_id").notNull(),
    isPrimary: integer("is_primary", { mode: "boolean" }).notNull(),
    organizationId: text("organization_id").notNull(),
    updatedAt: integer("updated_at").notNull(),
    verificationTokenHash: text("verification_token_hash").notNull(),
    verified: integer("verified", { mode: "boolean" }).notNull(),
    version: integer("version").notNull(),
  },
  (table) => [
    index("organization_domains_instance_idx").on(table.instanceId),
    index("organization_domains_organization_idx").on(table.organizationId),
    index("organization_domains_organization_primary_idx").on(table.organizationId, table.isPrimary),
  ],
)

export type OrganizationDomainRow = typeof organizationDomainTable.$inferSelect
