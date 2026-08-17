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
      transaction.run("DROP INDEX IF EXISTS instance_domains_instance_id_idx")
      transaction.run("DROP INDEX IF EXISTS password_challenges_user_kind_idx")
      transaction.run("DROP INDEX IF EXISTS password_challenges_token_hash_idx")
      transaction.run("DROP INDEX IF EXISTS password_lockouts_instance_id_idx")
      transaction.run("DROP TABLE IF EXISTS events")
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
