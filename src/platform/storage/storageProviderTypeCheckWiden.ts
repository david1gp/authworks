import type { Database } from "bun:sqlite"
import { type Result } from "#result"
import { resultCreate } from "../errors/resultCreate.js"
import { resultErrorCreate } from "../errors/resultErrorCreate.js"

const typeCheckPattern = /CHECK \(type IN \([^)]*\)\)/
const widenedTypeCheck = "CHECK (type IN ('google', 'github', 'microsoft', 'apple', 'oidc'))"

/**
 * Databases created before Apple support keep the narrower external provider type CHECK, which
 * SQLite cannot alter in place. Rebuild the table (SQLite's documented 12-step procedure) with
 * foreign keys disabled so linked external identities are not cascade-deleted. Must run outside a
 * transaction, before the schema is created.
 */
export function storageProviderTypeCheckWiden(sqlite: Database): Result<void> {
  const op = "storageProviderTypeCheckWiden"
  const row = sqlite
    .query("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'external_identity_providers'")
    .get() as { sql: string } | null
  const typeCheck = row?.sql.match(typeCheckPattern)?.[0]
  if (row === null || typeCheck === undefined || typeCheck === widenedTypeCheck) return resultCreate(undefined)

  const widenedSql = row.sql
    .replace(typeCheck, widenedTypeCheck)
    .replace(/^CREATE TABLE\s+"?external_identity_providers"?/, "CREATE TABLE external_identity_providers_widened")
  sqlite.run("PRAGMA foreign_keys = OFF")
  try {
    sqlite.transaction(() => {
      sqlite.run(widenedSql)
      sqlite.run("INSERT INTO external_identity_providers_widened SELECT * FROM external_identity_providers")
      sqlite.run("DROP TABLE external_identity_providers")
      sqlite.run("ALTER TABLE external_identity_providers_widened RENAME TO external_identity_providers")
      const violations = sqlite.query("PRAGMA foreign_key_check").all()
      if (violations.length > 0) throw new Error("foreign key violations after provider table rebuild")
    })()
    return resultCreate(undefined)
  } catch (_error) {
    return resultErrorCreate(op, "The external provider table could not be migrated.")
  } finally {
    sqlite.run("PRAGMA foreign_keys = ON")
  }
}
