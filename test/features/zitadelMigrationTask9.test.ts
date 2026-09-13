import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { externalIdentityRepositoryCreate } from "../../src/features/externalIdentities/persistence/externalIdentityRepositoryCreate.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { zitadelMigrationImport } from "../../src/features/zitadelMigration/actions/zitadelMigrationImport.js"
import { zitadelMigrationSourceRecordRepositoryCreate } from "../../src/features/zitadelMigration/persistence/zitadelMigrationSourceRecordRepositoryCreate.js"
import type { ZitadelMigrationSnapshot } from "../../src/features/zitadelMigration/public/zitadelMigrationSnapshotSchema.js"
import { type StorageDatabase, storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

test("task 9 maps Google, GitHub, and Microsoft, but not generic OIDC or SAML", async () => {
  await withDatabase((database, realmId) => {
    const snapshot = baseSnapshot()
    snapshot.identityProviders = ["google", "github", "microsoft", "oidc", "saml"].map((type, index) => ({
      sourceId: `provider-${index}`,
      name: type,
      provider: type === "saml" ? "saml" : "oidc",
      clientId: `client-${index}`,
      authworksType: ["google", "github", "microsoft"].includes(type)
        ? (type as "google" | "github" | "microsoft")
        : null,
      configuration: { scopes: ["openid"], redirectUri: "https://app.example/callback" },
      createdAt: 10,
      updatedAt: 20,
    }))
    snapshot.completeness.identityProviders = { complete: true, count: 5 }
    const providers = externalIdentityRepositoryCreate(database.db)
    const mappings = zitadelMigrationSourceRecordRepositoryCreate(database.db)
    for (const [index, type] of ["google", "github", "microsoft"].entries()) {
      providers.externalIdentityProviderCreate({
        id: `dest-${index}`,
        realmId,
        organizationId: null,
        type,
        clientId: "old",
        clientSecret: "secret",
        displayName: "old",
        enabled: true,
        allowAccountCreation: false,
        redirectUri: "old",
        scopes: '["old"]',
        createdAt: 1,
        updatedAt: 1,
        version: 1,
      })
      mappings.sourceRecordUpsert({
        realmId,
        sourceInstance: snapshot.sourceInstance,
        entityType: "identityProvider",
        sourceId: `provider-${index}`,
        destinationId: `dest-${index}`,
        sourceUpdatedAt: 1,
      })
    }
    const result = zitadelMigrationImport({ database, realmId, snapshot })
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.counts.identityProviders).toMatchObject({ updated: 3, imported: 3, skipped: 0 })
    expect(result.data.unsupported.filter((item) => item.entity === "identityProviders")).toEqual([
      { entity: "identityProviders", reason: "reconfiguration-required", sourceId: "provider-0" },
      { entity: "identityProviders", reason: "reconfiguration-required", sourceId: "provider-1" },
      { entity: "identityProviders", reason: "reconfiguration-required", sourceId: "provider-2" },
      { entity: "identityProviders", reason: "destination-credentials-required", sourceId: "provider-3" },
      { entity: "identityProviders", reason: "destination-credentials-required", sourceId: "provider-4" },
    ])
    expect(result.data.requiresRotation).toEqual({
      count: 3,
      sourceIds: ["provider-0", "provider-1", "provider-2"],
    })
    expect(JSON.stringify(result.data.unsupported)).not.toContain("secret")
    expect(providers.externalIdentityProviderGet(realmId, "dest-0")).toMatchObject({
      data: { enabled: false, clientSecret: "secret", clientId: "client-0" },
    })
  })
})

