import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const organizationLoginPolicyTable = sqliteTable("organization_login_policies", {
  allowDomainDiscovery: integer("allow_domain_discovery", { mode: "boolean" }),
  allowEmailOtp: integer("allow_email_otp", { mode: "boolean" }),
  allowExternalIdentity: integer("allow_external_identity", { mode: "boolean" }),
  allowPassword: integer("allow_password", { mode: "boolean" }),
  allowPasswordRecovery: integer("allow_password_recovery", { mode: "boolean" }),
  allowPasskey: integer("allow_passkey", { mode: "boolean" }),
  allowRegistration: integer("allow_registration", { mode: "boolean" }),
  realmId: text("realm_id").notNull(),
  organizationId: text("organization_id").primaryKey(),
  providerIds: text("provider_ids"),
  updatedAt: integer("updated_at").notNull(),
  version: integer("version").notNull(),
})

export type OrganizationLoginPolicyRow = typeof organizationLoginPolicyTable.$inferSelect
