import { expect, test } from "bun:test"
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { serverApplicationCreate } from "../../src/compositions/serverApplicationCreate.js"
import { oidcApiClientCreate } from "../../src/features/oidc/client/oidcApiClientCreate.js"
import { oidcCodelineProductionSecretRotate } from "../../src/features/oidc/cli/oidcCodelineProductionSecretRotate.js"
import { realmApiClientCreate } from "../../src/features/realms/client/realmApiClientCreate.js"

const systemSecret = "production-rotation-secret-00000000"
const productionOrigin = "https://authworks.contentoren.de"
const callback = "https://preview.codeline.work/api/auth/callback"

test("production Codeline rotation rotates only the exact client and hands off its secret once", async () => {
  const fixture = await productionFixtureCreate()
  try {
    const created = await fixture.oidcApi.oidcClientCreate(
      fixture.realmId,
      clientInputCreate({ clientType: "confidential", name: "Codeline preview", redirectUris: [callback] }),
    )
    expect(created.success).toBe(true)
    if (!created.success || created.data.clientSecret === undefined) return
    const previousSecret = created.data.clientSecret
    const envelopes: string[] = []
    const result = await oidcCodelineProductionSecretRotate({
      credentialEnvelopeWrite: (envelope) => envelopes.push(envelope),
      fetch: fixture.observedFetch,
      homeDirectory: fixture.directory,
    })

    expect(result.success).toBe(true)
    expect(fixture.rotationRequests).toBe(1)
    expect(envelopes).toHaveLength(1)
    const envelope = JSON.parse(envelopes[0] ?? "") as Record<string, unknown>
    expect(Object.keys(envelope).sort()).toEqual(["clientId", "clientSecret", "kind", "version"])
    expect(envelope).toMatchObject({
      clientId: created.data.client.id,
      kind: "authworks.codeline-oidc-credential",
      version: 1,
    })
    expect(envelope.clientSecret).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(envelope.clientSecret).not.toBe(previousSecret)
    expect(JSON.stringify(result)).not.toContain(String(envelope.clientSecret))
  } finally {
    await fixture.remove()
  }
})

test("production Codeline rotation maps every client refusal before mutation", async () => {
  const scenarios = [
    ["missing", "client-not-found"],
    ["public", "client-public"],
    ["wrong-name", "client-name-mismatch"],
    ["wrong-callback", "client-callback-mismatch"],
    ["extra-callback", "client-cardinality-mismatch"],
    ["inactive", "client-inactive"],
    ["ambiguous", "client-ambiguous"],
  ] as const
  for (const [scenario, suffix] of scenarios) {
    const fixture = await productionFixtureCreate()
    try {
      if (scenario === "missing") {
        const result = await rotationRun(fixture)
        expectFailure(result, suffix)
        expect(fixture.rotationRequests).toBe(0)
        continue
      }
      const target = await fixture.oidcApi.oidcClientCreate(
        fixture.realmId,
        clientInputCreate({
          clientType: scenario === "public" ? "public" : "confidential",
          name: scenario === "wrong-name" ? "Callback owner" : "Codeline preview",
          redirectUris:
            scenario === "wrong-callback"
              ? ["https://wrong.example/callback"]
              : scenario === "extra-callback"
                ? [callback, "https://extra.example/callback"]
                : [callback],
        }),
      )
      expect(target.success).toBe(true)
      if (!target.success) continue
      if (scenario === "inactive") {
        const inactive = await fixture.oidcApi.oidcClientLifecycleSet(fixture.realmId, target.data.client.id, {
          status: "inactive",
        })
        expect(inactive.success).toBe(true)
      }
      if (scenario === "ambiguous") {
        const conflict = await fixture.oidcApi.oidcClientCreate(
          fixture.realmId,
          clientInputCreate({ clientType: "confidential", name: "Callback owner", redirectUris: [callback] }),
        )
        expect(conflict.success).toBe(true)
      }
      const result = await rotationRun(fixture)
      expectFailure(result, suffix)
      expect(fixture.rotationRequests).toBe(0)
    } finally {
      await fixture.remove()
    }
  }
})