test("task 9 converges a secure provider bundle and keeps links and mappings stable", async () => {
  await withDatabase((database, realmId) => {
    const snapshot = baseSnapshot()
    snapshot.users = [user("1", "one@example.com"), user("2", "two@example.com")]
    snapshot.completeness.users = { complete: true, count: 2 }
    snapshot.identityProviders = [provider("provider-1", "google"), provider("provider-2", "github")]
    snapshot.completeness.identityProviders = { complete: true, count: 2 }
    snapshot.externalIdentityLinks = [
      {
        sourceId: "link-1",
        identityProviderId: "provider-1",
        userId: "1",
        externalSubject: "subject-1",
        createdAt: 10,
        updatedAt: 20,
      },
      {
        sourceId: "link-2",
        identityProviderId: "provider-2",
        userId: "2",
        externalSubject: "subject-2",
        createdAt: 10,
        updatedAt: 20,
      },
    ]
    snapshot.completeness.externalIdentityLinks = { complete: true, count: 2 }
    const bundle = {
      bundleVersion: 1 as const,
      sourceInstance: snapshot.sourceInstance,
      destinationOrigin: "https://authworks.example",
      providers: [
        { sourceId: "provider-1", type: "google" as const, clientId: "google-client", clientSecret: "google-secret" },
        { sourceId: "provider-2", type: "github" as const, clientId: "github-client", clientSecret: "github-secret" },
      ],
    }
    const providers = externalIdentityRepositoryCreate(database.db)
    const mappings = zitadelMigrationSourceRecordRepositoryCreate(database.db)
    const first = zitadelMigrationImport({ database, realmId, snapshot, providerCredentialBundle: bundle })
    if (!first.success) throw new Error(first.errorMessage)
    expect(first.success).toBe(true)
    if (!first.success) return
    expect(first.data.counts.identityProviders).toMatchObject({ created: 2 })
    expect(first.data.rotated).toBe(2)
    expect(first.data.requiresRotation).toEqual({ count: 0, sourceIds: [] })
    const providerList = providers.externalIdentityProviderList(realmId)
    expect(providerList.success).toBe(true)
    if (!providerList.success) return
    expect(providerList.data).toHaveLength(2)
    const providerRows = providerList.data
    expect(providerRows.every((row) => row.enabled === true)).toBe(true)
    expect(
      providerRows.every(
        (row) =>
          row.redirectUri.startsWith("https://authworks.example/realms/") && row.redirectUri.endsWith("/callback"),
      ),
    ).toBe(true)
    const mappingIds = mappings.sourceRecordList(realmId, snapshot.sourceInstance)
    expect(mappingIds.success).toBe(true)
    if (!mappingIds.success) return
    const firstIds = mappingIds.data.map((item) => `${item.entityType}:${item.sourceId}:${item.destinationId}`).sort()
    const second = zitadelMigrationImport({ database, realmId, snapshot, providerCredentialBundle: bundle })
    expect(second.success).toBe(true)
    if (!second.success) return
    expect(second.data.counts.identityProviders).toMatchObject({ created: 0, updated: 0, unchanged: 2 })
    expect(second.data.rotated).toBe(0)
    const changed = structuredClone(bundle)
    changed.providers[1]!.clientSecret = "rotated-secret"
    const third = zitadelMigrationImport({ database, realmId, snapshot, providerCredentialBundle: changed })
    expect(third.success).toBe(true)
    if (!third.success) return
    expect(third.data.rotated).toBe(1)
    const finalMappings = mappings.sourceRecordList(realmId, snapshot.sourceInstance)
    expect(finalMappings.success).toBe(true)
    if (finalMappings.success)
      expect(
        finalMappings.data.map((item) => `${item.entityType}:${item.sourceId}:${item.destinationId}`).sort(),
      ).toEqual(firstIds)
    const malformed = structuredClone(snapshot) as Record<string, unknown>
    malformed.externalIdentityLinks = [
      { sourceId: "late", identityProviderId: "provider-1", userId: "1", externalSubject: "" },
    ]
    expect(
      zitadelMigrationImport({ database, realmId, snapshot: malformed, providerCredentialBundle: bundle }).success,
    ).toBe(false)
    const finalProviderList = providers.externalIdentityProviderList(realmId)
    expect(finalProviderList.success).toBe(true)
    if (finalProviderList.success) expect(finalProviderList.data).toHaveLength(2)
  })
})

test("task 9 links by stable subject, never email, preserves incomplete data, and deletes links before providers", async () => {
  await withDatabase((database, realmId) => {
    const snapshot = baseSnapshot()
    snapshot.users = [user("1", "first@example.com")]
    snapshot.completeness.users = { complete: true, count: 1 }
    snapshot.identityProviders = [provider("provider-1", "google")]
    snapshot.completeness.identityProviders = { complete: true, count: 1 }
    zitadelMigrationSourceRecordRepositoryCreate(database.db).sourceRecordUpsert({
      realmId,
      sourceInstance: snapshot.sourceInstance,
      entityType: "identityProvider",
      sourceId: "provider-1",
      destinationId: "dest-provider-1",
      sourceUpdatedAt: 1,
    })
    externalIdentityRepositoryCreate(database.db).externalIdentityProviderCreate({
      id: "dest-provider-1",
      realmId,
      organizationId: null,
      type: "google",
      clientId: "old",
      clientSecret: "secret",
      displayName: "old",
      enabled: true,
      allowAccountCreation: false,
      redirectUri: "old",
      scopes: "[]",
      createdAt: 1,
      updatedAt: 1,
      version: 1,
    })
    snapshot.externalIdentityLinks = [
      {
        sourceId: "link-1",
        identityProviderId: "provider-1",
        userId: "1",
        externalSubject: "subject-1",
        createdAt: 30,
        updatedAt: 40,
      },
    ]
    snapshot.completeness.externalIdentityLinks = { complete: true, count: 1 }
    const imported = zitadelMigrationImport({ database, realmId, snapshot })
    expect(imported.success).toBe(true)
    const identities = externalIdentityRepositoryCreate(database.db)
    const first = identities.externalIdentityGetByProviderSubject(realmId, "dest-provider-1", "subject-1")
    expect(first).toMatchObject({ data: { userId: expect.any(String), email: null, createdAt: 30, updatedAt: 40 } })
    const incomplete = structuredClone(snapshot)
    incomplete.externalIdentityLinks = []
    incomplete.completeness.externalIdentityLinks = { complete: false, count: 0 }
    expect(zitadelMigrationImport({ database, realmId, snapshot: incomplete }).success).toBe(true)
    const preserved = identities.externalIdentityGetByProviderSubject(realmId, "dest-provider-1", "subject-1")
    expect(preserved.success).toBe(true)
    if (!preserved.success) return
    expect(preserved.data).not.toBeNull()
    const empty = structuredClone(snapshot)
    empty.externalIdentityLinks = []
    empty.identityProviders = []
    empty.completeness.externalIdentityLinks = { complete: true, count: 0 }
    empty.completeness.identityProviders = { complete: true, count: 0 }
    expect(zitadelMigrationImport({ authoritative: true, database, realmId, snapshot: empty }).success).toBe(true)
    const removed = identities.externalIdentityGetByProviderSubject(realmId, "dest-provider-1", "subject-1")
    const providerResult = identities.externalIdentityProviderGet(realmId, "dest-provider-1")
    expect(removed.success && providerResult.success).toBe(true)
    if (!removed.success || !providerResult.success) return
    expect(removed.data).toBeNull()
    expect(providerResult.data).toBeNull()
  })
})

