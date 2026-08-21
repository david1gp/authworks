import { type Result } from "#result"
import { resultErrorCreate } from "../errors/resultErrorCreate.js"
import type { StorageDatabase } from "./storageDatabaseOpen.js"
import { storageSchemaCreate } from "./storageSchemaCreate.js"

class StorageResetRollback extends Error {
  readonly result: Extract<Result<void>, { success: false }>

  constructor(result: Extract<Result<void>, { success: false }>) {
    super(result.errorMessage)
    this.result = result
  }
}

export function storageDatabaseReset(database: StorageDatabase): Result<void> {
  const op = "storageDatabaseReset"

  try {
    return database.db.transaction((transaction) => {
      transaction.run("DROP TRIGGER IF EXISTS events_append_only_update")
      transaction.run("DROP TRIGGER IF EXISTS events_append_only_delete")
      transaction.run("DROP INDEX IF EXISTS events_aggregate_version_idx")
      transaction.run("DROP INDEX IF EXISTS email_otp_challenges_realm_email_idx")
      transaction.run("DROP INDEX IF EXISTS email_otp_challenges_realm_user_idx")
      transaction.run("DROP INDEX IF EXISTS realm_domains_realm_id_idx")
      transaction.run("DROP INDEX IF EXISTS organization_domains_realm_idx")
      transaction.run("DROP INDEX IF EXISTS organization_domains_organization_idx")
      transaction.run("DROP INDEX IF EXISTS organization_domains_organization_primary_idx")
      transaction.run("DROP INDEX IF EXISTS organization_domains_one_primary_idx")
      transaction.run("DROP INDEX IF EXISTS password_challenges_user_kind_idx")
      transaction.run("DROP INDEX IF EXISTS password_challenges_token_hash_idx")
      transaction.run("DROP INDEX IF EXISTS password_lockouts_realm_id_idx")
      transaction.run("DROP INDEX IF EXISTS sessions_token_hash_idx")
      transaction.run("DROP INDEX IF EXISTS sessions_realm_subject_idx")
      transaction.run("DROP INDEX IF EXISTS sessions_realm_user_idx")
      transaction.run("DROP INDEX IF EXISTS sessions_realm_last_used_idx")
      transaction.run("DROP INDEX IF EXISTS mfa_challenges_token_hash_idx")
      transaction.run("DROP INDEX IF EXISTS mfa_challenges_realm_user_idx")
      transaction.run("DROP INDEX IF EXISTS mfa_recovery_codes_hash_idx")
      transaction.run("DROP INDEX IF EXISTS mfa_recovery_codes_realm_user_idx")
      transaction.run("DROP INDEX IF EXISTS mfa_totp_enrollments_realm_user_idx")
      transaction.run("DROP INDEX IF EXISTS mfa_totp_enrollments_active_user_idx")
      transaction.run("DROP INDEX IF EXISTS mfa_lockouts_realm_idx")
      transaction.run("DROP INDEX IF EXISTS passkey_credentials_rp_credential_idx")
      transaction.run("DROP INDEX IF EXISTS passkey_credentials_realm_user_idx")
      transaction.run("DROP INDEX IF EXISTS passkey_credentials_realm_rp_idx")
      transaction.run("DROP INDEX IF EXISTS passkey_ceremonies_token_hash_idx")
      transaction.run("DROP INDEX IF EXISTS passkey_ceremonies_realm_expiry_idx")
      transaction.run("DROP INDEX IF EXISTS passkey_ceremonies_realm_user_idx")
      transaction.run("DROP INDEX IF EXISTS external_identity_providers_realm_idx")
      transaction.run("DROP INDEX IF EXISTS external_identity_providers_organization_idx")
      transaction.run("DROP INDEX IF EXISTS external_identity_providers_realm_type_org_idx")
      transaction.run("DROP INDEX IF EXISTS external_identities_provider_subject_idx")
      transaction.run("DROP INDEX IF EXISTS external_identities_realm_user_idx")
      transaction.run("DROP INDEX IF EXISTS external_identities_realm_provider_idx")
      transaction.run("DROP INDEX IF EXISTS external_identity_oauth_transactions_state_idx")
      transaction.run("DROP INDEX IF EXISTS external_identity_oauth_transactions_realm_idx")
      transaction.run("DROP INDEX IF EXISTS external_identity_oauth_transactions_expiry_idx")
      transaction.run("DROP INDEX IF EXISTS oidc_clients_realm_id_idx")
      transaction.run("DROP INDEX IF EXISTS oidc_clients_realm_application_idx")
      transaction.run("DROP INDEX IF EXISTS oidc_signing_keys_realm_status_idx")
      transaction.run("DROP INDEX IF EXISTS oidc_signing_keys_one_active_idx")
      transaction.run("DROP INDEX IF EXISTS oidc_authorization_requests_realm_idx")
      transaction.run("DROP INDEX IF EXISTS oidc_authorization_requests_expiry_idx")
      transaction.run("DROP INDEX IF EXISTS oidc_authorization_codes_realm_idx")
      transaction.run("DROP INDEX IF EXISTS oidc_access_tokens_realm_user_idx")
      transaction.run("DROP INDEX IF EXISTS oidc_access_tokens_refresh_family_idx")
      transaction.run("DROP INDEX IF EXISTS oidc_refresh_tokens_realm_user_idx")
      transaction.run("DROP INDEX IF EXISTS oidc_refresh_tokens_family_idx")
      transaction.run("DROP INDEX IF EXISTS oidc_consents_realm_idx")
      transaction.run("DROP TABLE IF EXISTS events")
      transaction.run("DROP TABLE IF EXISTS oidc_consents")
      transaction.run("DROP TABLE IF EXISTS oidc_refresh_tokens")
      transaction.run("DROP TABLE IF EXISTS oidc_access_tokens")
      transaction.run("DROP TABLE IF EXISTS oidc_authorization_codes")
      transaction.run("DROP TABLE IF EXISTS oidc_authorization_requests")
      transaction.run("DROP TABLE IF EXISTS oidc_signing_keys")
      transaction.run("DROP TABLE IF EXISTS oidc_clients")
      transaction.run("DROP TABLE IF EXISTS mfa_challenges")
      transaction.run("DROP TABLE IF EXISTS mfa_recovery_codes")
      transaction.run("DROP TABLE IF EXISTS mfa_totp_enrollments")
      transaction.run("DROP TABLE IF EXISTS mfa_lockouts")
      transaction.run("DROP TABLE IF EXISTS passkey_ceremonies")
      transaction.run("DROP TABLE IF EXISTS passkey_credentials")
      transaction.run("DROP TABLE IF EXISTS mfa_policies")
      transaction.run("DROP TABLE IF EXISTS sessions")
      transaction.run("DROP TABLE IF EXISTS external_identity_oauth_transactions")
      transaction.run("DROP TABLE IF EXISTS external_identities")
      transaction.run("DROP TABLE IF EXISTS external_identity_providers")
      transaction.run("DROP TABLE IF EXISTS email_otp_challenges")
      transaction.run("DROP TABLE IF EXISTS password_challenges")
      transaction.run("DROP TABLE IF EXISTS password_lockouts")
      transaction.run("DROP TABLE IF EXISTS password_policies")
      transaction.run("DROP TABLE IF EXISTS password_credentials")
      transaction.run("DROP TABLE IF EXISTS project_grants")
      transaction.run("DROP TABLE IF EXISTS project_roles")
      transaction.run("DROP TABLE IF EXISTS project_applications")
      transaction.run("DROP TABLE IF EXISTS projects")
      transaction.run("DROP TABLE IF EXISTS organization_invitations")
      transaction.run("DROP TABLE IF EXISTS organization_login_policies")
      transaction.run("DROP TABLE IF EXISTS realm_login_policies")
      transaction.run("DROP TABLE IF EXISTS organization_branding")
      transaction.run("DROP TABLE IF EXISTS organization_domains")
      transaction.run("DROP TABLE IF EXISTS organization_memberships")
      transaction.run("DROP TABLE IF EXISTS user_profiles")
      transaction.run("DROP TABLE IF EXISTS users")
      transaction.run("DROP TABLE IF EXISTS organizations")
      transaction.run("DROP TABLE IF EXISTS realm_bootstrap_admins")
      transaction.run("DROP TABLE IF EXISTS realm_domains")
      transaction.run("DROP TABLE IF EXISTS realms")
      transaction.run("DROP TABLE IF EXISTS current_state")

      const schema = storageSchemaCreate(transaction)
      if (!schema.success) throw new StorageResetRollback(schema)
      return schema
    })
  } catch (error: unknown) {
    if (error instanceof StorageResetRollback) return error.result
    return resultErrorCreate(op, "The SQLite database could not be reset.")
  }
}
