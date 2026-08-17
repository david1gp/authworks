import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

export const passwordChallengeTable = sqliteTable(
  "password_challenges",
  {
    consumedAt: integer("consumed_at"),
    createdAt: integer("created_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
    id: text("id").primaryKey(),
    instanceId: text("instance_id").notNull(),
    kind: text("kind").notNull(),
    tokenHash: text("token_hash").notNull(),
    userId: text("user_id").notNull(),
    version: integer("version").notNull(),
  },
  (table) => [
    uniqueIndex("password_challenges_token_hash_idx").on(table.tokenHash),
    index("password_challenges_user_kind_idx").on(table.instanceId, table.userId, table.kind),
  ],
)

export type PasswordChallengeRow = typeof passwordChallengeTable.$inferSelect
