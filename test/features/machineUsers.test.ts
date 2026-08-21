import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import * as v from "valibot"
import { authorizationEnforce } from "../../src/features/authorization/actions/authorizationEnforce.js"
import { machineApiKeyCreate } from "../../src/features/machineUsers/actions/machineApiKeyCreate.js"
import { machineClientCredentialsIssue } from "../../src/features/machineUsers/actions/machineClientCredentialsIssue.js"
import { machineClientCredentialsRevoke } from "../../src/features/machineUsers/actions/machineClientCredentialsRevoke.js"
import { machineCredentialAuthenticate } from "../../src/features/machineUsers/actions/machineCredentialAuthenticate.js"
import { machineCredentialRevoke } from "../../src/features/machineUsers/actions/machineCredentialRevoke.js"
import { machinePersonalAccessTokenCreate } from "../../src/features/machineUsers/actions/machinePersonalAccessTokenCreate.js"
import { machineUserClientSecretRotate } from "../../src/features/machineUsers/actions/machineUserClientSecretRotate.js"
import { machineUserCreate } from "../../src/features/machineUsers/actions/machineUserCreate.js"
import { machineUserGet } from "../../src/features/machineUsers/actions/machineUserGet.js"
import { machineUserLifecycleSet } from "../../src/features/machineUsers/actions/machineUserLifecycleSet.js"
import { machineUserList } from "../../src/features/machineUsers/actions/machineUserList.js"
import { machineUserApiClientCreate } from "../../src/features/machineUsers/client/machineUserApiClientCreate.js"
import { machineCredentialTable } from "../../src/features/machineUsers/persistence/machineCredentialTable.js"
import { machineUserTable } from "../../src/features/machineUsers/persistence/machineUserTable.js"
import { machineUserCreateResponseSchema } from "../../src/features/machineUsers/public/machineUserCreateResponseSchema.js"
import { machineUserServerAppCreate } from "../../src/features/machineUsers/server/machineUserServerAppCreate.js"
import { oidcDiscoverySchema } from "../../src/features/oidc/public/oidcDiscoverySchema.js"
import { oidcTokenResponseSchema } from "../../src/features/oidc/public/oidcTokenResponseSchema.js"
import { oidcServerAppCreate } from "../../src/features/oidc/server/oidcServerAppCreate.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../src/features/realms/domain/realmTenantContextCreate.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageEventTable } from "../../src/platform/storage/storageEventTable.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

async function withDatabase<T>(
  operation: (database: StorageDatabase, testkit: ReturnType<typeof platformTestkitCreate>) => Promise<T>,
) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-machine-users-"))
  const testkit = platformTestkitCreate()
  const opened = storageDatabaseOpen(join(directory, "authworks.sqlite"), testkit.runtime)
  expect(opened.success).toBe(true)
  if (!opened.success) throw new Error(opened.errorMessage)
  try {
    return await operation(opened.data, testkit)
  } finally {
    opened.data.close()
    await rm(directory, { force: true, recursive: true })
  }
}

async function createRealm(database: StorageDatabase, domain: string) {
  const created = realmCreate({ context: realmSystemContextCreate(), database, input: { domain, name: domain } })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  return created.data.realm
}

test("machine users issue one-time client secrets and keep credential material hashed", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "machine-users.example.com")
    const created = machineUserCreate({
      context: realmSystemContextCreate(),
      database,
      input: { displayName: "Build worker", scopes: ["api.read", "api.write"], userName: " Build.Worker " },
      realmId: realm.id,
    })
    expect(created.success).toBe(true)
    if (!created.success) return
    expect(created.data.clientId).toBe("build.worker")
    expect(created.data.clientSecret).not.toHaveLength(0)
    expect(v.safeParse(machineUserCreateResponseSchema, created.data).success).toBe(true)
    const storedUser = database.db.select().from(machineUserTable).get()
    const storedCredential = database.db.select().from(machineCredentialTable).get()
    expect(storedUser?.scopes).toBe(JSON.stringify(["api.read", "api.write"]))
    expect(storedCredential?.secretHash).not.toContain(created.data.clientSecret)
    const fetched = machineUserGet({
      context: realmSystemContextCreate(),
      database,
      realmId: realm.id,
      machineUserId: created.data.machineUser.id,
    })
    expect(fetched.success).toBe(true)
    if (fetched.success) expect(JSON.stringify(fetched.data)).not.toContain(created.data.clientSecret)
    const events = database.db.select().from(storageEventTable).all()
    expect(events.every((event) => !JSON.stringify(event.payload).includes(created.data.clientSecret))).toBe(true)
    expect(
      events.every((event) => !JSON.stringify(event.payload).includes(storedCredential?.secretHash ?? "never")),
    ).toBe(true)
  })
})

