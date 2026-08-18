import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const userProfileTable = sqliteTable(
  "user_profiles",
  {
    displayName: text("display_name"),
    firstName: text("first_name"),
    gender: text("gender"),
    realmId: text("realm_id").notNull(),
    lastName: text("last_name"),
    nickName: text("nick_name"),
    preferredLanguage: text("preferred_language"),
    updatedAt: integer("updated_at").notNull(),
    userId: text("user_id").primaryKey(),
  },
  (table) => [index("user_profiles_realm_id_idx").on(table.realmId)],
)

export type UserProfileRow = typeof userProfileTable.$inferSelect
