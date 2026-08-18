import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

export const externalIdentityTable = sqliteTable(
  "external_identities",
  {
    createdAt: integer("created_at").notNull(),
    displayName: text("display_name"),
    email: text("email"),
    emailVerified: integer("email_verified", { mode: "boolean" }).notNull(),
    externalSubject: text("external_subject").notNull(),
    id: text("id").primaryKey(),
    realmId: text("realm_id").notNull(),
    providerId: text("provider_id").notNull(),
    updatedAt: integer("updated_at").notNull(),
    userId: text("user_id").notNull(),
    username: text("username"),
    version: integer("version").notNull(),
  },
  (table) => [
    uniqueIndex("external_identities_provider_subject_idx").on(table.providerId, table.externalSubject),
    index("external_identities_realm_user_idx").on(table.realmId, table.userId),
    index("external_identities_realm_provider_idx").on(table.realmId, table.providerId),
  ],
)

export type ExternalIdentityRow = typeof externalIdentityTable.$inferSelect
