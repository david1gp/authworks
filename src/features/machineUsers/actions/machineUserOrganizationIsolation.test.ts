import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { machineApiKeyCreate } from "./machineApiKeyCreate.js"
import { machineClientCredentialsIssue } from "./machineClientCredentialsIssue.js"
import { machineCredentialAuthenticate } from "./machineCredentialAuthenticate.js"
import { machineCredentialRevoke } from "./machineCredentialRevoke.js"
import { machineUserCreate } from "./machineUserCreate.js"
import { machineUserGet } from "./machineUserGet.js"
import { machineUserList } from "./machineUserList.js"
import { organizationCreate } from "../../organizations/actions/organizationCreate.js"
import { realmCreate } from "../../realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../realms/domain/realmSystemContextCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../../platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../../platform/testkit/platformTestkitCreate.js"

async function withDatabase<T>(operation: (database: StorageDatabase) => Promise<T>) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-machine-user-org-isolation-"))
  const testkit = platformTestkitCreate()
  const opened = storageDatabaseOpen(join(directory, "authworks.sqlite"), testkit.runtime)
  expect(opened.success).toBe(true)
  if (!opened.success) throw new Error(opened.errorMessage)
  try {
    return await operation(opened.data)
  } finally {
    opened.data.close()
    await rm(directory, { force: true, recursive: true })
  }
}

async function organizationSeed(database: StorageDatabase, domain: string, name: string) {
  const realmCreated = realmCreate({ context: realmSystemContextCreate(), database, input: { domain, name: domain } })
  expect(realmCreated.success).toBe(true)
  if (!realmCreated.success) throw new Error(realmCreated.errorMessage)
  const organizationCreated = organizationCreate({
    context: realmSystemContextCreate(),
    database,
    input: { name },
    realmId: realmCreated.data.realm.id,
  })
  expect(organizationCreated.success).toBe(true)
  if (!organizationCreated.success) throw new Error(organizationCreated.errorMessage)
  return { organization: organizationCreated.data.organization, realm: realmCreated.data.realm }
}

test("allows one machine user name per organization while rejecting duplicates inside one organization", async () => {
  await withDatabase(async (database) => {
    const realm = await organizationSeed(database, "org-names.example.com", "First")
    const second = organizationCreate({
      context: realmSystemContextCreate(),
      database,
      input: { name: "Second" },
      realmId: realm.realm.id,
    })
    expect(second.success).toBe(true)
    if (!second.success) return
    const secondOrganization = second.data.organization

    const first = machineUserCreate({
      context: realmSystemContextCreate(),
      database,
      input: { displayName: "Worker", userName: "worker" },
      organizationId: realm.organization.id,
      realmId: realm.realm.id,
    })
    expect(first.success).toBe(true)

    const sameNameOtherOrganization = machineUserCreate({
      context: realmSystemContextCreate(),
      database,
      input: { displayName: "Worker", userName: "worker" },
      organizationId: secondOrganization.id,
      realmId: realm.realm.id,
    })
    expect(sameNameOtherOrganization.success).toBe(true)

    const duplicateSameOrganization = machineUserCreate({
      context: realmSystemContextCreate(),
      database,
      input: { displayName: "Worker again", userName: "worker" },
      organizationId: realm.organization.id,
      realmId: realm.realm.id,
    })
    expect(duplicateSameOrganization.success).toBe(false)
  })
})

