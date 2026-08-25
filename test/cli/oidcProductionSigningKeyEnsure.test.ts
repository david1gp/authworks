import { expect, test } from "bun:test"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { serverApplicationCreate } from "../../src/compositions/serverApplicationCreate.js"
import { oidcApiClientCreate } from "../../src/features/oidc/client/oidcApiClientCreate.js"
import { oidcProductionSigningKeyEnsure } from "../../src/features/oidc/cli/oidcProductionSigningKeyEnsure.js"
import { realmApiClientCreate } from "../../src/features/realms/client/realmApiClientCreate.js"

const systemSecret = "production-signing-key-secret-00000000"
const productionOrigin = "https://authworks.contentoren.de"

test("production signing-key ensure creates once, then reuses without rotation", async () => {
  const fixture = await productionFixtureCreate()
  try {
    const first = await ensureRun(fixture)
    expect(first.success).toBe(true)
    expect(first.success && first.data).toBe("created")

    const second = await ensureRun(fixture)
    expect(second.success).toBe(true)
    expect(second.success && second.data).toBe("reused")
    expect(fixture.ensureRequests).toBe(1)

    const keys = await fixture.oidcApi.oidcSigningKeyList(fixture.realmId, { pageSize: 100 })
    expect(keys.success).toBe(true)
    if (!keys.success) return
    expect(keys.data.items).toHaveLength(1)
    expect(keys.data.items[0]).toMatchObject({ algorithm: "RS256", retiredAt: null, status: "active" })
    expect(keys.data.items[0]?.id).toBe(keys.data.items[0]?.publicJwk.kid)
  } finally {
    await fixture.remove()
  }
})

test("production signing-key ensure refuses ambiguous and malformed active-key state without mutation", async () => {
  const fixture = await productionFixtureCreate()
  try {
    const created = await ensureRun(fixture)
    expect(created.success).toBe(true)
    const requestsBefore = fixture.ensureRequests

    for (const scenario of ["ambiguous", "malformed"] as const) {
      const result = await ensureRun(fixture, async (input, init) => {
        const request = new Request(input, init)
        const response = await fixture.observedFetch(request)
        if (request.method !== "GET" || !new URL(request.url).pathname.endsWith("/signing-keys")) return response
        const body = (await response.json()) as { items: Record<string, unknown>[] }
        const key = body.items[0]
        if (key === undefined) return Response.json(body)
        if (scenario === "ambiguous") return Response.json({ ...body, items: [key, key] })
        return Response.json({
          ...body,
          items: [{ ...key, publicJwk: { ...(key.publicJwk as Record<string, unknown>), e: "not+base64url" } }],
        })
      })
      expect(result.success).toBe(false)
      if (result.success) continue
      expect(result.code).toBe(
        scenario === "ambiguous"
          ? "oidc.production-signing-key-ensure.key-ambiguous"
          : "oidc.production-signing-key-ensure.verification-failed",
      )
      expect(fixture.ensureRequests).toBe(requestsBefore)
    }
  } finally {
    await fixture.remove()
  }
})

test("production signing-key ensure verifies the post-mutation key", async () => {
  const fixture = await productionFixtureCreate()
  let listRequests = 0
  try {
    const result = await ensureRun(fixture, async (input, init) => {
      const request = new Request(input, init)
      const response = await fixture.observedFetch(request)
      if (request.method !== "GET" || !new URL(request.url).pathname.endsWith("/signing-keys")) return response
      listRequests += 1
      if (listRequests !== 2) return response
      const body = (await response.json()) as { items: Record<string, unknown>[] }
      const key = body.items[0]
      if (key === undefined) return Response.json(body)
      return Response.json({
        ...body,
        items: [{ ...key, publicJwk: { ...(key.publicJwk as Record<string, unknown>), n: "changed" } }],
      })
    })
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.code).toBe("oidc.production-signing-key-ensure.verification-failed")
    expect(fixture.ensureRequests).toBe(1)
  } finally {
    await fixture.remove()
  }
})