test("client credentials, PATs, API keys, scopes, expiry, rotation, and revocation are enforced", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = await createRealm(database, "credentials.example.com")
    const created = machineUserCreate({
      context: realmSystemContextCreate(),
      database,
      input: { displayName: "Worker", scopes: ["api.read", "api.write"], userName: "worker" },
      realmId: realm.id,
    })
    expect(created.success).toBe(true)
    if (!created.success) return
    const token = machineClientCredentialsIssue({
      database,
      input: { clientId: "worker", clientSecret: created.data.clientSecret, scope: ["api.read"] },
      realmId: realm.id,
    })
    expect(token.success).toBe(true)
    if (!token.success) return
    const authenticated = machineCredentialAuthenticate({
      database,
      realmId: realm.id,
      token: token.data.accessToken,
    })
    expect(authenticated.success).toBe(true)
    if (!authenticated.success) return
    expect(authenticated.data.scopes).toEqual(["api.read"])
    expect(
      authorizationEnforce({ actor: authenticated.data.actor, realmId: realm.id, permission: "api.read" }).success,
    ).toBe(true)
    expect(
      authorizationEnforce({ actor: authenticated.data.actor, realmId: realm.id, permission: "api.write" }).success,
    ).toBe(false)
    expect(
      machineClientCredentialsIssue({
        database,
        input: { clientId: "worker", clientSecret: "wrong", scope: ["api.read"] },
        realmId: realm.id,
      }).success,
    ).toBe(false)
    expect(
      machineClientCredentialsIssue({
        database,
        input: { clientId: "", clientSecret: created.data.clientSecret },
        realmId: realm.id,
      }).success,
    ).toBe(false)
    expect(
      machineClientCredentialsIssue({
        database,
        input: { clientId: "unknown", clientSecret: created.data.clientSecret },
        realmId: realm.id,
      }).success,
    ).toBe(false)
    expect(
      machineClientCredentialsIssue({
        database,
        input: { clientId: "worker", clientSecret: created.data.clientSecret, scope: ["api.admin"] },
        realmId: realm.id,
      }).success,
    ).toBe(false)

    expect(
      machineClientCredentialsRevoke({
        clientId: "worker",
        clientSecret: created.data.clientSecret,
        database,
        realmId: realm.id,
        token: token.data.accessToken,
      }).success,
    ).toBe(true)
    expect(machineCredentialAuthenticate({ database, realmId: realm.id, token: token.data.accessToken }).success).toBe(
      false,
    )

    const secretless = machineUserCreate({
      context: realmSystemContextCreate(),
      database,
      input: { displayName: "Secretless", scopes: ["api.read"], userName: "secretless" },
      realmId: realm.id,
    })
    expect(secretless.success).toBe(true)
    if (!secretless.success) return
    const secretlessCredential = database.db
      .select()
      .from(machineCredentialTable)
      .all()
      .find(
        (credential) =>
          credential.kind === "client_secret" && credential.machineUserId === secretless.data.machineUser.id,
      )
    expect(secretlessCredential).toBeDefined()
    if (secretlessCredential === undefined) return
    expect(
      machineCredentialRevoke({
        context: realmSystemContextCreate(),
        credentialId: secretlessCredential.id,
        database,
        realmId: realm.id,
      }).success,
    ).toBe(true)
    expect(
      machineClientCredentialsIssue({
        database,
        input: { clientId: "secretless", clientSecret: secretless.data.clientSecret },
        realmId: realm.id,
      }).success,
    ).toBe(false)

    const personal = machinePersonalAccessTokenCreate({
      context: realmSystemContextCreate(),
      database,
      input: {
        expiresAt: testkit.runtime.now() + 1_000,
        machineUserId: created.data.machineUser.id,
        name: "deploy",
        scopes: ["api.write"],
      },
      realmId: realm.id,
    })
    expect(personal.success).toBe(true)
    if (!personal.success) return
    expect(machineCredentialAuthenticate({ database, realmId: realm.id, token: personal.data.secret }).success).toBe(
      true,
    )
    testkit.advance(1_001)
    expect(machineCredentialAuthenticate({ database, realmId: realm.id, token: personal.data.secret }).success).toBe(
      false,
    )

    const apiKey = machineApiKeyCreate({
      context: realmSystemContextCreate(),
      database,
      input: { machineUserId: created.data.machineUser.id, name: "service", scopes: ["api.read"] },
      realmId: realm.id,
    })
    expect(apiKey.success).toBe(true)
    if (!apiKey.success) return
    const revoked = machineCredentialRevoke({
      context: realmSystemContextCreate(),
      credentialId: apiKey.data.credential.id,
      database,
      realmId: realm.id,
    })
    expect(revoked.success).toBe(true)
    expect(machineCredentialAuthenticate({ database, realmId: realm.id, token: apiKey.data.secret }).success).toBe(
      false,
    )
    expect(
      machineCredentialRevoke({
        context: realmSystemContextCreate(),
        credentialId: apiKey.data.credential.id,
        database,
        realmId: realm.id,
      }).success,
    ).toBe(false)

    const rotated = machineUserClientSecretRotate({
      context: realmSystemContextCreate(),
      database,
      realmId: realm.id,
      machineUserId: created.data.machineUser.id,
    })
    expect(rotated.success).toBe(true)
    if (!rotated.success) return
    expect(
      machineClientCredentialsIssue({
        database,
        input: { clientId: "worker", clientSecret: created.data.clientSecret },
        realmId: realm.id,
      }).success,
    ).toBe(false)
    expect(
      machineClientCredentialsIssue({
        database,
        input: { clientId: "worker", clientSecret: rotated.data.clientSecret },
        realmId: realm.id,
      }).success,
    ).toBe(true)
    expect(
      machineUserLifecycleSet({
        context: realmSystemContextCreate(),
        database,
        input: { status: "inactive" },
        realmId: realm.id,
        machineUserId: created.data.machineUser.id,
      }).success,
    ).toBe(true)
    expect(
      machineClientCredentialsIssue({
        database,
        input: { clientId: "worker", clientSecret: rotated.data.clientSecret },
        realmId: realm.id,
      }).success,
    ).toBe(false)
  })
})

