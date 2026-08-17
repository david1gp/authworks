import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

export const mfaRecoveryCodeTable = sqliteTable(
  "mfa_recovery_codes",
  {
    codeHash: text("code_hash").notNull(),
    consumedAt: integer("consumed_at"),
    createdAt: integer("created_at").notNull(),
    id: text("id").primaryKey(),
    instanceId: text("instance_id").notNull(),
    userId: text("user_id").notNull(),
    version: integer("version").notNull(),
  },
  (table) => [
    uniqueIndex("mfa_recovery_codes_hash_idx").on(table.codeHash),
    index("mfa_recovery_codes_instance_user_idx").on(table.instanceId, table.userId),
  ],
)

export type MfaRecoveryCodeRow = typeof mfaRecoveryCodeTable.$inferSelect