test("production signing-key ensure closes realm and API failures before unsafe mutation", async () => {
  for (const [scenario, expectedCode] of [
    ["realm-ambiguous", "oidc.production-signing-key-ensure.realm-ambiguous"],
    ["api-unauthorized", "oidc.production-signing-key-ensure.api-unauthorized"],
    ["api-invalid-response", "oidc.production-signing-key-ensure.api-invalid-response"],
    ["ensure-rejected", "oidc.production-signing-key-ensure.ensure-rejected"],
  ] as const) {
    const fixture = await productionFixtureCreate()
    try {
      const result = await ensureRun(fixture, async (input, init) => {
        const request = new Request(input, init)
        const path = new URL(request.url).pathname
        if (request.method === "GET" && path === "/system/realms") {
          if (scenario === "api-unauthorized") return Response.json({ private: true }, { status: 401 })
          const response = await fixture.observedFetch(request)
          if (scenario !== "realm-ambiguous") return response
          const body = (await response.json()) as { items: Record<string, unknown>[] }
          return Response.json({ ...body, items: [...body.items, ...body.items] })
        }
        if (request.method === "GET" && path.endsWith("/signing-keys") && scenario === "api-invalid-response")
          return Response.json({ private: true })
        if (request.method === "POST" && path.endsWith("/signing-keys/ensure-active") && scenario === "ensure-rejected")
          return Response.json({ private: true }, { status: 409 })
        return await fixture.observedFetch(request)
      })
      expect(result.success).toBe(false)
      if (result.success) continue
      expect(result.code).toBe(expectedCode)
    } finally {
      await fixture.remove()
    }
  }
})

test("production signing-key ensure CLI has zero-argument and closed failure output", async () => {
  const failed = Bun.spawn(["bun", "src/outputs/cli.ts", "oidc", "production-signing-key-ensure"], {
    stderr: "pipe",
    stdout: "pipe",
  })
  const [exitCode, stderr, stdout] = await Promise.all([
    failed.exited,
    new Response(failed.stderr).text(),
    new Response(failed.stdout).text(),
  ])
  expect(exitCode).toBe(40)
  expect(stdout).toBe("")
  expect(stderr).toBe('{"error":{"code":"oidc.production-signing-key-ensure.input-invalid"}}\n')

  const withArgument = Bun.spawn(
    ["bun", "src/outputs/cli.ts", "oidc", "production-signing-key-ensure", "--realm-id", "private"],
    { stderr: "pipe", stdout: "pipe" },
  )
  const [argumentExitCode, argumentStdout] = await Promise.all([
    withArgument.exited,
    new Response(withArgument.stdout).text(),
  ])
  expect(argumentExitCode).not.toBe(0)
  expect(argumentStdout).toBe("")
})

async function productionFixtureCreate() {
  const directory = await mkdtemp(join(tmpdir(), "authworks-production-signing-key-"))
  const created = serverApplicationCreate({ databasePath: join(directory, "authworks.sqlite"), systemSecret })
  if (!created.success) throw new Error("The Authworks test fixture could not be created.")
  const environmentDirectory = join(directory, ".config", "authworks")
  await mkdir(environmentDirectory, { mode: 0o700, recursive: true })
  await writeFile(join(environmentDirectory, "authworks.env"), `AUTHWORKS_SYSTEM_SECRET=${systemSecret}\n`, {
    mode: 0o600,
  })
  const applicationFetch = async (input: string | URL | Request, init?: RequestInit) =>
    await created.data.fetch(new Request(input, init))
  const realmApi = realmApiClientCreate({ baseUrl: productionOrigin, fetch: applicationFetch, token: systemSecret })
  const realm = await realmApi.realmCreate({ domain: "authworks.contentoren.de", name: "Production" })
  if (!realm.success) throw new Error("The production realm fixture could not be created.")
  let ensureRequests = 0
  const observedFetch = async (input: string | URL | Request, init?: RequestInit) => {
    const request = new Request(input, init)
    if (request.method === "POST" && new URL(request.url).pathname.endsWith("/signing-keys/ensure-active"))
      ensureRequests += 1
    return await created.data.fetch(request)
  }
  return {
    directory,
    observedFetch,
    oidcApi: oidcApiClientCreate({ baseUrl: productionOrigin, fetch: applicationFetch, token: systemSecret }),
    realmId: realm.data.realm.id,
    remove: async () => await rm(directory, { force: true, recursive: true }),
    get ensureRequests() {
      return ensureRequests
    },
  }
}

async function ensureRun(fixture: Awaited<ReturnType<typeof productionFixtureCreate>>, fetch = fixture.observedFetch) {
  return await oidcProductionSigningKeyEnsure({ fetch, homeDirectory: fixture.directory })
}
