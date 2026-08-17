import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

export const organizationMembershipTable = sqliteTable(
  "organization_memberships",
  {
    createdAt: integer("created_at").notNull(),
    id: text("id").primaryKey(),
    instanceId: text("instance_id").notNull(),
    organizationId: text("organization_id").notNull(),
    roles: text("roles").notNull(),
    updatedAt: integer("updated_at").notNull(),
    userId: text("user_id").notNull(),
    version: integer("version").notNull(),
  },
  (table) => [
    index("organization_memberships_organization_id_idx").on(table.organizationId),
    index("organization_memberships_instance_id_idx").on(table.instanceId),
    uniqueIndex("organization_memberships_organization_user_idx").on(table.organizationId, table.userId),
  ],
)

export type OrganizationMembershipRow = typeof organizationMembershipTable.$inferSelect
