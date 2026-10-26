import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { machineApiKeyCreate } from "../../src/features/machineUsers/actions/machineApiKeyCreate.js"
import { machineUserCreate } from "../../src/features/machineUsers/actions/machineUserCreate.js"
import { mcpHttpHandlerCreate } from "../../src/features/mcp/mcpHttpHandler.js"
import { organizationCreate } from "../../src/features/organizations/actions/organizationCreate.js"
import { realmAdministratorGrant } from "../../src/features/realms/actions/realmAdministratorGrant.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../src/features/realms/domain/realmTenantContextCreate.js"
import { sessionIssue } from "../../src/features/sessions/actions/sessionIssue.js"
import { userCreate } from "../../src/features/users/actions/userCreate.js"
import { userLifecycleSet } from "../../src/features/users/actions/userLifecycleSet.js"
import { userMetadataGet } from "../../src/features/users/actions/userMetadataGet.js"
import { userMetadataList } from "../../src/features/users/actions/userMetadataList.js"
import { userMetadataRemove } from "../../src/features/users/actions/userMetadataRemove.js"
import { userMetadataSet } from "../../src/features/users/actions/userMetadataSet.js"
import { userApiClientCreate } from "../../src/features/users/client/userApiClientCreate.js"
import { userServerAppCreate } from "../../src/features/users/server/userServerAppCreate.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageEventTable } from "../../src/platform/storage/storageEventTable.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

async function withDatabase<T>(operation: (database: StorageDatabase) => Promise<T>): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), "authworks-user-metadata-"))
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

async function createRealm(database: StorageDatabase, domain: string) {
  const created = realmCreate({
    context: realmSystemContextCreate("system"),
    database,
    input: { domain, name: domain },
  })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  return created.data.realm
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
  return created.data.user
}

test("user metadata set/get/list/remove round-trips", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "user-meta.example.com")
    const user = await createActiveUser(database, realm.id, "subject@example.com")
    const system = realmSystemContextCreate("system")

    const first = userMetadataSet({
      context: system,
      database,
      input: { value: "one" },
      key: "profile.tag",
      realmId: realm.id,
      userId: user.id,
    })
    expect(first.success).toBe(true)
    if (!first.success) return
    expect(first.data.metadata).toMatchObject({ key: "profile.tag", value: "one", version: 1 })

    const second = userMetadataSet({
      context: system,
      database,
      input: { value: "two" },
      key: "profile:level",
      realmId: realm.id,
      userId: user.id,
    })
    expect(second.success).toBe(true)

    expect(
      userMetadataGet({ context: system, database, key: "profile.tag", realmId: realm.id, userId: user.id }),
    ).toMatchObject({ success: true, data: { metadata: { key: "profile.tag", value: "one" } } })

    const listed = userMetadataList({ context: system, database, realmId: realm.id, userId: user.id })
    expect(listed.success).toBe(true)
    if (!listed.success) return
    expect(listed.data.items.map((entry) => entry.key).sort()).toEqual(["profile.tag", "profile:level"])

    const prefixed = userMetadataList({
      context: system,
      database,
      query: { keyPrefix: "profile." },
      realmId: realm.id,
      userId: user.id,
    })
    expect(prefixed).toMatchObject({ success: true, data: { items: [{ key: "profile.tag" }] } })

    expect(
      userMetadataRemove({ context: system, database, key: "profile.tag", realmId: realm.id, userId: user.id }),
    ).toMatchObject({ success: true, data: { removed: true } })
    expect(
      userMetadataGet({ context: system, database, key: "profile.tag", realmId: realm.id, userId: user.id }),
    ).toMatchObject({ code: "users.not-found", success: false })
  })
})

test("user metadata rejects the 51st new key but allows updates", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "user-meta-cap.example.com")
    const user = await createActiveUser(database, realm.id, "capped@example.com")
    const system = realmSystemContextCreate("system")

    for (let index = 0; index < 50; index += 1) {
      const saved = userMetadataSet({
        context: system,
        database,
        input: { value: `value-${index}` },
        key: `key-${index}`,
        realmId: realm.id,
        userId: user.id,
      })
      expect(saved.success).toBe(true)
    }
    expect(
      userMetadataSet({
        context: system,
        database,
        input: { value: "overflow" },
        key: "key-overflow",
        realmId: realm.id,
        userId: user.id,
      }),
    ).toMatchObject({ code: "users.metadata-limit", success: false })
    expect(
      userMetadataSet({
        context: system,
        database,
        input: { value: "updated" },
        key: "key-0",
        realmId: realm.id,
        userId: user.id,
      }),
    ).toMatchObject({ success: true, data: { metadata: { value: "updated", version: 2 } } })
  })
})

