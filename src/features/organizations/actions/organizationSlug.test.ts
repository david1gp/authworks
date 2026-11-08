import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageSchemaCreate } from "../../../platform/storage/storageSchemaCreate.js"
import { platformTestkitCreate } from "../../../platform/testkit/platformTestkitCreate.js"
import { realmCreate } from "../../realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../realms/domain/realmTenantContextCreate.js"
import { userCreate } from "../../users/actions/userCreate.js"
import { organizationRepositoryCreate } from "../persistence/organizationRepositoryCreate.js"
import { organizationCreate } from "./organizationCreate.js"
import { organizationUpdate } from "./organizationUpdate.js"

async function withDatabase<T>(operation: (database: StorageDatabase) => Promise<T>) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-organization-slug-"))
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

function realmSeed(database: StorageDatabase, domain: string, name: string): string {
  const realm = realmCreate({ context: realmSystemContextCreate("system"), database, input: { domain, name } })
  expect(realm.success).toBe(true)
  if (!realm.success) throw new Error(realm.errorMessage)
  return realm.data.realm.id
}

function userSeed(database: StorageDatabase, realmId: string, userName: string): string {
  const created = userCreate({
    context: realmSystemContextCreate("system"),
    database,
    input: { email: `${userName}@example.com`, profile: { displayName: userName }, userName },
    realmId,
  })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  return created.data.user.id
}

function organizationSeed(database: StorageDatabase, realmId: string, name: string, ownerUserId?: string) {
  const created = organizationCreate({
    context: realmSystemContextCreate("system"),
    database,
    input: ownerUserId === undefined ? { name } : { name, ownerUserId },
    realmId,
  })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  return created.data.organization
}

test("organization create derives the slug from the name", async () => {
  await withDatabase(async (database) => {
    const realmId = realmSeed(database, "slug.example.com", "slug")
    const organization = organizationSeed(database, realmId, "Acme Corporation")
    expect(organization.slug).toBe("acme-corporation")
  })
})

test("organization create dedupes slugs per realm with a numeric suffix", async () => {
  await withDatabase(async (database) => {
    const realmId = realmSeed(database, "slug-dedupe.example.com", "slug-dedupe")
    const first = organizationSeed(database, realmId, "Acme Corp")
    const second = organizationSeed(database, realmId, "Acme-Corp")
    const third = organizationSeed(database, realmId, "Acme Corp!")
    expect(first.slug).toBe("acme-corp")
    expect(second.slug).toBe("acme-corp-2")
    expect(third.slug).toBe("acme-corp-3")
    const otherRealmId = realmSeed(database, "slug-other.example.com", "slug-other")
    const other = organizationSeed(database, otherRealmId, "Acme Corp")
    expect(other.slug).toBe("acme-corp")
  })
})

test("organization rename never changes the slug but an explicit slug update does", async () => {
  await withDatabase(async (database) => {
    const realmId = realmSeed(database, "slug-rename.example.com", "slug-rename")
    const owner = userSeed(database, realmId, "rename-owner")
    const organization = organizationSeed(database, realmId, "Acme Corporation", owner)
    const context = realmTenantContextCreate(realmId, owner)
    const renamed = organizationUpdate({
      context,
      database,
      input: { name: "Acme Renamed" },
      organizationId: organization.id,
      realmId,
    })
    expect(renamed.success).toBe(true)
    if (!renamed.success) throw new Error(renamed.errorMessage)
    expect(renamed.data.organization.name).toBe("Acme Renamed")
    expect(renamed.data.organization.slug).toBe("acme-corporation")
    const slugUpdated = organizationUpdate({
      context,
      database,
      input: { slug: "acme-hq" },
      organizationId: organization.id,
      realmId,
    })
    expect(slugUpdated.success).toBe(true)
    if (!slugUpdated.success) throw new Error(slugUpdated.errorMessage)
    expect(slugUpdated.data.organization.slug).toBe("acme-hq")
    expect(slugUpdated.data.organization.name).toBe("Acme Renamed")
    const renamedAgain = organizationUpdate({
      context,
      database,
      input: { name: "Acme Again" },
      organizationId: organization.id,
      realmId,
    })
    expect(renamedAgain.success).toBe(true)
    if (!renamedAgain.success) throw new Error(renamedAgain.errorMessage)
    expect(renamedAgain.data.organization.slug).toBe("acme-hq")
  })
})

