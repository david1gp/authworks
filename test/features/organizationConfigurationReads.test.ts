import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { externalIdentityProviderCreate } from "../../src/features/externalIdentities/actions/externalIdentityProviderCreate.js"
import { externalIdentityApiClientCreate } from "../../src/features/externalIdentities/client/externalIdentityApiClientCreate.js"
import { externalIdentityServerAppCreate } from "../../src/features/externalIdentities/server/externalIdentityServerAppCreate.js"
import { organizationCreate } from "../../src/features/organizations/actions/organizationCreate.js"
import { organizationApiClientCreate } from "../../src/features/organizations/client/organizationApiClientCreate.js"
import { organizationServerAppCreate } from "../../src/features/organizations/server/organizationServerAppCreate.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { sessionIssue } from "../../src/features/sessions/actions/sessionIssue.js"
import { userCreate } from "../../src/features/users/actions/userCreate.js"
import { userLifecycleSet } from "../../src/features/users/actions/userLifecycleSet.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"

async function withDatabase<T>(operation: (database: StorageDatabase) => Promise<T>) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-org-provider-reads-"))
  const opened = storageDatabaseOpen(join(directory, "authworks.sqlite"))
  expect(opened.success).toBe(true)
  if (!opened.success) {
    await rm(directory, { force: true, recursive: true })
    throw new Error(opened.errorMessage)
  }
  const database = opened.data
  try {
    return await operation(database)
  } finally {
    opened.data.close()
    await rm(directory, { force: true, recursive: true })
  }
}

async function createActiveUser(database: StorageDatabase, realmId: string, email: string) {
  const system = realmSystemContextCreate("system")
  const created = userCreate({
    context: system,
    database,
    input: { email, profile: { displayName: email }, userName: email.split("@")[0] ?? email },
    realmId,
  })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  const active = userLifecycleSet({
    context: system,
    database,
    input: { state: "active" },
    realmId,
    userId: created.data.user.id,
  })
  expect(active.success).toBe(true)
  if (!active.success) throw new Error(active.errorMessage)
  return created.data.user
}

test("an org owner can list providers for their org but not for another org or realm-wide", async () => {
  await withDatabase(async (database) => {
    const system = realmSystemContextCreate("system")
    const realm = realmCreate({
      context: system,
      database,
      input: { domain: "provider-read.example.com", name: "provider-read.example.com" },
    })
    expect(realm.success).toBe(true)
    if (!realm.success) return
    const realmId = realm.data.realm.id

    const owner = await createActiveUser(database, realmId, "owner@example.com")
    const otherOwner = await createActiveUser(database, realmId, "other-owner@example.com")
    const owned = organizationCreate({
      context: system,
      database,
      input: { name: "Owned", ownerUserId: owner.id },
      realmId,
    })
    const other = organizationCreate({
      context: system,
      database,
      input: { name: "Other", ownerUserId: otherOwner.id },
      realmId,
    })
    expect(owned.success).toBe(true)
    expect(other.success).toBe(true)
    if (!owned.success || !other.success) return
    const organizationId = owned.data.organization.id
    const otherOrganizationId = other.data.organization.id

    const provider = externalIdentityProviderCreate({
      context: system,
      database,
      input: {
        allowAccountCreation: true,
        clientId: "client-id",
        clientSecret: "client-secret",
        displayName: "Google",
        organizationId,
        redirectUri: "https://app.test/callback",
        type: "google",
      },
      realmId,
    })
    expect(provider.success).toBe(true)
    if (!provider.success) return

    const app = externalIdentityServerAppCreate({ database, publicOrigin: "https://provider-read.example.com" })
    const session = sessionIssue({
      assurance: "authenticated",
      authenticationMethod: "password",
      database,
      realmId,
      userId: owner.id,
    })
    expect(session.success).toBe(true)
    if (!session.success) return
    const client = externalIdentityApiClientCreate({
      baseUrl: "https://provider-read.example.com",
      fetch: async (input, init) => app.request(input.toString(), init),
      token: session.data.token,
    })

    const ownProviders = await client.externalIdentityProviderTenantList(realmId, organizationId)
    expect(ownProviders.success).toBe(true)
    if (!ownProviders.success) return
    expect(ownProviders.data.items.map((item) => item.id)).toEqual([provider.data.provider.id])

    const otherProviders = await client.externalIdentityProviderTenantList(realmId, otherOrganizationId)
    expect(otherProviders).toMatchObject({ success: false })

    const realmWide = await client.externalIdentityProviderTenantList(realmId)
    expect(realmWide).toMatchObject({ success: false })
  })
})

test("an org owner can read the realm default login policy for configuration", async () => {
  await withDatabase(async (database) => {
    const system = realmSystemContextCreate("system")
    const realm = realmCreate({
      context: system,
      database,
      input: { domain: "realm-policy-read.example.com", name: "realm-policy-read.example.com" },
    })
    expect(realm.success).toBe(true)
    if (!realm.success) return
    const realmId = realm.data.realm.id

    const owner = await createActiveUser(database, realmId, "owner@example.com")
    const outsider = await createActiveUser(database, realmId, "outsider@example.com")
    const owned = organizationCreate({
      context: system,
      database,
      input: { name: "Owned", ownerUserId: owner.id },
      realmId,
    })
    expect(owned.success).toBe(true)
    if (!owned.success) return

    const app = organizationServerAppCreate({ database, publicOrigin: "https://realm-policy-read.example.com" })
    const tenantClientFor = async (userId: string) => {
      const session = sessionIssue({
        assurance: "authenticated",
        authenticationMethod: "password",
        database,
        realmId,
        userId,
      })
      expect(session.success).toBe(true)
      if (!session.success) throw new Error("The tenant session was not issued.")
      return organizationApiClientCreate({
        baseUrl: "https://realm-policy-read.example.com",
        fetch: async (input, init) => app.request(input.toString(), init),
        token: session.data.token,
      })
    }

    const ownerPolicy = await (await tenantClientFor(owner.id)).organizationTenantRealmLoginPolicyGet(realmId)
    expect(ownerPolicy.success).toBe(true)

    const outsiderPolicy = await (await tenantClientFor(outsider.id)).organizationTenantRealmLoginPolicyGet(realmId)
    expect(outsiderPolicy.success).toBe(false)
  })
})
