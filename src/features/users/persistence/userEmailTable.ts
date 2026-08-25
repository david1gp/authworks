import { sql } from "drizzle-orm"
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

export const userEmailTable = sqliteTable(
  "user_emails",
  {
    createdAt: integer("created_at").notNull(),
    email: text("email").notNull(),
    id: text("id").primaryKey(),
    isPrimary: integer("is_primary", { mode: "boolean" }).notNull(),
    realmId: text("realm_id").notNull(),
    updatedAt: integer("updated_at").notNull(),
    userId: text("user_id").notNull(),
    verifiedAt: integer("verified_at"),
    version: integer("version").notNull(),
  },
  (table) => [
    index("user_emails_realm_user_idx").on(table.realmId, table.userId),
    uniqueIndex("user_emails_realm_email_idx").on(table.realmId, sql`lower(trim(${table.email}))`),
    uniqueIndex("user_emails_one_primary_idx").on(table.realmId, table.userId).where(sql`${table.isPrimary} = 1`),
  ],
)

export type UserEmailRow = typeof userEmailTable.$inferSelect