test("organization explicit slug update rejects conflicts and invalid slugs", async () => {
  await withDatabase(async (database) => {
    const realmId = realmSeed(database, "slug-conflict.example.com", "slug-conflict")
    const owner = userSeed(database, realmId, "conflict-owner")
    const first = organizationSeed(database, realmId, "Acme Corporation", owner)
    const second = organizationSeed(database, realmId, "Globex Corporation", owner)
    const context = realmTenantContextCreate(realmId, owner)
    const conflict = organizationUpdate({
      context,
      database,
      input: { slug: first.slug },
      organizationId: second.id,
      realmId,
    })
    expect(conflict.success).toBe(false)
    if (conflict.success) throw new Error("expected slug conflict")
    expect(conflict.code).toBe("organizations.already-exists")
    const unchanged = organizationUpdate({
      context,
      database,
      input: { slug: second.slug },
      organizationId: second.id,
      realmId,
    })
    expect(unchanged.success).toBe(true)
    for (const slug of ["Bad Slug", "new", "unassigned", "-acme", ""]) {
      const rejected = organizationUpdate({
        context,
        database,
        input: { slug },
        organizationId: second.id,
        realmId,
      })
      expect(rejected.success).toBe(false)
      if (rejected.success) throw new Error(`expected rejection for ${slug}`)
      expect(rejected.code).toBe("organizations.invalid")
    }
  })
})

test("organization slug backfill fills legacy rows and is idempotent", async () => {
  const directory = await mkdtemp(join(tmpdir(), "authworks-organization-slug-backfill-"))
  try {
    const path = join(directory, "authworks.sqlite")
    const legacy = new Database(path)
    try {
      legacy.exec(
        "CREATE TABLE realms (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, primary_domain TEXT NOT NULL UNIQUE, status TEXT NOT NULL, created_at INTEGER NOT NULL CHECK (created_at >= 0), updated_at INTEGER NOT NULL CHECK (updated_at >= 0), version INTEGER NOT NULL CHECK (version > 0), bootstrap_admin_id TEXT UNIQUE, bootstrap_completed_at INTEGER CHECK (bootstrap_completed_at IS NULL OR bootstrap_completed_at >= 0))",
      )
      legacy.exec(
        "CREATE TABLE organizations (id TEXT PRIMARY KEY NOT NULL, realm_id TEXT NOT NULL, name TEXT NOT NULL, status TEXT NOT NULL CHECK (status IN ('active', 'inactive', 'removed')), created_at INTEGER NOT NULL CHECK (created_at >= 0), updated_at INTEGER NOT NULL CHECK (updated_at >= 0), version INTEGER NOT NULL CHECK (version > 0), UNIQUE (realm_id, name), FOREIGN KEY (realm_id) REFERENCES realms(id) ON DELETE CASCADE)",
      )
      legacy.exec(
        "INSERT INTO realms (id, name, primary_domain, status, created_at, updated_at, version) VALUES ('realm-backfill', 'Backfill', 'backfill.example.com', 'active', 1000, 1000, 1)",
      )
      legacy.exec(
        "INSERT INTO organizations (id, realm_id, name, status, created_at, updated_at, version) VALUES ('00000000-0000-4000-8000-000000000098', 'realm-backfill', 'Acme Corporation!', 'active', 1000, 1000, 1)",
      )
      legacy.exec(
        "INSERT INTO organizations (id, realm_id, name, status, created_at, updated_at, version) VALUES ('00000000-0000-4000-8000-000000000099', 'realm-backfill', 'Acme Corporation!!', 'active', 2000, 2000, 1)",
      )
    } finally {
      legacy.close()
    }
    const opened = storageDatabaseOpen(path, platformTestkitCreate().runtime)
    expect(opened.success).toBe(true)
    if (!opened.success) throw new Error(opened.errorMessage)
    try {
      const repository = organizationRepositoryCreate(opened.data.db)
      const first = repository.organizationGet("00000000-0000-4000-8000-000000000098")
      expect(first.success).toBe(true)
      if (!first.success || first.data === null) throw new Error("expected legacy organization")
      expect(first.data.slug).toBe("acme-corporation")
      const second = repository.organizationGet("00000000-0000-4000-8000-000000000099")
      expect(second.success).toBe(true)
      if (!second.success || second.data === null) throw new Error("expected legacy organization")
      expect(second.data.slug).toBe("acme-corporation-2")
      const before = { ...second.data }
      const rerun = storageSchemaCreate(opened.data.db)
      expect(rerun.success).toBe(true)
      const again = repository.organizationGet("00000000-0000-4000-8000-000000000099")
      expect(again.success).toBe(true)
      if (!again.success || again.data === null) throw new Error("expected legacy organization")
      expect(again.data).toEqual(before)
    } finally {
      opened.data.close()
    }
  } finally {
    await rm(directory, { force: true, recursive: true })
  }
})