test("keeps machine user reads, lists, and credential revocation inside one organization", async () => {
  await withDatabase(async (database) => {
    const realm = await organizationSeed(database, "org-reads.example.com", "First")
    const second = organizationCreate({
      context: realmSystemContextCreate(),
      database,
      input: { name: "Second" },
      realmId: realm.realm.id,
    })
    expect(second.success).toBe(true)
    if (!second.success) return
    const secondOrganization = second.data.organization

    const created = machineUserCreate({
      context: realmSystemContextCreate(),
      database,
      input: { displayName: "Worker", userName: "worker" },
      organizationId: realm.organization.id,
      realmId: realm.realm.id,
    })
    expect(created.success).toBe(true)
    if (!created.success) return

    expect(
      machineUserGet({
        context: realmSystemContextCreate(),
        database,
        machineUserId: created.data.machineUser.id,
        organizationId: secondOrganization.id,
        realmId: realm.realm.id,
      }).success,
    ).toBe(false)

    const otherOrganizationList = machineUserList({
      context: realmSystemContextCreate(),
      database,
      organizationId: secondOrganization.id,
      realmId: realm.realm.id,
    })
    expect(otherOrganizationList.success).toBe(true)
    if (otherOrganizationList.success) expect(otherOrganizationList.data.items).toHaveLength(0)

    const apiKey = machineApiKeyCreate({
      context: realmSystemContextCreate(),
      database,
      input: { machineUserId: created.data.machineUser.id, name: "service" },
      organizationId: realm.organization.id,
      realmId: realm.realm.id,
    })
    expect(apiKey.success).toBe(true)
    if (!apiKey.success) return

    expect(
      machineCredentialRevoke({
        context: realmSystemContextCreate(),
        credentialId: apiKey.data.credential.id,
        database,
        organizationId: secondOrganization.id,
        realmId: realm.realm.id,
      }).success,
    ).toBe(false)
    expect(
      machineCredentialAuthenticate({ database, realmId: realm.realm.id, token: apiKey.data.secret }).success,
    ).toBe(true)
  })
})

test("fails client credentials closed when one client id exists in several organizations", async () => {
  await withDatabase(async (database) => {
    const realm = await organizationSeed(database, "org-ambiguous.example.com", "First")
    const second = organizationCreate({
      context: realmSystemContextCreate(),
      database,
      input: { name: "Second" },
      realmId: realm.realm.id,
    })
    expect(second.success).toBe(true)
    if (!second.success) return
    const secondOrganization = second.data.organization

    const first = machineUserCreate({
      context: realmSystemContextCreate(),
      database,
      input: { displayName: "Worker", userName: "worker" },
      organizationId: realm.organization.id,
      realmId: realm.realm.id,
    })
    expect(first.success).toBe(true)
    if (!first.success) return
    const secondUser = machineUserCreate({
      context: realmSystemContextCreate(),
      database,
      input: { displayName: "Worker", userName: "worker" },
      organizationId: secondOrganization.id,
      realmId: realm.realm.id,
    })
    expect(secondUser.success).toBe(true)
    if (!secondUser.success) return

    expect(
      machineClientCredentialsIssue({
        database,
        input: { clientId: "worker", clientSecret: first.data.clientSecret },
        realmId: realm.realm.id,
      }).success,
    ).toBe(false)
    expect(
      machineClientCredentialsIssue({
        database,
        input: { clientId: "worker", clientSecret: secondUser.data.clientSecret },
        realmId: realm.realm.id,
      }).success,
    ).toBe(false)
  })
})

test("scopes token authentication to the organization that owns the credential", async () => {
  await withDatabase(async (database) => {
    const realm = await organizationSeed(database, "org-token.example.com", "First")
    const second = organizationCreate({
      context: realmSystemContextCreate(),
      database,
      input: { name: "Second" },
      realmId: realm.realm.id,
    })
    expect(second.success).toBe(true)
    if (!second.success) return
    const secondOrganization = second.data.organization

    const created = machineUserCreate({
      context: realmSystemContextCreate(),
      database,
      input: { displayName: "Worker", userName: "worker" },
      organizationId: realm.organization.id,
      realmId: realm.realm.id,
    })
    expect(created.success).toBe(true)
    if (!created.success) return

    const apiKey = machineApiKeyCreate({
      context: realmSystemContextCreate(),
      database,
      input: { machineUserId: created.data.machineUser.id, name: "service" },
      organizationId: realm.organization.id,
      realmId: realm.realm.id,
    })
    expect(apiKey.success).toBe(true)
    if (!apiKey.success) return

    expect(
      machineCredentialAuthenticate({
        database,
        organizationId: realm.organization.id,
        realmId: realm.realm.id,
        token: apiKey.data.secret,
      }).success,
    ).toBe(true)
    expect(
      machineCredentialAuthenticate({
        database,
        organizationId: secondOrganization.id,
        realmId: realm.realm.id,
        token: apiKey.data.secret,
      }).success,
    ).toBe(false)
  })
})
