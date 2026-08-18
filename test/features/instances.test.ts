import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { instanceBootstrapAdminAuthenticate } from "../../src/features/instances/actions/instanceBootstrapAdminAuthenticate.js"
import { instanceBootstrapAdminCreate } from "../../src/features/instances/actions/instanceBootstrapAdminCreate.js"
import { instanceCreate } from "../../src/features/instances/actions/instanceCreate.js"
import { instanceGet } from "../../src/features/instances/actions/instanceGet.js"
import { instanceTenantContextResolve } from "../../src/features/instances/actions/instanceTenantContextResolve.js"
import { instanceUpdate } from "../../src/features/instances/actions/instanceUpdate.js"
import { instanceApiClientCreate } from "../../src/features/instances/client/instanceApiClientCreate.js"
import { instanceSystemContextCreate } from "../../src/features/instances/domain/instanceSystemContextCreate.js"
import { instanceTenantContextCreate } from "../../src/features/instances/domain/instanceTenantContextCreate.js"
import { instanceEventTypes } from "../../src/features/instances/events/instanceEventTypes.js"
import { instanceServerAppCreate } from "../../src/features/instances/server/instanceServerAppCreate.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageEventTable } from "../../src/platform/storage/storageEventTable.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

async function withDatabase<T>(operation: (database: StorageDatabase) => Promise<T>) {
  const directory = await mkdtemp(join(tmpdir(), "zitadel-v2-instances-"))
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

test("instances are created with canonical IDs, defaults, safe events, and one-time bootstrap administration", async () => {
  await withDatabase(async (database) => {
    const context = instanceSystemContextCreate("test-system")
    const created = instanceCreate({
      context,
      database,
      input: { domain: "alpha.example.com", name: " Alpha " },
    })
    expect(created.success).toBe(true)
    if (!created.success) return
    expect(created.data.instance.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(created.data.instance.status).toBe("active")
    expect(created.data.instance.name).toBe("Alpha")
    expect(created.data.instance.domains).toEqual(["alpha.example.com"])

    const bootstrap = instanceBootstrapAdminCreate({ context, database, instanceId: created.data.instance.id })
    expect(bootstrap.success).toBe(true)
    if (!bootstrap.success) return
    expect(bootstrap.data.bootstrapAdmin.secret.valueGet()).toHaveLength(43)
    expect(JSON.stringify(bootstrap.data)).toContain("[REDACTED]")

    const replay = instanceBootstrapAdminCreate({ context, database, instanceId: created.data.instance.id })
    expect(replay).toEqual({
      errorMessage: "The bootstrap administrator already exists.",
      op: "instanceBootstrapAdminCreate",
      success: false,
    })

    const events = database.db.select().from(storageEventTable).all()
    expect(events.map((event) => event.eventType)).toEqual([
      instanceEventTypes.created,
      instanceEventTypes.bootstrapAdminCreated,
    ])
    expect(JSON.stringify(events)).not.toContain(bootstrap.data.bootstrapAdmin.secret.valueGet())
    expect(JSON.stringify(events)).toContain(bootstrap.data.bootstrapAdmin.adminId)
  })
})

test("tenant context resolves by host and cannot cross instance boundaries", async () => {
  await withDatabase(async (database) => {
    const context = instanceSystemContextCreate()
    const alpha = instanceCreate({ context, database, input: { domain: "alpha.example.com", name: "Alpha" } })
    const beta = instanceCreate({ context, database, input: { domain: "beta.example.com", name: "Beta" } })
    expect(alpha.success && beta.success).toBe(true)
    if (!alpha.success || !beta.success) return

    const resolved = instanceTenantContextResolve({ database, host: "ALPHA.EXAMPLE.COM:443" })
    expect(resolved.success).toBe(true)
    if (!resolved.success) return
    expect(resolved.data.instanceId).toBe(alpha.data.instance.id)
    expect(instanceGet({ context: resolved.data, database, instanceId: alpha.data.instance.id }).success).toBe(true)
    expect(instanceGet({ context: resolved.data, database, instanceId: beta.data.instance.id })).toEqual({
      errorMessage: "The instance is not available in this tenant context.",
      op: "instanceGet",
      success: false,
    })
    expect(
      instanceUpdate({
        context: resolved.data,
        database,
        input: { name: "forged" },
        instanceId: beta.data.instance.id,
      }).success,
    ).toBe(false)
    expect(instanceTenantContextResolve({ database, host: "unknown.example.com" }).success).toBe(false)
    expect(instanceGet({ context: undefined as never, database, instanceId: alpha.data.instance.id }).success).toBe(
      false,
    )
  })
})

test("bootstrap credentials authenticate only their resolved tenant", async () => {
  await withDatabase(async (database) => {
    const system = instanceSystemContextCreate()
    const alpha = instanceCreate({ context: system, database, input: { domain: "alpha.example.com", name: "Alpha" } })
    const beta = instanceCreate({ context: system, database, input: { domain: "beta.example.com", name: "Beta" } })
    expect(alpha.success && beta.success).toBe(true)
    if (!alpha.success || !beta.success) return
    const bootstrap = instanceBootstrapAdminCreate({ context: system, database, instanceId: alpha.data.instance.id })
    expect(bootstrap.success).toBe(true)
    if (!bootstrap.success) return
    const tenant = instanceTenantContextCreate(alpha.data.instance.id, "anonymous")
    const authenticated = instanceBootstrapAdminAuthenticate({
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
        instanceId: alpha.data.instance.id,
        kind: "bootstrap_admin",
      },
      actorId: bootstrap.data.bootstrapAdmin.adminId,
      instanceId: alpha.data.instance.id,
      kind: "tenant",
    })
    expect(
      instanceBootstrapAdminAuthenticate({
        context: tenant,
        database,
        secret: `${bootstrap.data.bootstrapAdmin.secret.valueGet()}-wrong`,
      }),
    ).toEqual({
      errorMessage: "The bootstrap administrator credentials are invalid.",
      op: "instanceBootstrapAdminAuthenticate",
      success: false,
    })
    expect(
      instanceBootstrapAdminAuthenticate({
        context: instanceTenantContextCreate(beta.data.instance.id, "anonymous"),
        database,
        secret: bootstrap.data.bootstrapAdmin.secret.valueGet(),
      }).success,
    ).toBe(false)
  })
})

test("instance domain updates preserve and replace secondary domains without partial state", async () => {
  await withDatabase(async (database) => {
    const context = instanceSystemContextCreate()
    const created = instanceCreate({
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
    expect(created.data.instance.domains).toEqual(["alpha.example.com", "api.example.com"])

    const changedPrimary = instanceUpdate({
      context,
      database,
      input: { domain: "New.Example.com.", status: "disabled" },
      instanceId: created.data.instance.id,
    })
    expect(changedPrimary.success).toBe(true)
    if (!changedPrimary.success) return
    expect(changedPrimary.data.instance.domain).toBe("new.example.com")
    expect(changedPrimary.data.instance.domains).toEqual(["new.example.com", "api.example.com"])
    expect(changedPrimary.data.instance.status).toBe("disabled")

    const clearedSecondary = instanceUpdate({
      context,
      database,
      input: { domains: [], status: "active" },
      instanceId: created.data.instance.id,
    })
    expect(clearedSecondary.success).toBe(true)
    if (!clearedSecondary.success) return
    expect(clearedSecondary.data.instance.domains).toEqual(["new.example.com"])
    expect(clearedSecondary.data.instance.status).toBe("active")
    expect(database.db.select().from(storageEventTable).all()).toHaveLength(3)
  })
})

test("concurrent bootstrap attempts have one winner", async () => {
  await withDatabase(async (database) => {
    const context = instanceSystemContextCreate()
    const instance = instanceCreate({
      context,
      database,
      input: { domain: "concurrent.example.com", name: "Concurrent" },
    })
    expect(instance.success).toBe(true)
    if (!instance.success) return
    const attempts = await Promise.all([
      Promise.resolve(instanceBootstrapAdminCreate({ context, database, instanceId: instance.data.instance.id })),
      Promise.resolve(instanceBootstrapAdminCreate({ context, database, instanceId: instance.data.instance.id })),
    ])
    expect(attempts.filter((attempt) => attempt.success)).toHaveLength(1)
    expect(attempts.filter((attempt) => !attempt.success)).toHaveLength(1)
  })
})

test("server routes require system authorization and enforce host tenant isolation", async () => {
  await withDatabase(async (database) => {
    const app = instanceServerAppCreate({ database, systemSecret: "system-secret" })
    const unauthorized = await app.request("http://server.test/system/instances", { headers: { host: "server.test" } })
    expect(unauthorized.status).toBe(401)

    const createdResponse = await app.request("http://server.test/system/instances", {
      body: JSON.stringify({ domain: "alpha.example.com", name: "Alpha" }),
      headers: { authorization: "Bearer system-secret", "content-type": "application/json" },
      method: "POST",
    })
    expect(createdResponse.status).toBe(201)
    const created = (await createdResponse.json()) as { instance: { id: string } }
    const crossTenant = await app.request(`http://server.test/instances/${created.instance.id}`, {
      headers: { host: "unknown.example.com" },
    })
    expect(crossTenant.status).toBe(404)
    const ownTenant = await app.request(`http://server.test/instances/${created.instance.id}`, {
      headers: { host: "alpha.example.com" },
    })
    expect(ownTenant.status).toBe(200)

    const bootstrapResponse = await app.request(
      `http://server.test/system/instances/${created.instance.id}/bootstrap-admin`,
      {
        headers: { authorization: "Bearer system-secret" },
        method: "POST",
      },
    )
    expect(bootstrapResponse.status).toBe(201)
    const bootstrap = (await bootstrapResponse.json()) as { bootstrapAdmin: { secret: string } }
    expect(bootstrap.bootstrapAdmin.secret).toHaveLength(43)
    expect(JSON.stringify(bootstrap)).not.toContain("[REDACTED]")

    const tenantUpdate = await app.request(`http://server.test/instances/${created.instance.id}`, {
      body: JSON.stringify({ name: "Alpha Updated" }),
      headers: {
        authorization: `Bearer ${bootstrap.bootstrapAdmin.secret}`,
        host: "alpha.example.com",
        "content-type": "application/json",
      },
      method: "PATCH",
    })
    expect(tenantUpdate.status).toBe(200)

    const client = instanceApiClientCreate({
      baseUrl: "http://server.test",
      fetch: async (input, init) => app.request(input.toString(), init),
      token: "system-secret",
    })
    const listed = await client.instanceList()
    expect(listed.success).toBe(true)
    const secondResponse = await app.request("http://server.test/system/instances", {
      body: JSON.stringify({ domain: "beta.example.com", name: "Beta" }),
      headers: { authorization: "Bearer system-secret", "content-type": "application/json" },
      method: "POST",
    })
    const second = (await secondResponse.json()) as { instance: { id: string } }
    const clientBootstrap = await client.instanceBootstrapAdminCreate(second.instance.id)
    expect(clientBootstrap.success).toBe(true)
    if (clientBootstrap.success) expect(clientBootstrap.data.bootstrapAdmin.secret).toHaveLength(43)
    const unauthorizedClient = instanceApiClientCreate({
      baseUrl: "http://server.test",
      fetch: async (input, init) => app.request(input.toString(), init),
    })
    expect((await unauthorizedClient.instanceList()).success).toBe(false)
    const malformedClient = instanceApiClientCreate({
      baseUrl: "http://server.test",
      fetch: async () => new Response("not-json", { status: 200 }),
      token: "system-secret",
    })
    expect((await malformedClient.instanceList()).success).toBe(false)
  })
})

test("instance validation and authorization failures do not write state or events", async () => {
  await withDatabase(async (database) => {
    const system = instanceSystemContextCreate()
    expect(
      instanceCreate({
        context: instanceTenantContextCreate("forged", "actor"),
        database,
        input: { domain: "x.example.com", name: "X" },
      }).success,
    ).toBe(false)
    expect(instanceCreate({ context: system, database, input: { domain: "bad domain", name: "X" } }).success).toBe(
      false,
    )
    const first = instanceCreate({ context: system, database, input: { domain: "same.example.com", name: "First" } })
    expect(first.success).toBe(true)
    expect(
      instanceCreate({ context: system, database, input: { domain: "SAME.example.com", name: "Duplicate" } }).success,
    ).toBe(false)
    expect(
      instanceCreate({
        context: system,
        database,
        input: {
          domain: "another.example.com",
          domains: ["EXTRA.example.com", "extra.example.com"],
          name: "Duplicate",
        },
      }),
    ).toEqual({
      errorMessage: "Instance domains must be unique.",
      op: "instanceCreate",
      success: false,
    })
    expect(database.db.select().from(storageEventTable).all()).toHaveLength(1)
  })
})

test("CLI exposes instance administration without opening SQLite", async () => {
  const helpProcess = Bun.spawn(["bun", "src/outputs/cli.ts", "instances", "--help"], {
    stderr: "pipe",
    stdout: "pipe",
  })
  const helpOutput = await new Response(helpProcess.stdout).text()
  expect(await helpProcess.exited).toBe(0)
  expect(helpOutput).toContain("Instance administration")

  const invalidProcess = Bun.spawn(
    ["bun", "src/outputs/cli.ts", "instances", "create", "--domain", "alpha.example.com"],
    {
      stderr: "pipe",
      stdout: "pipe",
    },
  )
  expect(await invalidProcess.exited).not.toBe(0)
})
