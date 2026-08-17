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
      transaction.run("DROP INDEX IF EXISTS email_otp_challenges_instance_email_idx")
      transaction.run("DROP INDEX IF EXISTS email_otp_challenges_instance_user_idx")
      transaction.run("DROP INDEX IF EXISTS instance_domains_instance_id_idx")
      transaction.run("DROP INDEX IF EXISTS password_challenges_user_kind_idx")
      transaction.run("DROP INDEX IF EXISTS password_challenges_token_hash_idx")
      transaction.run("DROP INDEX IF EXISTS password_lockouts_instance_id_idx")
      transaction.run("DROP INDEX IF EXISTS sessions_token_hash_idx")
      transaction.run("DROP INDEX IF EXISTS sessions_instance_user_idx")
      transaction.run("DROP INDEX IF EXISTS sessions_instance_last_used_idx")
      transaction.run("DROP INDEX IF EXISTS external_identity_providers_instance_idx")
      transaction.run("DROP INDEX IF EXISTS external_identity_providers_organization_idx")
      transaction.run("DROP INDEX IF EXISTS external_identity_providers_instance_type_org_idx")
      transaction.run("DROP INDEX IF EXISTS external_identities_provider_subject_idx")
      transaction.run("DROP INDEX IF EXISTS external_identities_instance_user_idx")
      transaction.run("DROP INDEX IF EXISTS external_identities_instance_provider_idx")
      transaction.run("DROP INDEX IF EXISTS external_identity_oauth_transactions_state_idx")
      transaction.run("DROP INDEX IF EXISTS external_identity_oauth_transactions_instance_idx")
      transaction.run("DROP INDEX IF EXISTS external_identity_oauth_transactions_expiry_idx")
      transaction.run("DROP TABLE IF EXISTS events")
      transaction.run("DROP TABLE IF EXISTS sessions")
      transaction.run("DROP TABLE IF EXISTS external_identity_oauth_transactions")
      transaction.run("DROP TABLE IF EXISTS external_identities")
      transaction.run("DROP TABLE IF EXISTS external_identity_providers")
      transaction.run("DROP TABLE IF EXISTS email_otp_challenges")
      transaction.run("DROP TABLE IF EXISTS password_challenges")
      transaction.run("DROP TABLE IF EXISTS password_lockouts")
      transaction.run("DROP TABLE IF EXISTS password_policies")
      transaction.run("DROP TABLE IF EXISTS password_credentials")
      transaction.run("DROP TABLE IF EXISTS organization_invitations")
      transaction.run("DROP TABLE IF EXISTS organization_memberships")
      transaction.run("DROP TABLE IF EXISTS user_profiles")
      transaction.run("DROP TABLE IF EXISTS users")
      transaction.run("DROP TABLE IF EXISTS organizations")
      transaction.run("DROP TABLE IF EXISTS instance_bootstrap_admins")
      transaction.run("DROP TABLE IF EXISTS instance_domains")
      transaction.run("DROP TABLE IF EXISTS instances")
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
