import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import * as v from "valibot"
import { oidcClientCreate } from "../../src/features/oidc/actions/oidcClientCreate.js"
import { oidcClientGet } from "../../src/features/oidc/actions/oidcClientGet.js"
import { oidcClientUpdate } from "../../src/features/oidc/actions/oidcClientUpdate.js"
import { oidcOriginValidate } from "../../src/features/oidc/domain/oidcOriginValidate.js"
import { oidcClientCreatedEventPayloadSchema } from "../../src/features/oidc/events/oidcClientCreatedEventPayloadSchema.js"
import { oidcClientUpdatedEventPayloadSchema } from "../../src/features/oidc/events/oidcClientUpdatedEventPayloadSchema.js"
import { oidcServerAppCreate } from "../../src/features/oidc/server/oidcServerAppCreate.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { oidcApiClientCreate } from "../../src/outputs/library/oidc.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageEventTable } from "../../src/platform/storage/storageEventTable.js"

async function withDatabase<T>(operation: (database: StorageDatabase) => Promise<T>) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-oidc-compatibility-"))
  const opened = storageDatabaseOpen(join(directory, "authworks.sqlite"))
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

function realmCreateForTest(database: Parameters<typeof realmCreate>[0]["database"], domain: string) {
  const realm = realmCreate({ context: realmSystemContextCreate(), database, input: { domain, name: domain } })
  expect(realm.success).toBe(true)
  if (!realm.success) throw new Error(realm.errorMessage)
  return realm.data.realm
}

const clientInput = {
  clientType: "public" as const,
  name: "Compatibility client",
  redirectUris: ["https://client.example/callback"],
}

test("OIDC client compatibility settings default off, update partially, clear, and round-trip through events", async () => {
  await withDatabase(async (database) => {
    const realm = realmCreateForTest(database, "oidc-compatibility.example.com")
    const created = oidcClientCreate({
      context: realmSystemContextCreate(),
      database,
      input: clientInput,
      realmId: realm.id,
    })
    expect(created.success).toBe(true)
    if (!created.success) return
    expect(created.data.client).toMatchObject({
      accessTokenRoleAssertion: false,
      additionalOrigins: [],
      idTokenUserinfoAssertion: false,
    })

    const duplicateOrigins = oidcClientUpdate({
      clientId: created.data.client.id,
      context: realmSystemContextCreate(),
      database,
      input: { additionalOrigins: ["https://app.example.com", "https://app.example.com"] },
      realmId: realm.id,
    })
    expect(duplicateOrigins.success).toBe(false)

    const updated = oidcClientUpdate({
      clientId: created.data.client.id,
      context: realmSystemContextCreate(),
      database,
      input: {
        accessTokenRoleAssertion: true,
        additionalOrigins: ["http://localhost:3000", "https://app.example.com"],
        idTokenUserinfoAssertion: true,
      },
      realmId: realm.id,
    })
    expect(updated.success).toBe(true)
    if (!updated.success) return
    expect(updated.data.client).toMatchObject({
      accessTokenRoleAssertion: true,
      additionalOrigins: ["http://localhost:3000", "https://app.example.com"],
      idTokenUserinfoAssertion: true,
    })

    const partial = oidcClientUpdate({
      clientId: created.data.client.id,
      context: realmSystemContextCreate(),
      database,
      input: { accessTokenRoleAssertion: false },
      realmId: realm.id,
    })
    expect(partial.success).toBe(true)
    if (!partial.success) return
    expect(partial.data.client).toMatchObject({
      accessTokenRoleAssertion: false,
      additionalOrigins: ["http://localhost:3000", "https://app.example.com"],
      idTokenUserinfoAssertion: true,
    })

    const cleared = oidcClientUpdate({
      clientId: created.data.client.id,
      context: realmSystemContextCreate(),
      database,
      input: { additionalOrigins: [] },
      realmId: realm.id,
    })
    expect(cleared.success).toBe(true)
    if (!cleared.success) return
    expect(cleared.data.client.additionalOrigins).toEqual([])

    const fetched = oidcClientGet({
      clientId: created.data.client.id,
      context: realmSystemContextCreate(),
      database,
      realmId: realm.id,
    })
    expect(fetched.success).toBe(true)
    if (!fetched.success) return
    expect(fetched.data.client).toMatchObject({
      accessTokenRoleAssertion: false,
      additionalOrigins: [],
      idTokenUserinfoAssertion: true,
    })

    const events = database.db
      .select({ eventType: storageEventTable.eventType, payload: storageEventTable.payload })
      .from(storageEventTable)
      .all()
      .filter(({ eventType }) => eventType === "oidc.client_created" || eventType === "oidc.client_updated")
    expect(events).toHaveLength(4)
    const createdEvent = events.find(({ eventType }) => eventType === "oidc.client_created")
    const updatedEvent = events.findLast(({ eventType }) => eventType === "oidc.client_updated")
    expect(createdEvent).toBeDefined()
    expect(updatedEvent).toBeDefined()
    if (createdEvent === undefined || updatedEvent === undefined) return
    expect(v.parse(oidcClientCreatedEventPayloadSchema, createdEvent.payload)).toMatchObject({
      accessTokenRoleAssertion: false,
      additionalOrigins: [],
      idTokenUserinfoAssertion: false,
    })
    expect(v.parse(oidcClientUpdatedEventPayloadSchema, updatedEvent.payload)).toMatchObject({
      accessTokenRoleAssertion: false,
      additionalOrigins: [],
      idTokenUserinfoAssertion: true,
    })
  })
})