test("machine users isolate tenants, protected APIs accept issued credentials, and OAuth client credentials work", async () => {
  await withDatabase(async (database) => {
    const alpha = await createRealm(database, "alpha-machine.example.com")
    const beta = await createRealm(database, "beta-machine.example.com")
    const created = machineUserCreate({
      context: realmSystemContextCreate(),
      database,
      input: { displayName: "Alpha", scopes: ["api.read"], userName: "alpha" },
      realmId: alpha.id,
    })
    expect(created.success).toBe(true)
    if (!created.success) return
    const betaUsers = machineUserList({ context: realmSystemContextCreate(), database, realmId: beta.id })
    expect(betaUsers.success).toBe(true)
    if (betaUsers.success) expect(betaUsers.data.items).toHaveLength(0)
    expect(
      machineUserGet({
        context: realmSystemContextCreate(),
        database,
        realmId: beta.id,
        machineUserId: created.data.machineUser.id,
      }).success,
    ).toBe(false)
    expect(
      machineUserList({ context: realmTenantContextCreate(alpha.id, "actor"), database, realmId: beta.id }).success,
    ).toBe(false)

    const managementApp = machineUserServerAppCreate({ database, systemSecret: "system" })
    const client = machineUserApiClientCreate({
      baseUrl: `https://${alpha.domain}`,
      fetch: async (input, init) => managementApp.request(input, init),
      token: "system",
    })
    const managed = await client.machineUserCreate(alpha.id, {
      displayName: "Managed",
      scopes: ["api.read"],
      userName: "managed",
    })
    expect(managed.success).toBe(true)
    const listed = await client.machineUserList(alpha.id)
    expect(listed.success).toBe(true)
    if (listed.success) expect(listed.data.items).toHaveLength(2)

    const apiKey = machineApiKeyCreate({
      context: realmSystemContextCreate(),
      database,
      input: { machineUserId: created.data.machineUser.id, name: "protected", scopes: ["api.read"] },
      realmId: alpha.id,
    })
    expect(apiKey.success).toBe(true)
    if (!apiKey.success) return
    const protectedApp = machineUserServerAppCreate({ database })
    const protectedResponse = await protectedApp.request(`/realms/${alpha.id}/protected-api`, {
      headers: { authorization: `Bearer ${apiKey.data.secret}` },
    })
    expect(protectedResponse.status).toBe(200)
    const wrongTenant = await protectedApp.request(`/realms/${beta.id}/protected-api`, {
      headers: { authorization: `Bearer ${apiKey.data.secret}` },
    })
    expect(wrongTenant.status).toBe(401)

    const oidcApp = oidcServerAppCreate({ database })
    const alphaDiscovery = await oidcApp.request(`https://${alpha.domain}/.well-known/openid-configuration`, {
      headers: { host: alpha.domain },
    })
    const alphaDiscoveryBody = v.parse(oidcDiscoverySchema, await alphaDiscovery.json())
    expect(alphaDiscoveryBody.grant_types_supported).toContain("client_credentials")
    const betaDiscovery = await oidcApp.request(`https://${beta.domain}/.well-known/openid-configuration`, {
      headers: { host: beta.domain },
    })
    const betaDiscoveryBody = v.parse(oidcDiscoverySchema, await betaDiscovery.json())
    expect(betaDiscoveryBody.grant_types_supported).not.toContain("client_credentials")
    const oauthResponse = await oidcApp.request(`https://${alpha.domain}/oauth2/token`, {
      body: new URLSearchParams({
        client_id: "alpha",
        client_secret: created.data.clientSecret,
        grant_type: "client_credentials",
        scope: "api.read",
      }),
      headers: { "content-type": "application/x-www-form-urlencoded", host: alpha.domain },
      method: "POST",
    })
    expect(oauthResponse.status).toBe(200)
    const oauth = v.parse(oidcTokenResponseSchema, await oauthResponse.json())
    expect(oauth.access_token).toHaveLength(43)
    expect(oauth.id_token).toBeUndefined()
    expect(
      (
        await protectedApp.request(`/realms/${alpha.id}/protected-api`, {
          headers: { authorization: `Bearer ${oauth.access_token}` },
        })
      ).status,
    ).toBe(200)
  })
})

