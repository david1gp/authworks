import { index, integer, sqliteTable, text, uniqueIndex, blob } from "drizzle-orm/sqlite-core"

export const passkeyCredentialTable = sqliteTable(
  "passkey_credentials",
  {
    aaguid: text("aaguid").notNull(),
    backedUp: integer("backed_up").notNull(),
    counter: integer("counter").notNull(),
    createdAt: integer("created_at").notNull(),
    credentialId: text("credential_id").notNull(),
    deviceType: text("device_type").notNull(),
    id: text("id").primaryKey(),
    instanceId: text("instance_id").notNull(),
    lastUsedAt: integer("last_used_at"),
    publicKey: blob("public_key", { mode: "buffer" }).notNull(),
    revokedAt: integer("revoked_at"),
    rpId: text("rp_id").notNull(),
    transports: text("transports").notNull(),
    userId: text("user_id").notNull(),
    version: integer("version").notNull(),
  },
  (table) => [
    uniqueIndex("passkey_credentials_rp_credential_idx").on(table.rpId, table.credentialId),
    index("passkey_credentials_instance_user_idx").on(table.instanceId, table.userId),
    index("passkey_credentials_instance_rp_idx").on(table.instanceId, table.rpId),
  ],
)

export type PasskeyCredentialRow = typeof passkeyCredentialTable.$inferSelect
