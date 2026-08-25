import { expect, test } from "bun:test"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { serverApplicationCreate } from "../../src/compositions/serverApplicationCreate.js"
import { oidcApiClientCreate } from "../../src/features/oidc/client/oidcApiClientCreate.js"
import { oidcCodelineProductionClientEnsure } from "../../src/features/oidc/cli/oidcCodelineProductionClientEnsure.js"
import { realmApiClientCreate } from "../../src/features/realms/client/realmApiClientCreate.js"

const systemSecret = "production-system-secret-00000000"
const productionOrigin = "https://authworks.contentoren.de"

test("production Codeline ensure hands off a new secret once and refuses ambiguous clients", async () => {
  const directory = await mkdtemp(join(tmpdir(), "authworks-codeline-production-"))
  const created = serverApplicationCreate({
    databasePath: join(directory, "authworks.sqlite"),
    systemSecret,
  })
  expect(created.success).toBe(true)
  if (!created.success) {
    await rm(directory, { force: true, recursive: true })
    return
  }
  await productionEnvironmentWrite(directory, systemSecret)
  const applicationFetch = async (input: string | URL | Request, init?: RequestInit) =>
    await created.data.fetch(new Request(input, init))
  const realmApi = realmApiClientCreate({ baseUrl: productionOrigin, fetch: applicationFetch, token: systemSecret })

  try {
    const realm = await realmApi.realmCreate({ domain: "authworks.contentoren.de", name: "Production" })
    expect(realm.success).toBe(true)
    if (!realm.success) return

    const envelopes: string[] = []
    const first = await oidcCodelineProductionClientEnsure({
      credentialEnvelopeWrite: (envelope) => envelopes.push(envelope),
      fetch: applicationFetch,
      homeDirectory: directory,
    })
    expect(first.success).toBe(true)
    if (!first.success) return
    expect(first.data).toEqual({ action: "created", realmId: realm.data.realm.id })
    expect(envelopes).toHaveLength(1)
    const credential = JSON.parse(envelopes[0] ?? "") as Record<string, unknown>
    expect(Object.keys(credential).sort()).toEqual(["clientId", "clientSecret", "kind", "version"])
    expect(credential.kind).toBe("authworks.codeline-oidc-credential")
    expect(credential.version).toBe(1)
    expect(credential.clientSecret).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(JSON.stringify(first)).not.toContain(String(credential.clientSecret))

    const second = await oidcCodelineProductionClientEnsure({
      credentialEnvelopeWrite: (envelope) => envelopes.push(envelope),
      fetch: applicationFetch,
      homeDirectory: directory,
    })
    expect(second.success).toBe(true)
    if (second.success) expect(second.data.action).toBe("unchanged")
    expect(envelopes).toHaveLength(1)

    const oidcApi = oidcApiClientCreate({ baseUrl: productionOrigin, fetch: applicationFetch, token: systemSecret })
    const conflicting = await oidcApi.oidcClientCreate(realm.data.realm.id, {
      allowedScopes: ["openid"],
      clientType: "confidential",
      name: "Conflicting callback owner",
      postLogoutRedirectUris: [],
      redirectUris: ["https://preview.codeline.work/api/auth/callback"],
      requireConsent: false,
      trusted: true,
    })
    expect(conflicting.success).toBe(true)

    const ambiguous = await oidcCodelineProductionClientEnsure({
      credentialEnvelopeWrite: (envelope) => envelopes.push(envelope),
      fetch: applicationFetch,
      homeDirectory: directory,
    })
    expect(ambiguous.success).toBe(false)
    if (!ambiguous.success) expect(ambiguous.errorMessage).toContain("More than one OIDC client")
    expect(envelopes).toHaveLength(1)
  } finally {
    await rm(directory, { force: true, recursive: true })
  }
})

test("production Codeline ensure refuses ambiguous realms and system secrets without a handoff", async () => {
  const directory = await mkdtemp(join(tmpdir(), "authworks-codeline-production-ambiguity-"))
  const envelopes: string[] = []
  try {
    await productionEnvironmentWrite(
      directory,
      `${systemSecret}\nAUTHWORKS_SYSTEM_SECRET=second-production-secret-000000`,
    )
    const secretAmbiguous = await oidcCodelineProductionClientEnsure({
      credentialEnvelopeWrite: (envelope) => envelopes.push(envelope),
      fetch: async () => {
        throw new Error("fetch must not run")
      },
      homeDirectory: directory,
    })
    expect(secretAmbiguous.success).toBe(false)
    expect(envelopes).toHaveLength(0)

    await productionEnvironmentWrite(directory, systemSecret)
    const ambiguousRealms = await oidcCodelineProductionClientEnsure({
      credentialEnvelopeWrite: (envelope) => envelopes.push(envelope),
      fetch: async () =>
        Response.json({
          items: [
            realmCreate("018f0f4d-7b2a-7abc-8def-0123456789ab"),
            realmCreate("018f0f4d-7b2a-7abc-8def-0123456789ac"),
          ],
        }),
      homeDirectory: directory,
    })
    expect(ambiguousRealms.success).toBe(false)
    if (!ambiguousRealms.success) expect(ambiguousRealms.errorMessage).toContain("More than one realm")
    expect(envelopes).toHaveLength(0)
  } finally {
    await rm(directory, { force: true, recursive: true })
  }
})

test("production Codeline ensure CLI accepts no caller-controlled configuration", async () => {
  const child = Bun.spawn(
    ["bun", "src/outputs/cli.ts", "oidc", "codeline-production-ensure", "--server", "https://other.example"],
    { stderr: "pipe", stdout: "pipe" },
  )
  const [exitCode, stderr, stdout] = await Promise.all([
    child.exited,
    new Response(child.stderr).text(),
    new Response(child.stdout).text(),
  ])
  expect(exitCode).not.toBe(0)
  expect(stdout).toBe("")
  expect(stderr).toContain("No flag registered for --server")
})

async function productionEnvironmentWrite(directory: string, secretLines: string): Promise<void> {
  const environmentDirectory = join(directory, ".config", "authworks")
  await mkdir(environmentDirectory, { mode: 0o700, recursive: true })
  await writeFile(join(environmentDirectory, "authworks.env"), `AUTHWORKS_SYSTEM_SECRET=${secretLines}\n`, {
    mode: 0o600,
  })
}

function realmCreate(id: string) {
  return {
    createdAt: 1,
    domain: "authworks.contentoren.de",
    domains: ["authworks.contentoren.de"],
    id,
    name: "Production",
    status: "active",
    updatedAt: 1,
  }
}