test("user metadata validates keys and values", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "user-meta-valid.example.com")
    const user = await createActiveUser(database, realm.id, "valid@example.com")
    const system = realmSystemContextCreate("system")

    for (const key of ["", "has space", "has/slash", `k${"a".repeat(128)}`]) {
      expect(
        userMetadataSet({
          context: system,
          database,
          input: { value: "value" },
          key,
          realmId: realm.id,
          userId: user.id,
        }),
      ).toMatchObject({ code: "users.invalid", success: false })
    }
    expect(
      userMetadataSet({
        context: system,
        database,
        input: { value: "x".repeat(4097) },
        key: "valid.key",
        realmId: realm.id,
        userId: user.id,
      }),
    ).toMatchObject({ code: "users.invalid", success: false })
    expect(
      userMetadataGet({ context: system, database, key: "bad key", realmId: realm.id, userId: user.id }),
    ).toMatchObject({ code: "users.invalid", success: false })
    expect(
      userMetadataRemove({ context: system, database, key: "bad key", realmId: realm.id, userId: user.id }),
    ).toMatchObject({ code: "users.invalid", success: false })
  })
})

test("user metadata reads stay inside one realm and self-read works over the me routes", async () => {
  await withDatabase(async (database) => {
    const alpha = await createRealm(database, "user-meta-a.example.com")
    const beta = await createRealm(database, "user-meta-b.example.com")
    const user = await createActiveUser(database, alpha.id, "owner@example.com")
    const other = await createActiveUser(database, alpha.id, "other@example.com")
    const system = realmSystemContextCreate("system")
    const testkit = platformTestkitCreate()
    const saved = userMetadataSet({
      context: system,
      database,
      input: { value: "self-value" },
      key: "own.key",
      realmId: alpha.id,
      userId: user.id,
    })
    expect(saved.success).toBe(true)

    expect(
      userMetadataGet({
        context: realmTenantContextCreate(beta.id, user.id),
        database,
        key: "own.key",
        realmId: alpha.id,
        userId: user.id,
      }),
    ).toMatchObject({ code: "users.tenant-mismatch", success: false })

    expect(
      userMetadataGet({
        context: realmTenantContextCreate(alpha.id, other.id),
        database,
        key: "own.key",
        realmId: alpha.id,
        userId: user.id,
      }).success,
    ).toBe(false)

    const issued = sessionIssue({
      assurance: "authenticated",
      authenticationMethod: "password",
      database,
      realmId: alpha.id,
      runtime: testkit.runtime,
      userId: user.id,
    })
    expect(issued.success).toBe(true)
    if (!issued.success) return
    const app = userServerAppCreate({ database, publicOrigin: "https://user-meta.example.com" })
    const client = userApiClientCreate({
      baseUrl: "https://server.test",
      fetch: async (input, init) => app.request(input.toString(), init),
      token: issued.data.token,
    })
    const listed = await client.userMeMetadataList(alpha.id)
    expect(listed).toMatchObject({ success: true, data: { items: [{ key: "own.key", value: "self-value" }] } })
    const fetched = await client.userMeMetadataGet(alpha.id, "own.key")
    expect(fetched).toMatchObject({ success: true, data: { metadata: { key: "own.key", value: "self-value" } } })

    const missing = await app.request(`https://server.test/realms/${alpha.id}/me/metadata/${other.id}`, {
      headers: { authorization: `Bearer ${issued.data.token}` },
    })
    expect(missing.status).toBe(404)

    const selfWrite = await app.request(`https://server.test/realms/${alpha.id}/me/metadata/own.key`, {
      body: JSON.stringify({ value: "self-write" }),
      headers: { authorization: `Bearer ${issued.data.token}`, "content-type": "application/json" },
      method: "PUT",
    })
    expect(selfWrite.status).toBe(404)
    const selfDelete = await app.request(`https://server.test/realms/${alpha.id}/me/metadata/own.key`, {
      headers: { authorization: `Bearer ${issued.data.token}` },
      method: "DELETE",
    })
    expect(selfDelete.status).toBe(404)
  })
})

test("realm administrators manage user metadata over tenant routes", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "user-meta-admin.example.com")
    const user = await createActiveUser(database, realm.id, "managed@example.com")
    const admin = await createActiveUser(database, realm.id, "admin@example.com")
    const system = realmSystemContextCreate("system")
    expect(realmAdministratorGrant({ context: system, database, realmId: realm.id, userId: admin.id }).success).toBe(
      true,
    )
    const testkit = platformTestkitCreate()
    const issued = sessionIssue({
      assurance: "authenticated",
      authenticationMethod: "password",
      database,
      realmId: realm.id,
      runtime: testkit.runtime,
      userId: admin.id,
    })
    expect(issued.success).toBe(true)
    if (!issued.success) return
    const app = userServerAppCreate({ database, publicOrigin: "https://user-meta-admin.example.com" })
    const metadataUrl = `https://server.test/realms/${realm.id}/users/${user.id}/metadata/admin.key`
    const saved = await app.request(metadataUrl, {
      body: JSON.stringify({ value: "admin-value" }),
      headers: { authorization: `Bearer ${issued.data.token}`, "content-type": "application/json" },
      method: "PUT",
    })
    expect(saved.status).toBe(200)
    expect(await saved.json()).toMatchObject({ metadata: { key: "admin.key", value: "admin-value" } })
    const fetched = await app.request(metadataUrl, {
      headers: { authorization: `Bearer ${issued.data.token}` },
    })
    expect(fetched.status).toBe(200)
    expect(await fetched.json()).toMatchObject({ metadata: { key: "admin.key", value: "admin-value" } })
    const removed = await app.request(metadataUrl, {
      headers: { authorization: `Bearer ${issued.data.token}` },
      method: "DELETE",
    })
    expect(removed.status).toBe(200)
    expect(await removed.json()).toMatchObject({ removed: true })
  })
})

