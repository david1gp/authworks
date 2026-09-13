import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { oidcClientCreate } from "../../src/features/oidc/actions/oidcClientCreate.js"
import { oidcClientLifecycleSet } from "../../src/features/oidc/actions/oidcClientLifecycleSet.js"
import { oidcClientCorsOriginMatches } from "../../src/features/oidc/domain/oidcClientCorsOriginMatches.js"
import { oidcHashCreate } from "../../src/features/oidc/domain/oidcHashCreate.js"
import { oidcRepositoryCreate } from "../../src/features/oidc/persistence/oidcRepositoryCreate.js"
import { oidcServerAppCreate } from "../../src/features/oidc/server/oidcServerAppCreate.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { userCreate } from "../../src/features/users/actions/userCreate.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"

async function withDatabase<T>(operation: (database: StorageDatabase) => Promise<T>) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-oidc-cors-"))
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

function clientCreateForTest(database: StorageDatabase, realmId: string, additionalOrigins: string[] = []) {
  const client = oidcClientCreate({
    context: realmSystemContextCreate(),
    database,
    input: {
      additionalOrigins,
      clientType: "public",
      name: "CORS client",
      redirectUris: ["https://redirect.example/callback"],
    },
    realmId,
  })
  expect(client.success).toBe(true)
  if (!client.success) throw new Error(client.errorMessage)
  return client.data.client
}

function corsPreflightRequest(url: string, origin: string, method: string, headers = "authorization") {
  return new Request(url, {
    headers: {
      "access-control-request-headers": headers,
      "access-control-request-method": method,
      origin,
    },
    method: "OPTIONS",
  })
}

test("OIDC protocol CORS combines redirect origins and additional origins without wildcard grants", async () => {
  await withDatabase(async (database) => {
    const realm = realmCreateForTest(database, "oidc-cors.example.com")
    const client = clientCreateForTest(database, realm.id, ["https://extra.example"])
    const app = oidcServerAppCreate({ database })

    const redirectOrigin = await app.fetch(
      corsPreflightRequest("https://oidc-cors.example.com/oauth2/userinfo", "https://redirect.example", "GET"),
    )
    expect(redirectOrigin.status).toBe(204)
    expect(redirectOrigin.headers.get("access-control-allow-origin")).toBe("https://redirect.example")
    expect(redirectOrigin.headers.get("access-control-allow-methods")).toBe("GET, POST")
    expect(redirectOrigin.headers.get("access-control-allow-headers")).toBe("authorization, content-type")
    expect(redirectOrigin.headers.get("vary")).toContain("Origin")
    expect(redirectOrigin.headers.get("access-control-allow-credentials")).toBeNull()

    const additionalOrigin = await app.fetch(
      corsPreflightRequest(
        `https://oidc-cors.example.com/oauth2/token?client_id=${encodeURIComponent(client.id)}`,
        "https://extra.example",
        "POST",
        "Authorization, Content-Type",
      ),
    )
    expect(additionalOrigin.status).toBe(204)
    expect(additionalOrigin.headers.get("access-control-allow-origin")).toBe("https://extra.example")
    expect(additionalOrigin.headers.get("access-control-allow-methods")).toBe("POST")
    expect(additionalOrigin.headers.get("access-control-allow-origin")).not.toBe("*")

    const actualToken = await app.fetch(
      new Request("https://oidc-cors.example.com/oauth2/token", {
        body: new URLSearchParams({ client_id: client.id, grant_type: "authorization_code" }),
        headers: { "content-type": "application/x-www-form-urlencoded", origin: "https://extra.example" },
        method: "POST",
      }),
    )
    expect(actualToken.status).toBe(400)
    expect(actualToken.headers.get("access-control-allow-origin")).toBe("https://extra.example")
    expect(actualToken.headers.get("access-control-allow-credentials")).toBeNull()

    const denied = await app.fetch(
      corsPreflightRequest("https://oidc-cors.example.com/oauth2/userinfo", "https://unrelated.example", "GET"),
    )
    expect(denied.status).toBe(403)
    expect(denied.headers.get("access-control-allow-origin")).toBeNull()

    const invalid = await app.fetch(
      corsPreflightRequest("https://oidc-cors.example.com/oauth2/userinfo", "null", "GET"),
    )
    expect(invalid.status).toBe(403)
    expect(invalid.headers.get("access-control-allow-origin")).toBeNull()

    const management = await app.fetch(
      new Request(`https://oidc-cors.example.com/realms/${realm.id}/oidc/clients`, {
        headers: { origin: "https://extra.example" },
        method: "OPTIONS",
      }),
    )
    expect(management.headers.get("access-control-allow-origin")).toBeNull()
  })
})

