import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { organizationCreate } from "../../organizations/actions/organizationCreate.js"
import { projectCreate } from "../../projects/actions/projectCreate.js"
import { realmCreate } from "../../realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../realms/domain/realmSystemContextCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../../platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../../platform/testkit/platformTestkitCreate.js"
import { oidcClientCreate } from "./oidcClientCreate.js"
import { oidcClientLifecycleSet } from "./oidcClientLifecycleSet.js"
import { oidcProjectFaviconGet } from "./oidcProjectFaviconGet.js"

const pngBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])

async function withDatabase<T>(operation: (database: StorageDatabase) => Promise<T>): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), "authworks-project-favicon-"))
  const opened = storageDatabaseOpen(join(directory, "authworks.sqlite"), platformTestkitCreate().runtime)
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

async function projectSeed(database: StorageDatabase, domain: string): Promise<{ projectId: string; realmId: string }> {
  const context = realmSystemContextCreate()
  const realm = realmCreate({ context, database, input: { domain, name: domain } })
  expect(realm.success).toBe(true)
  if (!realm.success) throw new Error(realm.errorMessage)
  const organization = organizationCreate({
    context,
    database,
    input: { name: `${domain} org` },
    realmId: realm.data.realm.id,
  })
  expect(organization.success).toBe(true)
  if (!organization.success) throw new Error(organization.errorMessage)
  const project = projectCreate({
    context,
    database,
    input: { name: `${domain} project`, organizationId: organization.data.organization.id },
    realmId: realm.data.realm.id,
  })
  expect(project.success).toBe(true)
  if (!project.success) throw new Error(project.errorMessage)
  return { projectId: project.data.project.id, realmId: realm.data.realm.id }
}

async function clientSeed(
  database: StorageDatabase,
  seed: { projectId: string; realmId: string },
  overrides?: { readonly redirectUris?: readonly string[] },
): Promise<string> {
  const client = oidcClientCreate({
    context: realmSystemContextCreate(),
    database,
    input: {
      allowedScopes: ["openid"],
      clientType: "public",
      name: "favicon client",
      projectId: seed.projectId,
      redirectUris: [...(overrides?.redirectUris ?? ["https://app.example.com/callback"])],
      trusted: true,
    },
    realmId: seed.realmId,
  })
  expect(client.success).toBe(true)
  if (!client.success) throw new Error(client.errorMessage)
  return client.data.client.id
}

function fetchStubCreate(body: Uint8Array<ArrayBuffer>, headers?: Record<string, string>) {
  let calls = 0
  const fetchImpl = async (_input: string, _init?: RequestInit): Promise<Response> => {
    calls += 1
    return new Response(body, { headers })
  }
  return { calls: () => calls, fetchImpl }
}

test("project favicon proxies the callback origin icon and caches it", async () => {
  await withDatabase(async (database) => {
    const seed = await projectSeed(database, "favicon-cache.example.com")
    await clientSeed(database, seed)
    const stub = fetchStubCreate(pngBytes, { "content-type": "image/png" })
    const cache = new Map()
    const first = await oidcProjectFaviconGet({
      cache,
      context: realmSystemContextCreate(),
      database,
      fetch: stub.fetchImpl,
      now: () => 0,
      projectId: seed.projectId,
      realmId: seed.realmId,
    })
    expect(first.success).toBe(true)
    if (!first.success) return
    expect(first.data.origin).toBe("https://app.example.com")
    expect(first.data.contentType).toBe("image/png")
    expect(first.data.maxAgeSeconds).toBe(7 * 24 * 60 * 60)
    expect([...first.data.bytes]).toEqual([...pngBytes])
    const second = await oidcProjectFaviconGet({
      cache,
      context: realmSystemContextCreate(),
      database,
      fetch: stub.fetchImpl,
      now: () => 1000,
      projectId: seed.projectId,
      realmId: seed.realmId,
    })
    expect(second.success).toBe(true)
    expect(stub.calls()).toBe(1)
  })
})

test("project favicon honors upstream cache headers", async () => {
  await withDatabase(async (database) => {
    const seed = await projectSeed(database, "favicon-headers.example.com")
    await clientSeed(database, seed)
    const stub = fetchStubCreate(pngBytes, { "cache-control": "public, max-age=3600", "content-type": "image/png" })
    const result = await oidcProjectFaviconGet({
      cache: new Map(),
      context: realmSystemContextCreate(),
      database,
      fetch: stub.fetchImpl,
      now: () => 0,
      projectId: seed.projectId,
      realmId: seed.realmId,
    })
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.maxAgeSeconds).toBe(3600)
  })
})

test("project favicon is not found without usable callback URLs", async () => {
  await withDatabase(async (database) => {
    const seed = await projectSeed(database, "favicon-missing.example.com")
    const result = await oidcProjectFaviconGet({
      cache: new Map(),
      context: realmSystemContextCreate(),
      database,
      fetch: async () => new Response(pngBytes),
      now: () => 0,
      projectId: seed.projectId,
      realmId: seed.realmId,
    })
    expect(result).toMatchObject({ code: "oidc.not-found", success: false })
  })
})

test("project favicon skips removed clients", async () => {
  await withDatabase(async (database) => {
    const seed = await projectSeed(database, "favicon-removed.example.com")
    const clientId = await clientSeed(database, seed)
    const retired = oidcClientLifecycleSet({
      clientId,
      context: realmSystemContextCreate(),
      database,
      input: { status: "removed" },
      realmId: seed.realmId,
    })
    expect(retired.success).toBe(true)
    const result = await oidcProjectFaviconGet({
      cache: new Map(),
      context: realmSystemContextCreate(),
      database,
      fetch: async () => new Response(pngBytes),
      now: () => 0,
      projectId: seed.projectId,
      realmId: seed.realmId,
    })
    expect(result).toMatchObject({ code: "oidc.not-found", success: false })
  })
})

test("project favicon rejects non-image responses", async () => {
  await withDatabase(async (database) => {
    const seed = await projectSeed(database, "favicon-html.example.com")
    await clientSeed(database, seed)
    const stub = fetchStubCreate(new TextEncoder().encode("<html></html>"), { "content-type": "text/html" })
    const result = await oidcProjectFaviconGet({
      cache: new Map(),
      context: realmSystemContextCreate(),
      database,
      fetch: stub.fetchImpl,
      now: () => 0,
      projectId: seed.projectId,
      realmId: seed.realmId,
    })
    expect(result).toMatchObject({ code: "oidc.not-found", success: false })
  })
})