test("OIDC additional origins use HTTPS or localhost HTTP and reject non-origin values", () => {
  expect(oidcOriginValidate("https://app.example.com")).toEqual({ data: "https://app.example.com", success: true })
  expect(oidcOriginValidate("http://localhost:3000")).toEqual({ data: "http://localhost:3000", success: true })
  expect(oidcOriginValidate("http://127.0.0.1:3000")).toEqual({ data: "http://127.0.0.1:3000", success: true })
  expect(oidcOriginValidate("http://[::1]:3000")).toEqual({ data: "http://[::1]:3000", success: true })
  for (const origin of [
    "http://app.example.com",
    "https://*.example.com",
    "https://app.example.com/",
    "https://app.example.com/path",
    "https://app.example.com?query=yes",
    "https://user:password@app.example.com",
  ])
    expect(oidcOriginValidate(origin).success).toBe(false)
})

test("OIDC client compatibility settings survive the library API create, update, and get surfaces", async () => {
  await withDatabase(async (database) => {
    const realm = realmCreateForTest(database, "oidc-compatibility-api.example.com")
    const app = oidcServerAppCreate({ database, systemSecret: "compatibility-system-secret" })
    const api = oidcApiClientCreate({
      baseUrl: "https://server",
      fetch: async (input, init) => app.request(input.toString(), init),
      token: "compatibility-system-secret",
    })
    const created = await api.oidcClientCreate(realm.id, {
      ...clientInput,
      accessTokenRoleAssertion: true,
      additionalOrigins: ["http://localhost:4173"],
      idTokenUserinfoAssertion: true,
    })
    expect(created.success).toBe(true)
    if (!created.success) return
    expect(created.data.client).toMatchObject({
      accessTokenRoleAssertion: true,
      additionalOrigins: ["http://localhost:4173"],
      idTokenUserinfoAssertion: true,
    })

    const updated = await api.oidcClientUpdate(realm.id, created.data.client.id, { idTokenUserinfoAssertion: false })
    expect(updated.success).toBe(true)
    if (!updated.success) return
    expect(updated.data.client).toMatchObject({
      accessTokenRoleAssertion: true,
      additionalOrigins: ["http://localhost:4173"],
      idTokenUserinfoAssertion: false,
    })

    const fetched = await api.oidcClientGet(realm.id, created.data.client.id)
    expect(fetched.success).toBe(true)
    if (!fetched.success) return
    expect(fetched.status).toBe("current")
    if (fetched.status !== "current") return
    expect(fetched.data.client).toMatchObject({
      accessTokenRoleAssertion: true,
      additionalOrigins: ["http://localhost:4173"],
      idTokenUserinfoAssertion: false,
    })
  })
})

test("legacy OIDC client rows gain compatibility defaults without losing stored data", async () => {
  const directory = await mkdtemp(join(tmpdir(), "authworks-oidc-legacy-"))
  const path = join(directory, "authworks.sqlite")
  const legacy = new Database(path)
  legacy.run(
    "CREATE TABLE oidc_clients (id TEXT PRIMARY KEY NOT NULL, realm_id TEXT NOT NULL, name TEXT NOT NULL, client_type TEXT NOT NULL, secret_hash TEXT, redirect_uris TEXT NOT NULL, post_logout_redirect_uris TEXT NOT NULL, allowed_scopes TEXT NOT NULL, trusted INTEGER NOT NULL, require_consent INTEGER NOT NULL, status TEXT NOT NULL, project_id TEXT, application_id TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, version INTEGER NOT NULL)",
  )
  legacy
    .query(
      "INSERT INTO oidc_clients (id, realm_id, name, client_type, secret_hash, redirect_uris, post_logout_redirect_uris, allowed_scopes, trusted, require_consent, status, project_id, application_id, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .run(
      "01900000-0000-7000-8000-000000000061",
      "01900000-0000-7000-8000-000000000062",
      "Legacy client",
      "public",
      null,
      JSON.stringify(["https://legacy.example/callback"]),
      "[]",
      JSON.stringify(["openid"]),
      0,
      1,
      "active",
      null,
      null,
      1,
      2,
      1,
    )
  legacy.close()

  const opened = storageDatabaseOpen(path)
  expect(opened.success).toBe(true)
  if (!opened.success) {
    await rm(directory, { force: true, recursive: true })
    return
  }
  try {
    const fetched = oidcClientGet({
      clientId: "01900000-0000-7000-8000-000000000061",
      context: realmSystemContextCreate(),
      database: opened.data,
      realmId: "01900000-0000-7000-8000-000000000062",
    })
    expect(fetched.success).toBe(true)
    if (!fetched.success) return
    expect(fetched.data.client).toMatchObject({
      accessTokenRoleAssertion: false,
      additionalOrigins: [],
      idTokenUserinfoAssertion: false,
      name: "Legacy client",
      redirectUris: ["https://legacy.example/callback"],
    })
    expect(
      opened.data.sqlite
        .query("SELECT id_token_userinfo_assertion, access_token_role_assertion, additional_origins FROM oidc_clients")
        .get(),
    ).toEqual({ id_token_userinfo_assertion: 0, access_token_role_assertion: 0, additional_origins: "[]" })
  } finally {
    opened.data.close()
    await rm(directory, { force: true, recursive: true })
  }
})
