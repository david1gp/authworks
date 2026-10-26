import { afterAll, beforeAll, expect, mock, test } from "bun:test"
import { Hono } from "hono"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { oidcClientCreate } from "../../src/features/oidc/actions/oidcClientCreate.js"
import { oidcApiClientCreate } from "../../src/features/oidc/client/oidcApiClientCreate.js"
import { oidcServerAppCreate } from "../../src/features/oidc/server/oidcServerAppCreate.js"
import { passwordEmailVerify } from "../../src/features/passwords/actions/passwordEmailVerify.js"
import { passwordLogin } from "../../src/features/passwords/actions/passwordLogin.js"
import { passwordRegister } from "../../src/features/passwords/actions/passwordRegister.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../src/features/realms/domain/realmTenantContextCreate.js"
import { sessionPasswordCreate } from "../../src/features/sessions/actions/sessionPasswordCreate.js"
import { sessionServerAppCreate } from "../../src/features/sessions/server/sessionServerAppCreate.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

type ConsentStateCreate =
  typeof import("../../src/features/oidc/ui/oidcConsentProductionStateCreate.js")["oidcConsentProductionStateCreate"]

const solidRuntimePath = "../../node_modules/solid-js/dist/dev.js"
const solidWebRuntimePath = "../../node_modules/solid-js/web/dist/web.js"
mock.module("solid-js", () => import(solidRuntimePath))
mock.module("solid-js/web", () => import(solidWebRuntimePath))

let createRoot: typeof import("solid-js").createRoot
let consentStateCreate: ConsentStateCreate

beforeAll(async () => {
  const solid = await import("solid-js")
  createRoot = solid.createRoot
  consentStateCreate = (await import("../../src/features/oidc/ui/oidcConsentProductionStateCreate.js"))
    .oidcConsentProductionStateCreate
})

afterAll(() => mock.restore())

const publicOrigin = "https://consent-production.example.com"

function testServerCreate(database: StorageDatabase) {
  const app = new Hono()
  app.route("/", sessionServerAppCreate({ database, publicOrigin }))
  app.route("/", oidcServerAppCreate({ database, publicOrigin, systemSecret: "consent-production-secret" }))
  return app
}

async function withDatabase<T>(operation: (database: StorageDatabase) => Promise<T>): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), "authworks-oidc-consent-production-"))
  const opened = storageDatabaseOpen(join(directory, "authworks.sqlite"), platformTestkitCreate().runtime)
  expect(opened.success).toBe(true)
  if (!opened.success) throw new Error(opened.errorMessage)
  try {
    return await operation(opened.data)
  } finally {
    opened.data.close()
    await rm(directory, { force: true, recursive: true })
  }
}

function cookieJarCreate(request: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const jar = new Map<string, string>()
  const cookieSet = (name: string, value: string | undefined) => {
    if (value === undefined || value.length === 0) jar.delete(name)
    else jar.set(name, value)
  }
  const fetch = async (input: string | URL | Request, init: RequestInit = {}): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url
    const headers = new Headers(init.headers)
    const cookie = [...jar].map(([name, value]) => `${name}=${value}`).join("; ")
    if (cookie.length > 0) headers.set("cookie", cookie)
    // Browsers attach an Origin header to same-origin POSTs; the harness reproduces it.
    if ((init.method ?? "GET").toUpperCase() !== "GET" && headers.get("origin") === null)
      headers.set("origin", new URL(url).origin)
    const response = await request(url, { ...init, headers })
    const setCookies: readonly string[] =
      typeof response.headers.getSetCookie === "function"
        ? response.headers.getSetCookie()
        : (response.headers.get("set-cookie")?.split(/,(?=[^;,]+=)/) ?? [])
    for (const entry of setCookies) {
      const [pair, ...attributes] = entry.split(";")
      const separator = pair?.indexOf("=") ?? -1
      if (separator < 0) continue
      const name = pair?.slice(0, separator).trim()
      if (name === undefined || name.length === 0) continue
      const expired = attributes.some((attribute) => /max-age=0/i.test(attribute.trim()))
      cookieSet(name, expired ? undefined : pair?.slice(separator + 1).trim())
    }
    return response
  }
  return { cookieSet, fetch }
}

