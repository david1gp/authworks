import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import * as v from "valibot"
import { oidcApiClientCreate } from "../../src/features/oidc/client/oidcApiClientCreate.js"
import { oidcClientCreate } from "../../src/features/oidc/actions/oidcClientCreate.js"
import { oidcClientGet } from "../../src/features/oidc/actions/oidcClientGet.js"
import { oidcClientSecretMatches } from "../../src/features/oidc/domain/oidcClientSecretMatches.js"
import { oidcJwtSign } from "../../src/features/oidc/domain/oidcJwtSign.js"
import { oidcRedirectUriMatches } from "../../src/features/oidc/domain/oidcRedirectUriMatches.js"
import { oidcRedirectUriValidate } from "../../src/features/oidc/domain/oidcRedirectUriValidate.js"
import { oidcValueDecrypt } from "../../src/features/oidc/domain/oidcValueEncrypt.js"
import { oidcClientList } from "../../src/features/oidc/actions/oidcClientList.js"
import { oidcDiscoveryGet } from "../../src/features/oidc/actions/oidcDiscoveryGet.js"
import { oidcJwksGet } from "../../src/features/oidc/actions/oidcJwksGet.js"
import { oidcSigningKeyCreate } from "../../src/features/oidc/actions/oidcSigningKeyCreate.js"
import { oidcSigningKeyList } from "../../src/features/oidc/actions/oidcSigningKeyList.js"
import { oidcDiscoverySchema } from "../../src/features/oidc/public/oidcDiscoverySchema.js"
import { oidcJwksSchema } from "../../src/features/oidc/public/oidcJwksSchema.js"
import { instanceBootstrapAdminCreate } from "../../src/features/instances/actions/instanceBootstrapAdminCreate.js"
import { instanceCreate } from "../../src/features/instances/actions/instanceCreate.js"
import { instanceSystemContextCreate } from "../../src/features/instances/domain/instanceSystemContextCreate.js"
import { instanceTenantContextCreate } from "../../src/features/instances/domain/instanceTenantContextCreate.js"
import { oidcServerAppCreate } from "../../src/features/oidc/server/oidcServerAppCreate.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageEventTable } from "../../src/platform/storage/storageEventTable.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

async function withDatabase<T>(operation: (database: StorageDatabase) => Promise<T>) {
  const directory = await mkdtemp(join(tmpdir(), "zitadel-v2-oidc-"))
  const testkit = platformTestkitCreate()
  const opened = storageDatabaseOpen(join(directory, "zitadel.sqlite"), testkit.runtime)
  expect(opened.success).toBe(true)
  if (!opened.success) throw new Error(opened.errorMessage)
  try {
    return await operation(opened.data)
  } finally {
    opened.data.close()
    await rm(directory, { force: true, recursive: true })
  }
}

async function createInstance(database: StorageDatabase, domain: string) {
  const created = instanceCreate({ context: instanceSystemContextCreate(), database, input: { domain, name: domain } })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  return created.data.instance
}

test("redirect URI matching is exact and rejects unsafe registrations", () => {
  expect(oidcRedirectUriValidate("https://client.example/callback").success).toBe(true)
  expect(oidcRedirectUriValidate("https://client.example/callback/").success).toBe(true)
  expect(oidcRedirectUriMatches("https://client.example/callback", ["https://client.example/callback"]).success).toBe(
    true,
  )
  expect(oidcRedirectUriMatches("https://client.example/callback/", ["https://client.example/callback"]).success).toBe(
    false,
  )
  expect(oidcRedirectUriValidate("http://client.example/callback").success).toBe(false)
  expect(oidcRedirectUriValidate("https://client.example/callback#fragment").success).toBe(false)
  expect(oidcRedirectUriValidate("https://user:password@client.example/callback").success).toBe(false)
})

test("OIDC clients are tenant-isolated, return secrets once, and write safe events", async () => {
  await withDatabase(async (database) => {
    const alpha = await createInstance(database, "oidc-alpha.example.com")
    const beta = await createInstance(database, "oidc-beta.example.com")
    const created = oidcClientCreate({
      context: instanceSystemContextCreate(),
      database,
      input: {
        allowedScopes: ["openid", "profile"],
        clientType: "confidential",
        name: "Alpha client",
        redirectUris: ["https://client.example/callback"],
      },
      instanceId: alpha.id,
    })
    if (!created.success) throw new Error(created.errorMessage)
    expect(created.success).toBe(true)
    if (!created.success || created.data.clientSecret === undefined) return
    expect(created.data.clientSecret).toHaveLength(43)
    expect(oidcClientSecretMatches(created.data.clientSecret, "wrong-hash")).toBe(false)
    const row = database.db
      .select()
      .from((await import("../../src/features/oidc/persistence/oidcClientTable.js")).oidcClientTable)
      .get()
    expect(row?.secretHash).not.toBe(created.data.clientSecret)
    const client = oidcClientGet({
      clientId: created.data.client.id,
      context: instanceSystemContextCreate(),
      database,
      instanceId: alpha.id,
    })
    expect(client.success).toBe(true)
    if (!client.success) return
    expect(client.data.client).not.toHaveProperty("clientSecret")
    const alphaContext = instanceTenantContextCreate(alpha.id, "alpha-admin")
    const crossTenantClient = oidcClientGet({
      clientId: created.data.client.id,
      context: alphaContext,
      database,
      instanceId: beta.id,
    })
    expect(crossTenantClient.success).toBe(false)
    const betaClients = oidcClientList({
      context: instanceTenantContextCreate(beta.id, "beta-admin"),
      database,
      instanceId: beta.id,
    })
    expect(betaClients.success).toBe(true)
    if (!betaClients.success) return
    expect(betaClients.data.clients).toEqual([])
    const events = database.db.select().from(storageEventTable).all()
    expect(JSON.stringify(events)).not.toContain(created.data.clientSecret)
    expect(JSON.stringify(events)).not.toContain("secretHash")
  })
})