test("machine user state and events roll back together when event append fails", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "atomic-machine.example.com")
    const beforeUsers = database.db.select().from(machineUserTable).all().length
    const beforeCredentials = database.db.select().from(machineCredentialTable).all().length
    const beforeEvents = database.db.select().from(storageEventTable).all().length
    const result = machineUserCreate({
      context: realmSystemContextCreate(),
      correlationId: "",
      database,
      input: { displayName: "Atomic", userName: "atomic" },
      realmId: realm.id,
    })
    expect(result.success).toBe(false)
    expect(database.db.select().from(machineUserTable).all()).toHaveLength(beforeUsers)
    expect(database.db.select().from(machineCredentialTable).all()).toHaveLength(beforeCredentials)
    expect(database.db.select().from(storageEventTable).all()).toHaveLength(beforeEvents)
  })
})

test("machine API client validates public contracts and requests", async () => {
  const calls: { url: string }[] = []
  const client = machineUserApiClientCreate({
    baseUrl: "https://example.com",
    fetch: async (input, init) => {
      calls.push({ url: input instanceof Request ? input.url : input.toString() })
      return Response.json({ items: [] })
    },
  })
  const result = await client.machineUserList("01900000-0000-7000-8000-000000000000")
  expect(result.success).toBe(true)
  expect(calls[0]?.url).toContain("/system/realms/01900000-0000-7000-8000-000000000000/machine-users")
})

test("machine user CLI exposes management commands", async () => {
  const helpProcess = Bun.spawn(["bun", "src/outputs/cli.ts", "machine-users", "--help"], {
    stderr: "pipe",
    stdout: "pipe",
  })
  const [exitCode, stdout, stderr] = await Promise.all([
    helpProcess.exited,
    new Response(helpProcess.stdout).text(),
    new Response(helpProcess.stderr).text(),
  ])
  expect(exitCode).toBe(0)
  expect(stderr).toBe("")
  expect(stdout).toContain("personal-access-token-create")
  expect(stdout).toContain("secret-rotate")
})