async function realmWithSessionCreate(database: StorageDatabase) {
  const realm = realmCreate({
    context: realmSystemContextCreate(),
    database,
    input: { domain: "consent-production.example.com", name: "Consent Production" },
  })
  expect(realm.success).toBe(true)
  if (!realm.success) throw new Error(realm.errorMessage)
  const context = realmTenantContextCreate(realm.data.realm.id, "anonymous")
  let verificationToken = ""
  const registered = passwordRegister({
    context,
    database,
    input: {
      email: "consent@example.com",
      password: "Correct Horse 12",
      profile: {},
      userName: "consent-user",
    },
    onVerificationToken: ({ token }) => {
      verificationToken = token
    },
    realmId: realm.data.realm.id,
  })
  expect(registered.success).toBe(true)
  expect(
    passwordEmailVerify({ context, database, input: { token: verificationToken }, realmId: realm.data.realm.id })
      .success,
  ).toBe(true)
  const login = passwordLogin({
    context,
    database,
    input: { identifier: "consent-user", password: "Correct Horse 12" },
    realmId: realm.data.realm.id,
    sessionCreate: sessionPasswordCreate(),
  })
  expect(login.success).toBe(true)
  if (!login.success) throw new Error(login.errorMessage)
  if (login.data.session === undefined) throw new Error("The session is missing.")
  const client = oidcClientCreate({
    context: realmSystemContextCreate(),
    database,
    input: {
      allowedScopes: ["openid", "profile", "email"],
      clientType: "public",
      name: "Consent browser client",
      redirectUris: ["https://client.example/callback"],
      requireConsent: true,
    },
    realmId: realm.data.realm.id,
  })
  expect(client.success).toBe(true)
  if (!client.success) throw new Error(client.errorMessage)
  return { client: client.data.client, realmId: realm.data.realm.id, sessionToken: login.data.session.token }
}

async function interactionStart(
  database: StorageDatabase,
  sessionToken: string,
  clientId: string,
  state: string,
): Promise<{ binding: string; handle: string }> {
  const app = testServerCreate(database)
  const authorize = new URLSearchParams({
    client_id: clientId,
    code_challenge: "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG",
    code_challenge_method: "S256",
    redirect_uri: "https://client.example/callback",
    response_type: "code",
    scope: "openid profile email",
    state,
  })
  const started = await app.request(`${publicOrigin}/oauth2/authorize?${authorize}`, {
    headers: { accept: "text/html" },
  })
  expect(started.status).toBe(302)
  const handle = new URL(`${publicOrigin}${started.headers.get("location")}`).searchParams.get("interaction")
  expect(handle).toBeString()
  if (handle === null) throw new Error("The interaction handle is missing.")
  const binding = /oidc-interaction=([^;]+)/.exec(started.headers.get("set-cookie") ?? "")?.[1]
  expect(binding).toBeString()
  if (binding === undefined) throw new Error("The interaction binding is missing.")
  const jar = cookieJarCreate((url, init) => app.request(url, init))
  jar.cookieSet("session", sessionToken)
  jar.cookieSet("oidc-interaction", binding)
  const resumed = await jar.fetch(`${publicOrigin}/oauth2/authorize?interaction=${handle}`, {
    headers: { accept: "text/html" },
  })
  expect(resumed.status).toBe(302)
  expect(resumed.headers.get("location")).toStartWith("/consent?")
  return { binding, handle }
}