test("production Codeline rotation CLI emits only its canonical configuration failure", async () => {
  const failed = Bun.spawn(["bun", "src/outputs/cli.ts", "oidc", "codeline-production-secret-rotate"], {
    stderr: "pipe",
    stdout: "pipe",
  })
  const [failedExitCode, failedStderr, failedStdout] = await Promise.all([
    failed.exited,
    new Response(failed.stderr).text(),
    new Response(failed.stdout).text(),
  ])
  expect(failedExitCode).toBe(40)
  expect(failedStdout).toBe("")
  expect(failedStderr).toBe('{"error":{"code":"oidc.codeline-secret-rotate.input-invalid"}}\n')

  const configured = Bun.spawn(
    ["bun", "src/outputs/cli.ts", "oidc", "codeline-production-secret-rotate", "--client-id", "other"],
    { stderr: "pipe", stdout: "pipe" },
  )
  const [configuredExitCode, configuredStderr, configuredStdout] = await Promise.all([
    configured.exited,
    new Response(configured.stderr).text(),
    new Response(configured.stdout).text(),
  ])
  expect(configuredExitCode).not.toBe(0)
  expect(configuredStdout).toBe("")
  expect(configuredStderr).toContain("No flag registered for --client-id")
})

test("production Codeline rotation maps realm and API failures without mutation", async () => {
  const scenarios = [
    ["realm-not-found", "realm-not-found"],
    ["realm-ambiguous", "realm-ambiguous"],
    ["realm-inactive", "realm-inactive"],
    ["api-unauthorized", "api-unauthorized"],
    ["api-unreachable", "api-unreachable"],
    ["api-invalid-response", "api-invalid-response"],
  ] as const
  for (const [scenario, suffix] of scenarios) {
    const fixture = await productionFixtureCreate()
    try {
      const result = await rotationRun(fixture, async (input, init) => {
        const request = new Request(input, init)
        if (request.method === "GET" && new URL(request.url).pathname === "/system/realms") {
          if (scenario === "realm-not-found") return Response.json({ items: [] })
          if (scenario === "api-unauthorized") return Response.json({ error: { code: "private" } }, { status: 401 })
          if (scenario === "api-unreachable") throw new Error("private")
          if (scenario === "api-invalid-response") return Response.json({ private: true })
          const source = (await (await fixture.observedFetch(request)).json()) as { items: Record<string, unknown>[] }
          if (scenario === "realm-ambiguous") return Response.json({ items: [...source.items, ...source.items] })
          return Response.json({ items: source.items.map((realm) => ({ ...realm, status: "disabled" })) })
        }
        return await fixture.observedFetch(request)
      })
      expectFailure(result, suffix)
      expect(fixture.rotationRequests).toBe(0)
    } finally {
      await fixture.remove()
    }
  }
})

test("production Codeline rotation separates rejected API and invalid envelope failures", async () => {
  for (const [scenario, suffix] of [
    ["rejected", "rotation-rejected"],
    ["envelope", "envelope-invalid"],
  ] as const) {
    const fixture = await productionFixtureCreate()
    try {
      const created = await fixture.oidcApi.oidcClientCreate(
        fixture.realmId,
        clientInputCreate({ clientType: "confidential", name: "Codeline preview", redirectUris: [callback] }),
      )
      expect(created.success).toBe(true)
      const result = await rotationRun(fixture, async (input, init) => {
        const request = new Request(input, init)
        if (request.method === "POST" && new URL(request.url).pathname.endsWith("/secret/rotate")) {
          if (scenario === "rejected") return Response.json({ error: { code: "private" } }, { status: 409 })
          const source = (await (await fixture.observedFetch(request)).json()) as Record<string, unknown>
          return Response.json({ ...source, clientSecret: "x".repeat(44) })
        }
        return await fixture.observedFetch(request)
      })
      expectFailure(result, suffix)
    } finally {
      await fixture.remove()
    }
  }
})

test("production Codeline rotation closes a failed credential handoff as internal", async () => {
  const fixture = await productionFixtureCreate()
  try {
    const created = await fixture.oidcApi.oidcClientCreate(
      fixture.realmId,
      clientInputCreate({ clientType: "confidential", name: "Codeline preview", redirectUris: [callback] }),
    )
    expect(created.success).toBe(true)
    const result = await oidcCodelineProductionSecretRotate({
      credentialEnvelopeWrite: () => {
        throw new Error("private")
      },
      fetch: fixture.observedFetch,
      homeDirectory: fixture.directory,
    })
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.code).toBe("oidc.codeline-secret-rotate.internal-failed")
    expect(fixture.rotationRequests).toBe(1)
  } finally {
    await fixture.remove()
  }
})

