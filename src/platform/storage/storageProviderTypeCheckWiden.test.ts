import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { storageProviderTypeCheckWiden } from "./storageProviderTypeCheckWiden.js"

function legacyDatabaseCreate(): Database {
  const sqlite = new Database(":memory:")
  sqlite.run("PRAGMA foreign_keys = ON")
  sqlite.run("CREATE TABLE realms (id TEXT PRIMARY KEY NOT NULL)")
  sqlite.run(
    "CREATE TABLE external_identity_providers (id TEXT PRIMARY KEY NOT NULL, realm_id TEXT NOT NULL, type TEXT NOT NULL CHECK (type IN ('google', 'github', 'microsoft')), FOREIGN KEY (realm_id) REFERENCES realms(id) ON DELETE CASCADE)",
  )
  sqlite.run("ALTER TABLE external_identity_providers ADD COLUMN issuer TEXT")
  sqlite.run(
    "CREATE TABLE external_identities (id TEXT PRIMARY KEY NOT NULL, provider_id TEXT NOT NULL, FOREIGN KEY (provider_id) REFERENCES external_identity_providers(id) ON DELETE CASCADE)",
  )
  sqlite.run("INSERT INTO realms (id) VALUES ('realm')")
  sqlite.run(
    "INSERT INTO external_identity_providers (id, realm_id, type, issuer) VALUES ('google', 'realm', 'google', 'x')",
  )
  sqlite.run("INSERT INTO external_identities (id, provider_id) VALUES ('identity', 'google')")
  return sqlite
}

test("storageProviderTypeCheckWiden allows apple and keeps providers and linked identities", () => {
  const sqlite = legacyDatabaseCreate()
  expect(() =>
    sqlite.run("INSERT INTO external_identity_providers (id, realm_id, type) VALUES ('a', 'realm', 'apple')"),
  ).toThrow()

  expect(storageProviderTypeCheckWiden(sqlite).success).toBe(true)

  sqlite.run("INSERT INTO external_identity_providers (id, realm_id, type) VALUES ('apple', 'realm', 'apple')")
  expect(sqlite.query("SELECT id, issuer FROM external_identity_providers ORDER BY id").all()).toEqual([
    { id: "apple", issuer: null },
    { id: "google", issuer: "x" },
  ])
  expect(sqlite.query("SELECT id FROM external_identities").all()).toEqual([{ id: "identity" }])
  expect(sqlite.query("PRAGMA foreign_keys").get()).toEqual({ foreign_keys: 1 })
  sqlite.run("DELETE FROM external_identity_providers WHERE id = 'google'")
  expect(sqlite.query("SELECT id FROM external_identities").all()).toEqual([])
  sqlite.close()
})

test("storageProviderTypeCheckWiden is a no-op for current schemas", () => {
  const sqlite = legacyDatabaseCreate()
  expect(storageProviderTypeCheckWiden(sqlite).success).toBe(true)
  const before = sqlite.query("SELECT sql FROM sqlite_master WHERE name = 'external_identity_providers'").get()
  expect(storageProviderTypeCheckWiden(sqlite).success).toBe(true)
  expect(sqlite.query("SELECT sql FROM sqlite_master WHERE name = 'external_identity_providers'").get()).toEqual(before)
  sqlite.close()
})
