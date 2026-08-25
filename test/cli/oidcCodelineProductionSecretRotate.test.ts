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

test("production Codeline rotation refuses wrong type, callback, lifecycle, and ambiguity before mutation", async () => {
  for (const scenario of ["public", "wrong-callback", "inactive", "ambiguous"] as const) {
    const fixture = await productionFixtureCreate()
    try {
      const target = await fixture.oidcApi.oidcClientCreate(
        fixture.realmId,
        clientInputCreate({
          clientType: scenario === "public" ? "public" : "confidential",
          name: "Codeline preview",
          redirectUris: [scenario === "wrong-callback" ? "https://wrong.example/callback" : callback],
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
      const envelopes: string[] = []
      const result = await oidcCodelineProductionSecretRotate({
        credentialEnvelopeWrite: (envelope) => envelopes.push(envelope),
        fetch: fixture.observedFetch,
        homeDirectory: fixture.directory,
      })
      expect(result.success).toBe(false)
      expect(fixture.rotationRequests).toBe(0)
      expect(envelopes).toEqual([])
    } finally {
      await fixture.remove()
    }
  }
})

test("production Codeline rotation CLI is zero-argument and silent on operational failure", async () => {
  const failed = Bun.spawn(["bun", "src/outputs/cli.ts", "oidc", "codeline-production-secret-rotate"], {
    stderr: "pipe",
    stdout: "pipe",
  })
  const [failedExitCode, failedStderr, failedStdout] = await Promise.all([
    failed.exited,
    new Response(failed.stderr).text(),
    new Response(failed.stdout).text(),
  ])
  expect(failedExitCode).not.toBe(0)
  expect(failedStdout).toBe("")
  expect(failedStderr).toBe("")

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