test("production Codeline rotation refuses symbolic system-secret path components before network access", async () => {
  const directory = await mkdtemp(join(tmpdir(), "authworks-codeline-rotation-symlink-"))
  const protectedDirectory = join(directory, "protected", "authworks")
  const envelopes: string[] = []
  try {
    await mkdir(protectedDirectory, { mode: 0o700, recursive: true })
    await writeFile(join(protectedDirectory, "authworks.env"), `AUTHWORKS_SYSTEM_SECRET=${systemSecret}\n`, {
      mode: 0o600,
    })
    await symlink(join(directory, "protected"), join(directory, ".config"))
    const result = await oidcCodelineProductionSecretRotate({
      credentialEnvelopeWrite: (envelope) => envelopes.push(envelope),
      fetch: async () => {
        throw new Error("Network access must not occur.")
      },
      homeDirectory: directory,
    })
    expect(result.success).toBe(false)
    expect(envelopes).toEqual([])
  } finally {
    await rm(directory, { force: true, recursive: true })
  }
})

async function productionFixtureCreate() {
  const directory = await mkdtemp(join(tmpdir(), "authworks-codeline-rotation-"))
  const created = serverApplicationCreate({ databasePath: join(directory, "authworks.sqlite"), systemSecret })
  if (!created.success) throw new Error("The Authworks test fixture could not be created.")
  await productionEnvironmentWrite(directory)
  const applicationFetch = async (input: string | URL | Request, init?: RequestInit) =>
    await created.data.fetch(new Request(input, init))
  const realmApi = realmApiClientCreate({ baseUrl: productionOrigin, fetch: applicationFetch, token: systemSecret })
  const realm = await realmApi.realmCreate({ domain: "authworks.contentoren.de", name: "Production" })
  if (!realm.success) throw new Error("The production realm fixture could not be created.")
  let rotationRequests = 0
  const observedFetch = async (input: string | URL | Request, init?: RequestInit) => {
    const request = new Request(input, init)
    if (request.method === "POST" && new URL(request.url).pathname.endsWith("/secret/rotate")) rotationRequests += 1
    return await created.data.fetch(request)
  }
  return {
    directory,
    observedFetch,
    oidcApi: oidcApiClientCreate({ baseUrl: productionOrigin, fetch: applicationFetch, token: systemSecret }),
    realmId: realm.data.realm.id,
    remove: async () => await rm(directory, { force: true, recursive: true }),
    get rotationRequests() {
      return rotationRequests
    },
  }
}

async function rotationRun(
  fixture: Awaited<ReturnType<typeof productionFixtureCreate>>,
  fetch = fixture.observedFetch,
) {
  const envelopes: string[] = []
  const result = await oidcCodelineProductionSecretRotate({
    credentialEnvelopeWrite: (envelope) => envelopes.push(envelope),
    fetch,
    homeDirectory: fixture.directory,
  })
  return { envelopes, result }
}

function expectFailure(run: Awaited<ReturnType<typeof rotationRun>>, suffix: string): void {
  expect(run.result.success).toBe(false)
  if (run.result.success) return
  expect(run.result.code).toBe(`oidc.codeline-secret-rotate.${suffix}`)
  expect(run.envelopes).toEqual([])
}

function clientInputCreate(options: {
  readonly clientType: "confidential" | "public"
  readonly name: string
  readonly redirectUris: string[]
}) {
  return {
    allowedScopes: ["openid", "profile", "email", "urn:zitadel:iam:user:resourceowner"],
    clientType: options.clientType,
    name: options.name,
    postLogoutRedirectUris: [],
    redirectUris: options.redirectUris,
    requireConsent: false,
    trusted: true,
  }
}

async function productionEnvironmentWrite(directory: string): Promise<void> {
  const environmentDirectory = join(directory, ".config", "authworks")
  await mkdir(environmentDirectory, { mode: 0o700, recursive: true })
  await writeFile(join(environmentDirectory, "authworks.env"), `AUTHWORKS_SYSTEM_SECRET=${systemSecret}\n`, {
    mode: 0o600,
  })
}