test("the production consent state approves through the browser transport and follows the code redirect", async () => {
  await withDatabase(async (database) => {
    const { client, realmId, sessionToken } = await realmWithSessionCreate(database)
    const { binding, handle } = await interactionStart(database, sessionToken, client.id, "approve-state")
    const app = testServerCreate(database)
    const jar = cookieJarCreate((url, init) => app.request(url, init))
    jar.cookieSet("session", sessionToken)
    jar.cookieSet("oidc-interaction", binding)
    const assigned: string[] = []
    const { dispose, state } = consentStateInRoot({
      assign: (url) => assigned.push(url),
      fetch: jar.fetch,
      handle,
    })
    try {
      await state.load()
      expect(state.status()).toBe("ready")
      expect(state.details()).toMatchObject({
        client_id: client.id,
        client_name: "Consent browser client",
        realm_id: realmId,
        redirect_uri: "https://client.example/callback",
      })
      expect(state.scopes().map((scope) => scope.label)).toEqual([
        "Verify your identity",
        "Your basic profile",
        "Your email address",
      ])
      await state.approve()
      expect(assigned).toHaveLength(1)
      const redirect = new URL(assigned[0] ?? "")
      expect(redirect.origin + redirect.pathname).toBe("https://client.example/callback")
      expect(redirect.searchParams.get("state")).toBe("approve-state")
      expect(redirect.searchParams.get("code")).toBeString()
    } finally {
      dispose()
    }
  })
})

test("the production consent state denies through the browser transport and follows the access-denied redirect", async () => {
  await withDatabase(async (database) => {
    const { client, sessionToken } = await realmWithSessionCreate(database)
    const { binding, handle } = await interactionStart(database, sessionToken, client.id, "deny-state")
    const app = testServerCreate(database)
    const jar = cookieJarCreate((url, init) => app.request(url, init))
    jar.cookieSet("session", sessionToken)
    jar.cookieSet("oidc-interaction", binding)
    const assigned: string[] = []
    const { dispose, state } = consentStateInRoot({
      assign: (url) => assigned.push(url),
      fetch: jar.fetch,
      handle,
    })
    try {
      await state.load()
      expect(state.status()).toBe("ready")
      await state.deny()
      expect(assigned).toHaveLength(1)
      const redirect = new URL(assigned[0] ?? "")
      expect(redirect.origin + redirect.pathname).toBe("https://client.example/callback")
      expect(redirect.searchParams.get("error")).toBe("access_denied")
      expect(redirect.searchParams.get("state")).toBe("deny-state")
    } finally {
      dispose()
    }
  })
})

test("the production consent state reports consumed and unauthenticated interactions without raw codes", async () => {
  await withDatabase(async (database) => {
    const { client, sessionToken } = await realmWithSessionCreate(database)
    const { binding, handle } = await interactionStart(database, sessionToken, client.id, "consumed-state")
    const app = testServerCreate(database)
    const jar = cookieJarCreate((url, init) => app.request(url, init))
    jar.cookieSet("session", sessionToken)
    jar.cookieSet("oidc-interaction", binding)
    const first = consentStateInRoot({ fetch: jar.fetch, handle })
    try {
      await first.state.load()
      expect(first.state.status()).toBe("ready")
      await first.state.approve()
    } finally {
      first.dispose()
    }
    const replay = consentStateInRoot({ fetch: jar.fetch, handle })
    try {
      await replay.state.load()
      expect(replay.state.status()).toBe("invalid")
    } finally {
      replay.dispose()
    }
    const anonymous = cookieJarCreate((url, init) => app.request(url, init))
    const unauthenticated = consentStateInRoot({ fetch: anonymous.fetch, handle })
    try {
      await unauthenticated.state.load()
      expect(unauthenticated.state.status()).toBe("unauthenticated")
    } finally {
      unauthenticated.dispose()
    }
  })
})

function consentStateInRoot(options: {
  assign?: (url: string) => void
  fetch: (input: string | URL | Request, init?: RequestInit) => Promise<Response>
  handle: string
}) {
  let dispose: (() => void) | undefined
  const state = createRoot((rootDispose) => {
    dispose = rootDispose
    return consentStateCreate({
      assign: options.assign ?? (() => {}),
      client: oidcApiClientCreate({ baseUrl: publicOrigin, fetch: options.fetch }),
      search: () => `?interaction=${options.handle}`,
    })
  })
  if (dispose === undefined) throw new Error("The consent state root is missing.")
  return { dispose, state }
}
