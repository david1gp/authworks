import { describe, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { platformTestkitCreate } from "../../../platform/testkit/platformTestkitCreate.js"
import { realmCreate } from "../../realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../realms/domain/realmSystemContextCreate.js"
import { userCreate } from "../../users/actions/userCreate.js"
import { userLifecycleSet } from "../../users/actions/userLifecycleSet.js"
import { passkeyRepositoryCreate } from "../persistence/passkeyRepositoryCreate.js"
import { passkeyCredentialRename } from "./passkeyCredentialRename.js"

async function withDatabase<T>(operation: (database: StorageDatabase) => Promise<T>) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-passkey-rename-"))
  const opened = storageDatabaseOpen(join(directory, "authworks.sqlite"), platformTestkitCreate().runtime)
  expect(opened.success).toBe(true)
  if (!opened.success) throw new Error(opened.errorMessage)
  try {
    return await operation(opened.data)
  } finally {
    opened.data.close()
    await rm(directory, { force: true, recursive: true })
  }
}

async function seedRealmUsers(database: StorageDatabase, domain: string) {
  const system = realmSystemContextCreate()
  const realm = realmCreate({ context: system, database, input: { domain, name: domain } })
  expect(realm.success).toBe(true)
  if (!realm.success) throw new Error(realm.errorMessage)
  const realmId = realm.data.realm.id
  const create = (userName: string) => {
    const created = userCreate({
      context: system,
      database,
      input: { email: `${userName}@${domain}`, profile: { displayName: userName }, userName },
      realmId,
    })
    expect(created.success).toBe(true)
    if (!created.success) throw new Error(created.errorMessage)
    const activated = userLifecycleSet({
      context: system,
      database,
      input: { state: "active" },
      realmId,
      userId: created.data.user.id,
    })
    expect(activated.success).toBe(true)
    return created.data.user.id
  }
  const owner = create("passkey-rename-owner")
  const other = create("passkey-rename-other")
  const seeded = storageTransactionRun(database, (transaction) =>
    passkeyRepositoryCreate(transaction).passkeyCredentialCreate({
      aaguid: "00000000-0000-0000-0000-000000000000",
      backedUp: 0,
      counter: 0,
      createdAt: database.runtime.now(),
      credentialId: "rename-credential",
      deviceType: "singleDevice",
      id: "rename-credential-row",
      lastUsedAt: null,
      nickname: null,
      publicKey: Buffer.from([1, 2, 3]),
      realmId,
      revokedAt: null,
      rpId: domain,
      transports: "[]",
      userId: owner,
      version: 1,
    }),
  )
  expect(seeded.success).toBe(true)
  if (!seeded.success) throw new Error(seeded.errorMessage)
  return { other, owner, realmId }
}

describe("passkeyCredentialRename", () => {
  test("renames a credential owned by the caller", async () => {
    await withDatabase(async (database) => {
      const { owner, realmId } = await seedRealmUsers(database, "passkey-rename-owner.example.com")
      const renamed = passkeyCredentialRename({
        credentialId: "rename-credential-row",
        database,
        input: { nickname: "Work key" },
        realmId,
        userId: owner,
      })
      expect(renamed.success).toBe(true)
      if (!renamed.success) return
      expect(renamed.data.credential.nickname).toBe("Work key")
    })
  })

  test("denies renaming a credential owned by someone else", async () => {
    await withDatabase(async (database) => {
      const { other, realmId } = await seedRealmUsers(database, "passkey-rename-other.example.com")
      const renamed = passkeyCredentialRename({
        credentialId: "rename-credential-row",
        database,
        input: { nickname: "Work key" },
        realmId,
        userId: other,
      })
      expect(renamed.success).toBe(false)
      if (renamed.success) return
      expect(renamed.code).toBe("passkeys.not-found")
    })
  })

  test("rejects an invalid nickname", async () => {
    await withDatabase(async (database) => {
      const { owner, realmId } = await seedRealmUsers(database, "passkey-rename-invalid.example.com")
      const renamed = passkeyCredentialRename({
        credentialId: "rename-credential-row",
        database,
        input: { nickname: "   " },
        realmId,
        userId: owner,
      })
      expect(renamed.success).toBe(false)
    })
  })
})