test("task 9 rejects native subject collisions and rolls back invalid imports", async () => {
  await withDatabase((database, realmId) => {
    const snapshot = baseSnapshot()
    snapshot.users = [user("1", "one@example.com"), user("2", "two@example.com")]
    snapshot.completeness.users = { complete: true, count: 2 }
    snapshot.identityProviders = [provider("provider-1", "google")]
    snapshot.completeness.identityProviders = { complete: true, count: 1 }
    zitadelMigrationSourceRecordRepositoryCreate(database.db).sourceRecordUpsert({
      realmId,
      sourceInstance: snapshot.sourceInstance,
      entityType: "identityProvider",
      sourceId: "provider-1",
      destinationId: "dest-provider-1",
      sourceUpdatedAt: 1,
    })
    externalIdentityRepositoryCreate(database.db).externalIdentityProviderCreate({
      id: "dest-provider-1",
      realmId,
      organizationId: null,
      type: "google",
      clientId: "old",
      clientSecret: "secret",
      displayName: "old",
      enabled: true,
      allowAccountCreation: false,
      redirectUri: "old",
      scopes: "[]",
      createdAt: 1,
      updatedAt: 1,
      version: 1,
    })
    snapshot.externalIdentityLinks = [
      { sourceId: "link-1", identityProviderId: "provider-1", userId: "1", externalSubject: "same" },
      { sourceId: "link-2", identityProviderId: "provider-1", userId: "2", externalSubject: "same" },
    ]
    snapshot.completeness.externalIdentityLinks = { complete: true, count: 2 }
    const result = zitadelMigrationImport({ database, realmId, snapshot })
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.skipped).toContainEqual({
      entity: "externalIdentityLinks",
      sourceId: "link-2",
      reason: "native-subject-collision",
    })
  })
})

function baseSnapshot(): ZitadelMigrationSnapshot {
  const value = JSON.parse(
    readFileSync(join(import.meta.dir, "../fixtures/zitadel-migration-snapshot.json"), "utf8"),
  ) as ZitadelMigrationSnapshot
  for (const key of Object.keys(value.completeness) as (keyof ZitadelMigrationSnapshot["completeness"])[]) {
    value[key] = [] as never
    value.completeness[key] = { complete: true, count: 0 }
  }
  return value
}
function user(id: string, email: string) {
  return {
    id,
    userName: id,
    email,
    emailVerified: false,
    emailVerifiedAt: null,
    deletedAt: null,
    state: "active" as const,
    createdAt: 10,
    updatedAt: 20,
    profile: { displayName: id, firstName: id, lastName: null, nickName: null, preferredLanguage: null, gender: null },
  }
}
function provider(sourceId: string, authworksType: "google" | "github" | "microsoft") {
  return {
    sourceId,
    name: authworksType,
    provider: "oidc" as const,
    authworksType,
    enabled: true,
    clientId: sourceId,
    organizationId: undefined,
    createdAt: 10,
    updatedAt: 20,
  }
}
async function withDatabase(operation: (database: StorageDatabase, realmId: string) => void) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-task9-"))
  const kit = platformTestkitCreate()
  const opened = storageDatabaseOpen(join(directory, "authworks.sqlite"), kit.runtime)
  if (!opened.success) throw new Error(opened.errorMessage)
  const realm = realmCreate({
    context: realmSystemContextCreate(),
    database: opened.data,
    input: { domain: "task9.example", name: "Task 9" },
    runtime: kit.runtime,
  })
  if (!realm.success) throw new Error(realm.errorMessage)
  try {
    operation(opened.data, realm.data.realm.id)
  } finally {
    opened.data.close()
    await rm(directory, { force: true, recursive: true })
  }
}