test("user metadata events carry keys but never values", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "user-meta-events.example.com")
    const user = await createActiveUser(database, realm.id, "events@example.com")
    const system = realmSystemContextCreate("system")
    expect(
      userMetadataSet({
        context: system,
        database,
        input: { value: "super-secret-value" },
        key: "classified",
        realmId: realm.id,
        userId: user.id,
      }).success,
    ).toBe(true)
    expect(
      userMetadataRemove({ context: system, database, key: "classified", realmId: realm.id, userId: user.id }).success,
    ).toBe(true)

    const events = database.db.select().from(storageEventTable).all()
    const setEvent = events.find((event) => event.eventType === "user.metadata_set")
    const removeEvent = events.find((event) => event.eventType === "user.metadata_removed")
    expect(setEvent).toBeDefined()
    expect(removeEvent).toBeDefined()
    expect(setEvent?.payload as unknown as Record<string, unknown>).toEqual({
      key: "classified",
      userId: user.id,
      version: 1,
    })
    expect(removeEvent?.payload as unknown as Record<string, unknown>).toEqual({ key: "classified", userId: user.id })
    expect(JSON.stringify(events)).not.toContain("super-secret-value")
  })
})

test("user metadata MCP tools inherit credential scopes", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "user-meta-mcp.example.com")
    const organization = organizationCreate({
      context: realmSystemContextCreate("system"),
      database,
      input: { name: "MCP Org" },
      realmId: realm.id,
    })
    expect(organization.success).toBe(true)
    if (!organization.success) return
    const user = await createActiveUser(database, realm.id, "mcp-subject@example.com")
    const system = realmSystemContextCreate("system")
    const handle = mcpHttpHandlerCreate({ database })

    const scopedUser = machineUserCreate({
      context: system,
      database,
      input: { displayName: "Metadata worker", scopes: ["user.read", "user.manage"], userName: "user-meta-worker" },
      organizationId: organization.data.organization.id,
      realmId: realm.id,
    })
    expect(scopedUser.success).toBe(true)
    if (!scopedUser.success) return
    const scopedKey = machineApiKeyCreate({
      context: system,
      database,
      input: {
        machineUserId: scopedUser.data.machineUser.id,
        name: "user-meta-key",
        scopes: ["user.read", "user.manage"],
      },
      organizationId: organization.data.organization.id,
      realmId: realm.id,
    })
    expect(scopedKey.success).toBe(true)
    if (!scopedKey.success) return

    const call = (token: string, name: string, args: unknown) =>
      handle(
        new Request(`https://example.test/mcp?realmId=${realm.id}`, {
          body: JSON.stringify({ id: 1, jsonrpc: "2.0", method: "tools/call", params: { arguments: args, name } }),
          headers: {
            accept: "application/json, text/event-stream",
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
          },
          method: "POST",
        }),
      )
    const setResponse = await call(scopedKey.data.secret, "user-metadata-set", {
      key: "mcp.key",
      userId: user.id,
      value: "mcp-value",
    })
    expect(setResponse.status).toBe(200)
    expect((await setResponse.json()).result.isError).not.toBe(true)

    const getResponse = await call(scopedKey.data.secret, "user-metadata-get", {
      key: "mcp.key",
      userId: user.id,
    })
    expect(getResponse.status).toBe(200)
    expect(await getResponse.json()).toMatchObject({
      result: { content: [{ text: expect.stringContaining("mcp-value") }] },
    })

    const unscopedUser = machineUserCreate({
      context: system,
      database,
      input: { displayName: "Scoped out", userName: "user-meta-denied" },
      organizationId: organization.data.organization.id,
      realmId: realm.id,
    })
    expect(unscopedUser.success).toBe(true)
    if (!unscopedUser.success) return
    const deniedKey = machineApiKeyCreate({
      context: system,
      database,
      input: { machineUserId: unscopedUser.data.machineUser.id, name: "denied-key" },
      organizationId: organization.data.organization.id,
      realmId: realm.id,
    })
    expect(deniedKey.success).toBe(true)
    if (!deniedKey.success) return
    const denied = await call(deniedKey.data.secret, "user-metadata-set", {
      key: "mcp.key",
      userId: user.id,
      value: "nope",
    })
    expect(denied.status).toBe(200)
    expect((await denied.json()).result.isError).toBe(true)
  })
})
