import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import * as v from "valibot"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../../platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../../platform/testkit/platformTestkitCreate.js"
import { realmCreate, realmSystemContextCreate, realmTenantContextCreate } from "../../realms/server/index.js"
import { userListQuerySchema } from "../public/userListQuerySchema.js"
import { userCreate } from "./userCreate.js"
import { userEmailVerificationSet } from "./userEmailVerificationSet.js"
import { userLifecycleSet } from "./userLifecycleSet.js"
import { userList } from "./userList.js"

async function withDatabase<T>(operation: (database: StorageDatabase) => Promise<T>) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-user-list-"))
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

async function seedFilteredRealm(database: StorageDatabase, domain: string) {
  const system = realmSystemContextCreate()
  const realm = realmCreate({ context: system, database, input: { domain, name: domain } })
  expect(realm.success).toBe(true)
  if (!realm.success) throw new Error(realm.errorMessage)
  const realmId = realm.data.realm.id
  const create = (userName: string, phoneNumber?: string) => {
    const created = userCreate({
      context: system,
      database,
      input: {
        email: `${userName}@${domain}`,
        ...(phoneNumber === undefined ? {} : { phoneNumber }),
        profile: { displayName: userName },
        userName,
      },
      realmId,
    })
    expect(created.success).toBe(true)
    if (!created.success) throw new Error(created.errorMessage)
    return created.data.user.id
  }
  const alice = create("filter-alice", "+14155552671")
  const bob = create("filter-bob")
  const carol = create("filter-carol")
  const activated = userLifecycleSet({ context: system, database, input: { state: "active" }, realmId, userId: alice })
  expect(activated.success).toBe(true)
  const verified = userEmailVerificationSet({
    context: system,
    database,
    input: { state: "verified" },
    realmId,
    userId: alice,
  })
  expect(verified.success).toBe(true)
  return { alice, bob, carol, realmId }
}

test("user list filters by every lifecycle state", async () => {
  await withDatabase(async (database) => {
    const { alice, bob, carol, realmId } = await seedFilteredRealm(database, "user-list-state.example.com")
    const system = realmSystemContextCreate()
    const active = userList({ context: system, database, query: { state: "active" }, realmId })
    expect(active.success).toBe(true)
    if (!active.success) return
    expect(active.data.items.map((user) => user.id)).toEqual([alice])
    const initial = userList({ context: system, database, query: { state: "initial" }, realmId })
    expect(initial.success).toBe(true)
    if (!initial.success) return
    expect(initial.data.items.map((user) => user.id)).toEqual([bob, carol])
    const unfiltered = userList({ context: system, database, realmId })
    expect(unfiltered.success).toBe(true)
    if (!unfiltered.success) return
    expect(unfiltered.data.items.map((user) => user.id)).toEqual([alice, bob, carol])
  })
})

test("user list query accepts every lifecycle state", () => {
  for (const state of ["initial", "active", "inactive", "locked", "suspended", "deleted"]) {
    expect(v.safeParse(userListQuerySchema, { state }).success).toBe(true)
  }
})

test("user list filters by email verification", async () => {
  await withDatabase(async (database) => {
    const { alice, bob, carol, realmId } = await seedFilteredRealm(database, "user-list-verified.example.com")
    const system = realmSystemContextCreate()
    const verified = userList({ context: system, database, query: { emailVerified: true }, realmId })
    expect(verified.success).toBe(true)
    if (!verified.success) return
    expect(verified.data.items.map((user) => user.id)).toEqual([alice])
    const unverified = userList({ context: system, database, query: { emailVerified: false }, realmId })
    expect(unverified.success).toBe(true)
    if (!unverified.success) return
    expect(unverified.data.items.map((user) => user.id)).toEqual([bob, carol])
  })
})

test("user list search matches phone numbers", async () => {
  await withDatabase(async (database) => {
    const { alice, bob, realmId } = await seedFilteredRealm(database, "user-list-phone.example.com")
    const system = realmSystemContextCreate()
    const phoneHit = userList({ context: system, database, query: { search: "4155552671" }, realmId })
    expect(phoneHit.success).toBe(true)
    if (!phoneHit.success) return
    expect(phoneHit.data.items.map((user) => user.id)).toEqual([alice])
    const nameHit = userList({ context: system, database, query: { search: "filter-bob" }, realmId })
    expect(nameHit.success).toBe(true)
    if (!nameHit.success) return
    expect(nameHit.data.items.map((user) => user.id)).toEqual([bob])
  })
})

test("user list keeps deleted-state listing behind realm administrator access", async () => {
  await withDatabase(async (database) => {
    const { bob, realmId } = await seedFilteredRealm(database, "user-list-deleted-gate.example.com")
    const denied = userList({
      context: realmTenantContextCreate(realmId, bob),
      database,
      query: { state: "deleted" },
      realmId,
    })
    expect(denied.success).toBe(false)
    const allowed = userList({ context: realmSystemContextCreate(), database, query: { state: "deleted" }, realmId })
    expect(allowed.success).toBe(true)
    if (!allowed.success) return
    expect(allowed.data.items).toEqual([])
  })
})
