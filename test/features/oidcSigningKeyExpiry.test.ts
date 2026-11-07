import { describe, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { oidcSigningKeyCreate } from "../../src/features/oidc/actions/oidcSigningKeyCreate.js"
import { oidcSigningKeyEnsureActive } from "../../src/features/oidc/actions/oidcSigningKeyEnsureActive.js"
import { oidcSigningKeyList } from "../../src/features/oidc/actions/oidcSigningKeyList.js"
import { oidcSigningKeyValidityMs } from "../../src/features/oidc/public/oidcSigningKeyValidityMs.js"
import { oidcSigningKeyPublicViewCreate } from "../../src/features/oidc/domain/oidcSigningKeyPublicViewCreate.js"
import { oidcRepositoryCreate } from "../../src/features/oidc/persistence/oidcRepositoryCreate.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

const encryptionSecret = "signing-key-expiry-fixture-secret"

async function withDatabase<T>(
  operation: (database: StorageDatabase, directory: string) => Promise<T> | T,
): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), "authworks-signing-key-expiry-"))
  const opened = storageDatabaseOpen(join(directory, "authworks.sqlite"), platformTestkitCreate().runtime)
  expect(opened.success).toBe(true)
  if (!opened.success) throw new Error(opened.errorMessage)
  try {
    return await operation(opened.data, directory)
  } finally {
    opened.data.close()
    await rm(directory, { force: true, recursive: true })
  }
}

function realmCreateForTest(database: StorageDatabase, domain: string): string {
  const realm = realmCreate({ context: realmSystemContextCreate(), database, input: { domain, name: domain } })
  expect(realm.success).toBe(true)
  if (!realm.success) throw new Error(realm.errorMessage)
  return realm.data.realm.id
}

describe("signing-key expiry scheduling", () => {
  test("create stamps expiresAt at createdAt plus 365 days", async () => {
    await withDatabase((database) => {
      const realmId = realmCreateForTest(database, "expiry-create.example.com")
      const created = oidcSigningKeyCreate({
        context: realmSystemContextCreate(),
        database,
        encryptionSecret,
        realmId,
      })
      expect(created.success).toBe(true)
      if (!created.success) return
      expect(created.data.signingKey.expiresAt).toBe(created.data.signingKey.createdAt + oidcSigningKeyValidityMs)
      expect(oidcSigningKeyValidityMs).toBe(365 * 24 * 60 * 60 * 1_000)
    })
  })

  test("rotation retires the active key and the replacement carries its own expiresAt", async () => {
    await withDatabase((database) => {
      const realmId = realmCreateForTest(database, "expiry-rotate.example.com")
      const first = oidcSigningKeyCreate({
        context: realmSystemContextCreate(),
        database,
        encryptionSecret,
        realmId,
      })
      expect(first.success).toBe(true)
      if (!first.success) return
      const second = oidcSigningKeyCreate({
        context: realmSystemContextCreate(),
        database,
        encryptionSecret,
        realmId,
      })
      expect(second.success).toBe(true)
      if (!second.success) return
      expect(second.data.signingKey.status).toBe("active")
      expect(second.data.signingKey.expiresAt).toBe(second.data.signingKey.createdAt + oidcSigningKeyValidityMs)
      const keys = oidcSigningKeyList({ context: realmSystemContextCreate(), database, realmId })
      expect(keys.success).toBe(true)
      if (!keys.success) return
      const retired = keys.data.items.find((key) => key.id === first.data.signingKey.id)
      expect(retired?.status).toBe("retired")
      expect(retired?.expiresAt).toBe(first.data.signingKey.expiresAt)
    })
  })

  test("ensure creates with expiresAt once, then reuses the same scheduled expiry", async () => {
    await withDatabase((database) => {
      const realmId = realmCreateForTest(database, "expiry-ensure.example.com")
      const created = oidcSigningKeyEnsureActive({
        context: realmSystemContextCreate(),
        database,
        encryptionSecret,
        realmId,
      })
      expect(created.success).toBe(true)
      if (!created.success) return
      expect(created.data.action).toBe("created")
      expect(created.data.signingKey.expiresAt).toBe(created.data.signingKey.createdAt + oidcSigningKeyValidityMs)
      const reused = oidcSigningKeyEnsureActive({
        context: realmSystemContextCreate(),
        database,
        encryptionSecret,
        realmId,
      })
      expect(reused.success).toBe(true)
      if (!reused.success) return
      expect(reused.data.action).toBe("reused")
      expect(reused.data.signingKey.expiresAt).toBe(created.data.signingKey.expiresAt)
    })
  })

  test("a legacy null expiresAt falls back to createdAt plus 365 days in the public view", async () => {
    await withDatabase((database) => {
      const realmId = realmCreateForTest(database, "expiry-fallback.example.com")
      const created = oidcSigningKeyCreate({
        context: realmSystemContextCreate(),
        database,
        encryptionSecret,
        realmId,
      })
      expect(created.success).toBe(true)
      if (!created.success) return
      const stored = oidcRepositoryCreate(database.db).signingKeyGet(realmId, created.data.signingKey.id)
      expect(stored.success).toBe(true)
      if (!stored.success || stored.data === null) throw new Error("The signing-key fixture row is missing.")
      const viewed = oidcSigningKeyPublicViewCreate({ ...stored.data, expiresAt: null })
      expect(viewed.success).toBe(true)
      if (!viewed.success) return
      expect(viewed.data.expiresAt).toBe(viewed.data.createdAt + oidcSigningKeyValidityMs)
    })
  })

  test("reopening a database without the column adds it and backfills createdAt plus 365 days", async () => {
    const directory = await mkdtemp(join(tmpdir(), "authworks-signing-key-migration-"))
    const opened = storageDatabaseOpen(join(directory, "authworks.sqlite"), platformTestkitCreate().runtime)
    expect(opened.success).toBe(true)
    if (!opened.success) {
      await rm(directory, { force: true, recursive: true })
      throw new Error(opened.errorMessage)
    }
    try {
      const realmId = realmCreateForTest(opened.data, "expiry-migration.example.com")
      const created = oidcSigningKeyCreate({
        context: realmSystemContextCreate(),
        database: opened.data,
        encryptionSecret,
        realmId,
      })
      expect(created.success).toBe(true)
      if (!created.success) return
      const createdAt = created.data.signingKey.createdAt
      // Simulate a database written before expiry scheduling existed.
      opened.data.sqlite.exec("ALTER TABLE oidc_signing_keys DROP COLUMN expires_at")
      opened.data.close()
      const reopened = storageDatabaseOpen(join(directory, "authworks.sqlite"), platformTestkitCreate().runtime)
      expect(reopened.success).toBe(true)
      if (!reopened.success) return
      try {
        const columns = reopened.data.sqlite
          .query("SELECT name FROM pragma_table_info('oidc_signing_keys') WHERE name = 'expires_at'")
          .all()
        expect(columns).toHaveLength(1)
        const keys = oidcSigningKeyList({ context: realmSystemContextCreate(), database: reopened.data, realmId })
        expect(keys.success).toBe(true)
        if (!keys.success) return
        expect(keys.data.items).toHaveLength(1)
        expect(keys.data.items[0]?.createdAt).toBe(createdAt)
        expect(keys.data.items[0]?.expiresAt).toBe(createdAt + oidcSigningKeyValidityMs)
      } finally {
        reopened.data.close()
      }
    } finally {
      await rm(directory, { force: true, recursive: true })
    }
  })
})
