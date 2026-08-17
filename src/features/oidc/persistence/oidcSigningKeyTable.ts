import { index, integer, sqliteTable } from "drizzle-orm/sqlite-core"
import { text } from "drizzle-orm/sqlite-core"

export const oidcSigningKeyTable = sqliteTable(
  "oidc_signing_keys",
  {
    algorithm: text("algorithm").notNull(),
    createdAt: integer("created_at").notNull(),
    encryptedPrivateKey: text("encrypted_private_key").notNull(),
    id: text("id").primaryKey(),
    instanceId: text("instance_id").notNull(),
    publicJwk: text("public_jwk").notNull(),
    status: text("status").notNull(),
    retiredAt: integer("retired_at"),
  },
  (table) => [
    index("oidc_signing_keys_instance_id_idx").on(table.instanceId, table.id),
    index("oidc_signing_keys_instance_status_idx").on(table.instanceId, table.status),
  ],
)

export type OidcSigningKeyRow = typeof oidcSigningKeyTable.$inferSelect
