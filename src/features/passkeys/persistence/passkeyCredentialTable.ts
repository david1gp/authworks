import { blob, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

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
    realmId: text("realm_id").notNull(),
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
    index("passkey_credentials_realm_user_idx").on(table.realmId, table.userId),
    index("passkey_credentials_realm_rp_idx").on(table.realmId, table.rpId),
  ],
)

export type PasskeyCredentialRow = typeof passkeyCredentialTable.$inferSelect
