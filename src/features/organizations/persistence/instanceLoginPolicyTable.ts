import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const instanceLoginPolicyTable = sqliteTable("instance_login_policies", {
  allowDomainDiscovery: integer("allow_domain_discovery", { mode: "boolean" }).notNull(),
  allowEmailOtp: integer("allow_email_otp", { mode: "boolean" }).notNull(),
  allowExternalIdentity: integer("allow_external_identity", { mode: "boolean" }).notNull(),
  allowPassword: integer("allow_password", { mode: "boolean" }).notNull(),
  allowPasswordRecovery: integer("allow_password_recovery", { mode: "boolean" }).notNull(),
  allowPasskey: integer("allow_passkey", { mode: "boolean" }).notNull(),
  allowRegistration: integer("allow_registration", { mode: "boolean" }).notNull(),
  instanceId: text("instance_id").primaryKey(),
  providerIds: text("provider_ids"),
  updatedAt: integer("updated_at").notNull(),
  version: integer("version").notNull(),
})

export type InstanceLoginPolicyRow = typeof instanceLoginPolicyTable.$inferSelect
