import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { realmBootstrapAdminAuthenticate } from "../../src/features/realms/actions/realmBootstrapAdminAuthenticate.js"
import { realmBootstrapAdminCreate } from "../../src/features/realms/actions/realmBootstrapAdminCreate.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmGet } from "../../src/features/realms/actions/realmGet.js"
import { realmTenantContextResolve } from "../../src/features/realms/actions/realmTenantContextResolve.js"
import { realmUpdate } from "../../src/features/realms/actions/realmUpdate.js"
import { realmApiClientCreate } from "../../src/features/realms/client/realmApiClientCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../src/features/realms/domain/realmTenantContextCreate.js"
import { realmEventTypes } from "../../src/features/realms/events/realmEventTypes.js"
import { realmServerAppCreate } from "../../src/features/realms/server/realmServerAppCreate.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageEventTable } from "../../src/platform/storage/storageEventTable.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

async function withDatabase<T>(operation: (database: StorageDatabase) => Promise<T>) {
  const directory = await mkdtemp(join(tmpdir(), "zitadel-v2-realms-"))
  const path = join(directory, "zitadel.sqlite")
  const testkit = platformTestkitCreate()
  const opened = storageDatabaseOpen(path, testkit.runtime)
  expect(opened.success).toBe(true)
  if (!opened.success) {
    await rm(directory, { force: true, recursive: true })
    throw new Error(opened.errorMessage)
  }
  try {
    return await operation(opened.data)
  } finally {
    opened.data.close()
    await rm(directory, { force: true, recursive: true })
  }
}

