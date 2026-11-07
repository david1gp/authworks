import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

export const teamTable = sqliteTable(
  "teams",
  {
    createdAt: integer("created_at").notNull(),
    id: text("id").primaryKey(),
    leaderUserId: text("leader_user_id").notNull(),
    name: text("name").notNull(),
    organizationId: text("organization_id").notNull(),
    realmId: text("realm_id").notNull(),
    slug: text("slug").notNull(),
    updatedAt: integer("updated_at").notNull(),
    version: integer("version").notNull(),
  },
  (table) => [
    index("teams_organization_id_idx").on(table.organizationId),
    index("teams_realm_id_idx").on(table.realmId),
    uniqueIndex("teams_organization_name_idx").on(table.organizationId, table.name),
    uniqueIndex("teams_organization_slug_idx").on(table.organizationId, table.slug),
  ],
)

export type TeamRow = typeof teamTable.$inferSelect
