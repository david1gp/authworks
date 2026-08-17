import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

export const machineCredentialTable = sqliteTable(
  "machine_credentials",
  {
    createdAt: integer("created_at").notNull(),
    expiresAt: integer("expires_at"),
    id: text("id").primaryKey(),
    instanceId: text("instance_id").notNull(),
    kind: text("kind").notNull(),
    machineUserId: text("machine_user_id").notNull(),
    name: text("name"),
    replacedById: text("replaced_by_id"),
    revokedAt: integer("revoked_at"),
    scopes: text("scopes").notNull(),
    secretHash: text("secret_hash").notNull(),
    version: integer("version").notNull(),
  },
  (table) => [
    index("machine_credentials_instance_id_idx").on(table.instanceId),
    index("machine_credentials_machine_user_id_idx").on(table.instanceId, table.machineUserId),
    uniqueIndex("machine_credentials_secret_hash_idx").on(table.secretHash),
  ],
)

export type MachineCredentialRow = typeof machineCredentialTable.$inferSelect