test("signing keys rotate without exposing private material and serve discovery and JWKS", async () => {
  await withDatabase(async (database) => {
    const instance = await createInstance(database, "keys.example.com")
    const first = oidcSigningKeyCreate({
      context: instanceSystemContextCreate(),
      database,
      encryptionSecret: "test-encryption-secret",
      instanceId: instance.id,
    })
    expect(first.success).toBe(true)
    if (!first.success) return
    const second = oidcSigningKeyCreate({
      context: instanceSystemContextCreate(),
      database,
      encryptionSecret: "test-encryption-secret",
      instanceId: instance.id,
    })
    expect(second.success).toBe(true)
    if (!second.success) return
    const keys = oidcSigningKeyList({ context: instanceSystemContextCreate(), database, instanceId: instance.id })
    expect(keys.success).toBe(true)
    if (!keys.success) return
    expect(keys.data?.signingKeys).toHaveLength(2)
    expect(keys.data?.signingKeys[0]?.status).toBe("active")
    expect(keys.data?.signingKeys[1]?.status).toBe("retired")
    expect(keys.data?.signingKeys[0]).not.toHaveProperty("encryptedPrivateKey")
    const jwks = oidcJwksGet({ database, instanceId: instance.id })
    expect(jwks.success).toBe(true)
    if (!jwks.success) return
    expect(jwks.data?.keys).toHaveLength(2)
    const discovery = oidcDiscoveryGet({ database, instanceId: instance.id })
    expect(discovery.success).toBe(true)
    if (!discovery.success) return
    expect(discovery.data?.issuer).toBe("https://keys.example.com")
    expect(discovery.data?.jwks_uri).toBe("https://keys.example.com/.well-known/jwks.json")
    const encrypted = database.sqlite
      .query(
        "SELECT encrypted_private_key AS encryptedPrivateKey, public_jwk AS publicJwk FROM oidc_signing_keys WHERE id = ?",
      )
      .get(first.data.signingKey.id) as { encryptedPrivateKey: string; publicJwk: string } | null
    expect(encrypted?.encryptedPrivateKey).toBeString()
    expect(encrypted?.publicJwk).not.toContain("private")
    const privateKey = oidcValueDecrypt(encrypted?.encryptedPrivateKey ?? "", instance.id, "test-encryption-secret")
    expect(privateKey.success).toBe(true)
    if (!privateKey.success) return
    const token = oidcJwtSign(
      { alg: "RS256", kid: first.data.signingKey.id, typ: "JWT" },
      { sub: "user" },
      privateKey.data,
    )
    expect(token.success).toBe(true)
    const eventRows = database.db.select().from(storageEventTable).all()
    expect(JSON.stringify(eventRows)).not.toContain(privateKey.data)
  })
})

test("OIDC management routes use system auth while discovery and JWKS are public tenant routes", async () => {
  await withDatabase(async (database) => {
    const instance = await createInstance(database, "routes.example.com")
    const bootstrap = instanceBootstrapAdminCreate({
      context: instanceSystemContextCreate(),
      database,
      instanceId: instance.id,
    })
    expect(bootstrap.success).toBe(true)
    if (!bootstrap.success) return
    const app = oidcServerAppCreate({ database, systemSecret: "system-secret" })
    const unauthorized = await app.fetch(new Request(`https://server/system/instances/${instance.id}/oidc/clients`))
    expect(unauthorized.status).toBe(401)
    const client = oidcApiClientCreate({
      baseUrl: "https://server",
      token: "system-secret",
      fetch: async (input, init) => app.request(input.toString(), init),
    })
    const created = await client.oidcClientCreate(instance.id, {
      clientType: "public",
      name: "Route client",
      redirectUris: ["https://client.example/callback"],
    })
    if (!created.success) throw new Error(created.errorMessage)
    expect(created.success).toBe(true)
    const discovery = await app.fetch(new Request("https://routes.example.com/.well-known/openid-configuration"))
    const jwks = await app.fetch(new Request("https://routes.example.com/.well-known/jwks.json"))
    expect(discovery.status).toBe(200)
    expect(jwks.status).toBe(200)
    const discoveryBody = v.parse(oidcDiscoverySchema, await discovery.json())
    const jwksBody = v.parse(oidcJwksSchema, await jwks.json())
    expect(discoveryBody.issuer).toBe("https://routes.example.com")
    expect(jwksBody.keys).toEqual([])
    const tenant = await app.fetch(
      new Request(`https://routes.example.com/instances/${instance.id}/oidc/clients`, {
        headers: { authorization: `Bearer ${bootstrap.data.bootstrapAdmin.secret.valueGet()}` },
      }),
    )
    expect(tenant.status).toBe(200)
  })
})
