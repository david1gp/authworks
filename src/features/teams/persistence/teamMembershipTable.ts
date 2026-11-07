import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

export const teamMembershipTable = sqliteTable(
  "team_memberships",
  {
    createdAt: integer("created_at").notNull(),
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    realmId: text("realm_id").notNull(),
    teamId: text("team_id").notNull(),
    updatedAt: integer("updated_at").notNull(),
    userId: text("user_id").notNull(),
    version: integer("version").notNull(),
  },
  (table) => [
    index("team_memberships_organization_id_idx").on(table.organizationId),
    index("team_memberships_team_id_idx").on(table.teamId),
    uniqueIndex("team_memberships_organization_user_idx").on(table.organizationId, table.userId),
  ],
)

export type TeamMembershipRow = typeof teamMembershipTable.$inferSelect
