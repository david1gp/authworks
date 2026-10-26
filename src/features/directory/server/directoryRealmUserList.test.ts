import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../../platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../../platform/testkit/platformTestkitCreate.js"
import { organizationCreate } from "../../organizations/actions/organizationCreate.js"
import { realmCreate } from "../../realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../realms/domain/realmTenantContextCreate.js"
import { userCreate } from "../../users/actions/userCreate.js"
import { userEmailVerificationSet } from "../../users/actions/userEmailVerificationSet.js"
import { userLifecycleSet } from "../../users/actions/userLifecycleSet.js"
import { directoryRealmUserList } from "./directoryRealmUserList.js"
import { directoryUserAccess } from "./directoryUserAccess.js"

async function withDatabase<T>(operation: (database: StorageDatabase) => Promise<T>) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-directory-realm-list-"))
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

async function seedRealmWithLoner(database: StorageDatabase, domain: string) {
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
  const member = create("realm-member", "+14155552671")
  const loner = create("realm-loner")
  const activated = userLifecycleSet({ context: system, database, input: { state: "active" }, realmId, userId: member })
  expect(activated.success).toBe(true)
  const verified = userEmailVerificationSet({
    context: system,
    database,
    input: { state: "verified" },
    realmId,
    userId: member,
  })
  expect(verified.success).toBe(true)
  const organization = organizationCreate({
    context: system,
    database,
    input: { name: "Realm List Org", ownerUserId: member },
    realmId,
  })
  expect(organization.success).toBe(true)
  if (!organization.success) throw new Error(organization.errorMessage)
  return { loner, member, organization: organization.data.organization, realmId }
}

test("realm directory lists organization-less users with empty memberships", async () => {
  await withDatabase(async (database) => {
    const { loner, member, organization, realmId } = await seedRealmWithLoner(
      database,
      "directory-realm-loner.example.com",
    )
    const listed = directoryRealmUserList({ context: realmTenantContextCreate(realmId, member), database, realmId })
    expect(listed.success).toBe(true)
    if (!listed.success) return
    expect(new Set(listed.data.items.map((item) => item.user.id))).toEqual(new Set([member, loner]))
    const lonerEntry = listed.data.items.find((item) => item.user.id === loner)
    expect(lonerEntry?.memberships).toEqual([])
    const memberEntry = listed.data.items.find((item) => item.user.id === member)
    expect(memberEntry?.memberships.map((membership) => membership.organizationId)).toEqual([organization.id])
  })
})

test("realm directory keeps pagination across members and organization-less users", async () => {
  await withDatabase(async (database) => {
    const { loner, member, realmId } = await seedRealmWithLoner(database, "directory-realm-pages.example.com")
    const firstPage = directoryRealmUserList({
      context: realmTenantContextCreate(realmId, member),
      database,
      query: { pageSize: 1 },
      realmId,
    })
    expect(firstPage.success).toBe(true)
    if (!firstPage.success || firstPage.data.nextPageToken === undefined) return
    expect(firstPage.data.items).toHaveLength(1)
    const secondPage = directoryRealmUserList({
      context: realmTenantContextCreate(realmId, member),
      database,
      query: { pageSize: 1, pageToken: firstPage.data.nextPageToken },
      realmId,
    })
    expect(secondPage.success).toBe(true)
    if (!secondPage.success) return
    expect(secondPage.data.items).toHaveLength(1)
    expect(new Set([...firstPage.data.items, ...secondPage.data.items].map((item) => item.user.id))).toEqual(
      new Set([member, loner]),
    )
  })
})

test("realm directory filters organization-less users by verification and phone search", async () => {
  await withDatabase(async (database) => {
    const { loner, member, realmId } = await seedRealmWithLoner(database, "directory-realm-filters.example.com")
    const context = realmTenantContextCreate(realmId, member)
    const active = directoryRealmUserList({ context, database, query: { state: "active" }, realmId })
    expect(active.success).toBe(true)
    if (!active.success) return
    expect(active.data.items.map((item) => item.user.id)).toEqual([member])
    const verified = directoryRealmUserList({ context, database, query: { emailVerified: true }, realmId })
    expect(verified.success).toBe(true)
    if (!verified.success) return
    expect(verified.data.items.map((item) => item.user.id)).toEqual([member])
    const unverified = directoryRealmUserList({ context, database, query: { emailVerified: false }, realmId })
    expect(unverified.success).toBe(true)
    if (!unverified.success) return
    expect(unverified.data.items.map((item) => item.user.id)).toEqual([loner])
    const phoneHit = directoryRealmUserList({ context, database, query: { search: "4155552671" }, realmId })
    expect(phoneHit.success).toBe(true)
    if (!phoneHit.success) return
    expect(phoneHit.data.items.map((item) => item.user.id)).toEqual([member])
    const roleFiltered = directoryRealmUserList({ context, database, query: { role: "owner" }, realmId })
    expect(roleFiltered.success).toBe(true)
    if (!roleFiltered.success) return
    expect(roleFiltered.data.items.map((item) => item.user.id)).toEqual([member])
  })
})

test("realm directory access keeps organization-less users with empty memberships", async () => {
  await withDatabase(async (database) => {
    const { loner, member, realmId } = await seedRealmWithLoner(database, "directory-realm-access.example.com")
    const access = directoryUserAccess({
      context: realmTenantContextCreate(realmId, member),
      database,
      realmId,
      targetUserId: loner,
    })
    expect(access.success).toBe(true)
    if (!access.success) return
    expect(access.data.memberships).toEqual([])
  })
})
