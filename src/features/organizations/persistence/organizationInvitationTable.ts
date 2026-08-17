import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

export const organizationInvitationTable = sqliteTable(
  "organization_invitations",
  {
    acceptedAt: integer("accepted_at"),
    createdAt: integer("created_at").notNull(),
    email: text("email").notNull(),
    expiresAt: integer("expires_at").notNull(),
    id: text("id").primaryKey(),
    instanceId: text("instance_id").notNull(),
    invitedBy: text("invited_by").notNull(),
    organizationId: text("organization_id").notNull(),
    roles: text("roles").notNull(),
    status: text("status").notNull(),
    tokenHash: text("token_hash").notNull(),
    updatedAt: integer("updated_at").notNull(),
    version: integer("version").notNull(),
  },
  (table) => [
    index("organization_invitations_organization_id_idx").on(table.organizationId),
    index("organization_invitations_instance_id_idx").on(table.instanceId),
    uniqueIndex("organization_invitations_token_hash_idx").on(table.tokenHash),
  ],
)

export type OrganizationInvitationRow = typeof organizationInvitationTable.$inferSelect
