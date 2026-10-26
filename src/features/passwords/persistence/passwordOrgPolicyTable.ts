import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const passwordOrgPolicyTable = sqliteTable(
  "password_org_policies",
  {
    lockoutDurationMs: integer("lockout_duration_ms").notNull(),
    maxAgeDays: integer("max_age_days"),
    maximumAttempts: integer("maximum_attempts").notNull(),
    minimumLength: integer("minimum_length").notNull(),
    organizationId: text("organization_id").notNull(),
    realmId: text("realm_id").notNull(),
    requireLowercase: integer("require_lowercase").notNull(),
    requireNumber: integer("require_number").notNull(),
    requireSymbol: integer("require_symbol").notNull(),
    requireUppercase: integer("require_uppercase").notNull(),
    updatedAt: integer("updated_at").notNull(),
    version: integer("version").notNull(),
  },
  (table) => [primaryKey({ columns: [table.realmId, table.organizationId] })],
)

export type PasswordOrgPolicyRow = typeof passwordOrgPolicyTable.$inferSelect