test("realms are created with canonical IDs, defaults, safe events, and one-time bootstrap administration", async () => {
  await withDatabase(async (database) => {
    const context = realmSystemContextCreate("test-system")
    const created = realmCreate({
      context,
      database,
      input: { domain: "alpha.example.com", name: " Alpha " },
    })
    expect(created.success).toBe(true)
    if (!created.success) return
    expect(created.data.realm.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(created.data.realm.status).toBe("active")
    expect(created.data.realm.name).toBe("Alpha")
    expect(created.data.realm.domains).toEqual(["alpha.example.com"])

    const bootstrap = realmBootstrapAdminCreate({ context, database, realmId: created.data.realm.id })
    expect(bootstrap.success).toBe(true)
    if (!bootstrap.success) return
    expect(bootstrap.data.bootstrapAdmin.secret.valueGet()).toHaveLength(43)
    expect(JSON.stringify(bootstrap.data)).toContain("[REDACTED]")

    const replay = realmBootstrapAdminCreate({ context, database, realmId: created.data.realm.id })
    expect(replay).toEqual({
      errorMessage: "The bootstrap administrator already exists.",
      op: "realmBootstrapAdminCreate",
      success: false,
    })

    const events = database.db.select().from(storageEventTable).all()
    expect(events.map((event) => event.eventType)).toEqual([
      realmEventTypes.created,
      realmEventTypes.bootstrapAdminCreated,
    ])
    expect(JSON.stringify(events)).not.toContain(bootstrap.data.bootstrapAdmin.secret.valueGet())
    expect(JSON.stringify(events)).toContain(bootstrap.data.bootstrapAdmin.adminId)
  })
})

test("tenant context resolves by host and cannot cross realm boundaries", async () => {
  await withDatabase(async (database) => {
    const context = realmSystemContextCreate()
    const alpha = realmCreate({ context, database, input: { domain: "alpha.example.com", name: "Alpha" } })
    const beta = realmCreate({ context, database, input: { domain: "beta.example.com", name: "Beta" } })
    expect(alpha.success && beta.success).toBe(true)
    if (!alpha.success || !beta.success) return

    const resolved = realmTenantContextResolve({ database, host: "ALPHA.EXAMPLE.COM:443" })
    expect(resolved.success).toBe(true)
    if (!resolved.success) return
    expect(resolved.data.realmId).toBe(alpha.data.realm.id)
    expect(realmGet({ context: resolved.data, database, realmId: alpha.data.realm.id }).success).toBe(true)
    expect(realmGet({ context: resolved.data, database, realmId: beta.data.realm.id })).toEqual({
      errorMessage: "The realm is not available in this tenant context.",
      op: "realmGet",
      success: false,
    })
    expect(
      realmUpdate({
        context: resolved.data,
        database,
        input: { name: "forged" },
        realmId: beta.data.realm.id,
      }).success,
    ).toBe(false)
    expect(realmTenantContextResolve({ database, host: "unknown.example.com" }).success).toBe(false)
    expect(realmGet({ context: undefined as never, database, realmId: alpha.data.realm.id }).success).toBe(false)
  })
})

test("bootstrap credentials authenticate only their resolved tenant", async () => {
  await withDatabase(async (database) => {
    const system = realmSystemContextCreate()
    const alpha = realmCreate({ context: system, database, input: { domain: "alpha.example.com", name: "Alpha" } })
    const beta = realmCreate({ context: system, database, input: { domain: "beta.example.com", name: "Beta" } })
    expect(alpha.success && beta.success).toBe(true)
    if (!alpha.success || !beta.success) return
    const bootstrap = realmBootstrapAdminCreate({ context: system, database, realmId: alpha.data.realm.id })
    expect(bootstrap.success).toBe(true)
    if (!bootstrap.success) return
    const tenant = realmTenantContextCreate(alpha.data.realm.id, "anonymous")
    const authenticated = realmBootstrapAdminAuthenticate({
      context: tenant,
      database,
      secret: bootstrap.data.bootstrapAdmin.secret.valueGet(),
    })
    expect(authenticated.success).toBe(true)
    if (!authenticated.success) return
    expect(authenticated.data).toMatchObject({
      actor: {
        actorId: bootstrap.data.bootstrapAdmin.adminId,
        assurance: "authenticated",
        authenticationMethod: "bootstrap_admin",
        realmId: alpha.data.realm.id,
        kind: "bootstrap_admin",
      },
      actorId: bootstrap.data.bootstrapAdmin.adminId,
      realmId: alpha.data.realm.id,
      kind: "tenant",
    })
    expect(
      realmBootstrapAdminAuthenticate({
        context: tenant,
        database,
        secret: `${bootstrap.data.bootstrapAdmin.secret.valueGet()}-wrong`,
      }),
    ).toEqual({
      errorMessage: "The bootstrap administrator credentials are invalid.",
      op: "realmBootstrapAdminAuthenticate",
      success: false,
    })
    expect(
      realmBootstrapAdminAuthenticate({
        context: realmTenantContextCreate(beta.data.realm.id, "anonymous"),
        database,
        secret: bootstrap.data.bootstrapAdmin.secret.valueGet(),
      }).success,
    ).toBe(false)
  })
})

test("realm domain updates preserve and replace secondary domains without partial state", async () => {
  await withDatabase(async (database) => {
    const context = realmSystemContextCreate()
    const created = realmCreate({
      context,
      database,
      input: {
        domain: " Alpha.Example.com. ",
        domains: [" API.Example.com. "],
        name: "Alpha",
      },
    })
    expect(created.success).toBe(true)
    if (!created.success) return
    expect(created.data.realm.domains).toEqual(["alpha.example.com", "api.example.com"])

    const changedPrimary = realmUpdate({
      context,
      database,
      input: { domain: "New.Example.com.", status: "disabled" },
      realmId: created.data.realm.id,
    })
    expect(changedPrimary.success).toBe(true)
    if (!changedPrimary.success) return
    expect(changedPrimary.data.realm.domain).toBe("new.example.com")
    expect(changedPrimary.data.realm.domains).toEqual(["new.example.com", "api.example.com"])
    expect(changedPrimary.data.realm.status).toBe("disabled")

    const clearedSecondary = realmUpdate({
      context,
      database,
      input: { domains: [], status: "active" },
      realmId: created.data.realm.id,
    })
    expect(clearedSecondary.success).toBe(true)
    if (!clearedSecondary.success) return
    expect(clearedSecondary.data.realm.domains).toEqual(["new.example.com"])
    expect(clearedSecondary.data.realm.status).toBe("active")
    expect(database.db.select().from(storageEventTable).all()).toHaveLength(3)
  })
})

test("concurrent bootstrap attempts have one winner", async () => {
  await withDatabase(async (database) => {
    const context = realmSystemContextCreate()
    const realm = realmCreate({
      context,
      database,
      input: { domain: "concurrent.example.com", name: "Concurrent" },
    })
    expect(realm.success).toBe(true)
    if (!realm.success) return
    const attempts = await Promise.all([
      Promise.resolve(realmBootstrapAdminCreate({ context, database, realmId: realm.data.realm.id })),
      Promise.resolve(realmBootstrapAdminCreate({ context, database, realmId: realm.data.realm.id })),
    ])
    expect(attempts.filter((attempt) => attempt.success)).toHaveLength(1)
    expect(attempts.filter((attempt) => !attempt.success)).toHaveLength(1)
  })
})

test("server routes require system authorization and enforce host tenant isolation", async () => {
  await withDatabase(async (database) => {
    const app = realmServerAppCreate({ database, systemSecret: "system-secret" })
    const unauthorized = await app.request("http://server.test/system/realms", { headers: { host: "server.test" } })
    expect(unauthorized.status).toBe(401)

    const createdResponse = await app.request("http://server.test/system/realms", {
      body: JSON.stringify({ domain: "alpha.example.com", name: "Alpha" }),
      headers: { authorization: "Bearer system-secret", "content-type": "application/json" },
      method: "POST",
    })
    expect(createdResponse.status).toBe(201)
    const created = (await createdResponse.json()) as { realm: { id: string } }
    const crossTenant = await app.request(`http://server.test/realms/${created.realm.id}`, {
      headers: { host: "unknown.example.com" },
    })
    expect(crossTenant.status).toBe(404)
    const ownTenant = await app.request(`http://server.test/realms/${created.realm.id}`, {
      headers: { host: "alpha.example.com" },
    })
    expect(ownTenant.status).toBe(200)

    const bootstrapResponse = await app.request(
      `http://server.test/system/realms/${created.realm.id}/bootstrap-admin`,
      {
        headers: { authorization: "Bearer system-secret" },
        method: "POST",
      },
    )
    expect(bootstrapResponse.status).toBe(201)
    const bootstrap = (await bootstrapResponse.json()) as { bootstrapAdmin: { secret: string } }
    expect(bootstrap.bootstrapAdmin.secret).toHaveLength(43)
    expect(JSON.stringify(bootstrap)).not.toContain("[REDACTED]")

    const tenantUpdate = await app.request(`http://server.test/realms/${created.realm.id}`, {
      body: JSON.stringify({ name: "Alpha Updated" }),
      headers: {
        authorization: `Bearer ${bootstrap.bootstrapAdmin.secret}`,
        host: "alpha.example.com",
        "content-type": "application/json",
      },
      method: "PATCH",
    })
    expect(tenantUpdate.status).toBe(200)

    const client = realmApiClientCreate({
      baseUrl: "http://server.test",
      fetch: async (input, init) => app.request(input.toString(), init),
      token: "system-secret",
    })
    const listed = await client.realmList()
    expect(listed.success).toBe(true)
    const secondResponse = await app.request("http://server.test/system/realms", {
      body: JSON.stringify({ domain: "beta.example.com", name: "Beta" }),
      headers: { authorization: "Bearer system-secret", "content-type": "application/json" },
      method: "POST",
    })
    const second = (await secondResponse.json()) as { realm: { id: string } }
    const clientBootstrap = await client.realmBootstrapAdminCreate(second.realm.id)
    expect(clientBootstrap.success).toBe(true)
    if (clientBootstrap.success) expect(clientBootstrap.data.bootstrapAdmin.secret).toHaveLength(43)
    const unauthorizedClient = realmApiClientCreate({
      baseUrl: "http://server.test",
      fetch: async (input, init) => app.request(input.toString(), init),
    })
    expect((await unauthorizedClient.realmList()).success).toBe(false)
    const malformedClient = realmApiClientCreate({
      baseUrl: "http://server.test",
      fetch: async () => new Response("not-json", { status: 200 }),
      token: "system-secret",
    })
    expect((await malformedClient.realmList()).success).toBe(false)
  })
})

test("realm validation and authorization failures do not write state or events", async () => {
  await withDatabase(async (database) => {
    const system = realmSystemContextCreate()
    expect(
      realmCreate({
        context: realmTenantContextCreate("forged", "actor"),
        database,
        input: { domain: "x.example.com", name: "X" },
      }).success,
    ).toBe(false)
    expect(realmCreate({ context: system, database, input: { domain: "bad domain", name: "X" } }).success).toBe(false)
    const first = realmCreate({ context: system, database, input: { domain: "same.example.com", name: "First" } })
    expect(first.success).toBe(true)
    expect(
      realmCreate({ context: system, database, input: { domain: "SAME.example.com", name: "Duplicate" } }).success,
    ).toBe(false)
    expect(
      realmCreate({
        context: system,
        database,
        input: {
          domain: "another.example.com",
          domains: ["EXTRA.example.com", "extra.example.com"],
          name: "Duplicate",
        },
      }),
    ).toEqual({
      errorMessage: "Realm domains must be unique.",
      op: "realmCreate",
      success: false,
    })
    expect(database.db.select().from(storageEventTable).all()).toHaveLength(1)
  })
})

test("CLI exposes realm administration without opening SQLite", async () => {
  const helpProcess = Bun.spawn(["bun", "src/outputs/cli.ts", "realms", "--help"], {
    stderr: "pipe",
    stdout: "pipe",
  })
  const helpOutput = await new Response(helpProcess.stdout).text()
  expect(await helpProcess.exited).toBe(0)
  expect(helpOutput).toContain("Realm administration")

  const invalidProcess = Bun.spawn(["bun", "src/outputs/cli.ts", "realms", "create", "--domain", "alpha.example.com"], {
    stderr: "pipe",
    stdout: "pipe",
  })
  expect(await invalidProcess.exited).not.toBe(0)
})