test("OIDC protocol CORS keeps preflight realm and client candidates bounded", async () => {
  await withDatabase(async (database) => {
    const realm = realmCreateForTest(database, "oidc-cors-isolation.example.com")
    const otherRealm = realmCreateForTest(database, "oidc-cors-other.example.com")
    const client = clientCreateForTest(database, realm.id, ["https://client-a.example"])
    const otherClient = clientCreateForTest(database, realm.id, ["https://client-b.example"])
    const app = oidcServerAppCreate({ database })

    const wrongClient = await app.fetch(
      corsPreflightRequest(
        `https://oidc-cors-isolation.example.com/oauth2/userinfo?client_id=${encodeURIComponent(otherClient.id)}`,
        "https://client-a.example",
        "GET",
      ),
    )
    expect(wrongClient.status).toBe(403)

    const realmCandidate = await app.fetch(
      corsPreflightRequest(
        "https://oidc-cors-isolation.example.com/oauth2/userinfo",
        "https://client-a.example",
        "GET",
      ),
    )
    expect(realmCandidate.status).toBe(204)

    const foreignRealm = await app.fetch(
      corsPreflightRequest("https://oidc-cors-other.example.com/oauth2/userinfo", "https://client-a.example", "GET"),
    )
    expect(foreignRealm.status).toBe(403)

    const disabled = oidcClientLifecycleSet({
      clientId: client.id,
      context: realmSystemContextCreate(),
      database,
      input: { status: "inactive" },
      realmId: realm.id,
    })
    expect(disabled.success).toBe(true)
    const disabledResponse = await app.fetch(
      corsPreflightRequest(
        "https://oidc-cors-isolation.example.com/oauth2/userinfo",
        "https://client-a.example",
        "GET",
      ),
    )
    expect(disabledResponse.status).toBe(403)

    expect(
      oidcClientCorsOriginMatches(
        { additionalOrigins: JSON.stringify(["https://client-a.example"]), redirectUris: "[]" },
        "https://client-a.example/path",
      ),
    ).toBe(false)
    expect(otherRealm.id).not.toBe(realm.id)
  })
})

test("OIDC actual CORS uses the access token client rather than a preflight candidate", async () => {
  await withDatabase(async (database) => {
    const realm = realmCreateForTest(database, "oidc-cors-actual.example.com")
    const client = clientCreateForTest(database, realm.id, ["https://client-a.example"])
    const otherClient = clientCreateForTest(database, realm.id, ["https://client-b.example"])
    const user = userCreate({
      context: realmSystemContextCreate("system"),
      database,
      input: { email: "cors@example.com", profile: { displayName: "CORS" }, userName: "cors" },
      realmId: realm.id,
    })
    expect(user.success).toBe(true)
    if (!user.success) return
    const token = "cors-access-token"
    const access = oidcRepositoryCreate(database.db).accessTokenCreate({
      clientId: otherClient.id,
      createdAt: database.runtime.now(),
      expiresAt: database.runtime.now() + 60_000,
      id: "01900000-0000-7000-8000-000000000091",
      realmId: realm.id,
      scope: JSON.stringify(["openid"]),
      sessionId: "01900000-0000-7000-8000-000000000092",
      tokenHash: oidcHashCreate(token),
      userId: user.data.user.id,
    })
    expect(access.success).toBe(true)
    const app = oidcServerAppCreate({ database })

    const allowed = await app.fetch(
      new Request("https://oidc-cors-actual.example.com/oauth2/userinfo", {
        headers: { authorization: `Bearer ${token}`, origin: "https://client-b.example" },
      }),
    )
    expect(allowed.headers.get("access-control-allow-origin")).toBe("https://client-b.example")
    expect(allowed.headers.get("vary")).toContain("Origin")

    const unrelated = await app.fetch(
      new Request(`https://oidc-cors-actual.example.com/oauth2/userinfo?client_id=${encodeURIComponent(client.id)}`, {
        headers: { authorization: `Bearer ${token}`, origin: "https://client-a.example" },
      }),
    )
    expect(unrelated.headers.get("access-control-allow-origin")).toBeNull()
    expect(unrelated.headers.get("vary")).toContain("Origin")
  })
})
