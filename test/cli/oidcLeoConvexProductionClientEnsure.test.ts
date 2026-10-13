import { expect, test } from "bun:test"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { serverApplicationCreate } from "../../src/compositions/serverApplicationCreate.js"
import { oidcLeoConvexProductionClientEnsure } from "../../src/features/oidc/cli/oidcLeoConvexProductionClientEnsure.js"
import { oidcApiClientCreate } from "../../src/features/oidc/client/oidcApiClientCreate.js"
import { realmApiClientCreate } from "../../src/features/realms/client/realmApiClientCreate.js"

const systemSecret = "production-system-secret-00000000"
const productionOrigin = "https://authworks.contentoren.de"
const expectedRedirectUris = [
  "https://api.preview.crm.contentoren.de/api/auth/authworks/callback",
  "https://crm.contentoren.de/auth/authworks/callback",
  "https://multichat.contentoren.de/login/authworks/callback",
  "https://multichat-api.leonardomora.de/api/session/callback",
  "https://multichat-api.contentoren.de/api/session/callback",
  "https://eventoren.leonardomora.de/login/zitadel/callback",
  "https://eventoren.de/login/zitadel/callback",
  "https://coachingcompany-api.leonardomora.de/api/auth/contentoren",
  "https://coachingcompany-api.contentoren.de/api/auth/contentoren",
  "https://api.preview.filmschauspielschule-v2.leonardomora.de/api/auth/contentoren",
  "https://filmschauspielschule-api.contentoren.de/api/auth/contentoren",
  "https://semesterkur.leonardomora.de/login/zitadel/callback",
  "https://semesterkur.com/login/zitadel/callback",
  "https://solid-convex-api.leonardomora.de/api/auth/oidc/callback",
  "https://solid-convex-api.contentoren.de/api/auth/oidc/callback",
  "https://archive-api.leonardomora.de/api/auth/oidc/callback",
  "https://archive-api.contentoren.de/api/auth/oidc/callback",
  "https://api.preview.allgroups.chat/api/auth/contentoren",
  "https://api.allgroups.chat/api/auth/contentoren",
]
const expectedScopes = ["openid", "profile", "email", "offline_access", "urn:zitadel:iam:user:resourceowner"]

test("Leo Convex production ensure creates the exact fixed policy and hands off only once", async () => {
  const directory = await mkdtemp(join(tmpdir(), "authworks-leo-convex-production-"))
  const created = serverApplicationCreate({ databasePath: join(directory, "authworks.sqlite"), systemSecret })
  expect(created.success).toBe(true)
  if (!created.success) {
    await rm(directory, { force: true, recursive: true })
    return
  }
  await productionEnvironmentWrite(directory, `AUTHWORKS_SYSTEM_SECRET=${systemSecret}\n`)
  const applicationFetch = async (input: string | URL | Request, init?: RequestInit) =>
    await created.data.fetch(new Request(input, init))

  try {
    const realms = realmApiClientCreate({ baseUrl: productionOrigin, fetch: applicationFetch, token: systemSecret })
    const realm = await realms.realmCreate({ domain: "authworks.contentoren.de", name: "Production" })
    expect(realm.success).toBe(true)
    if (!realm.success) return

    const envelopes: string[] = []
    const options = {
      credentialEnvelopeWrite: (envelope: string) => envelopes.push(envelope),
      fetch: applicationFetch,
      homeDirectory: directory,
    }
    const first = await oidcLeoConvexProductionClientEnsure(options)
    expect(first.success).toBe(true)
    if (!first.success) return
    expect(first.data).toEqual({ action: "created", realmId: realm.data.realm.id })
    expect(envelopes).toHaveLength(1)
    const envelope = JSON.parse(envelopes[0] ?? "") as Record<string, unknown>
    expect(Object.keys(envelope).sort()).toEqual(["clientId", "clientSecret", "kind", "version"])
    expect(envelope.kind).toBe("authworks.leo-convex-production-oidc-credential")
    expect(envelope.version).toBe(1)
    expect(envelope.clientSecret).toMatch(/^[A-Za-z0-9_-]{43}$/)

    const api = oidcApiClientCreate({ baseUrl: productionOrigin, fetch: applicationFetch, token: systemSecret })
    const listed = await api.oidcClientList(realm.data.realm.id)
    expect(listed.success).toBe(true)
    if (!listed.success) return
    const client = listed.data.items[0]
    expect(client).toBeDefined()
    expect(client).toMatchObject({
      accessTokenRoleAssertion: false,
      allowedScopes: expectedScopes,
      clientType: "confidential",
      idTokenUserinfoAssertion: true,
      name: "Leo Convex apps (migration testing)",
      postLogoutRedirectUris: [],
      redirectUris: expectedRedirectUris,
      requireConsent: false,
      trusted: true,
    })
    expect(client?.projectId).toBeUndefined()

    const drifted = await api.oidcClientUpdate(realm.data.realm.id, String(envelope.clientId), {
      idTokenUserinfoAssertion: false,
      redirectUris: ["https://wrong.example/callback"],
    })
    expect(drifted.success).toBe(true)
    const reconciled = await oidcLeoConvexProductionClientEnsure(options)
    expect(reconciled.success).toBe(true)
    if (reconciled.success) expect(reconciled.data.action).toBe("updated")
    expect(envelopes).toHaveLength(1)

    const repeated = await oidcLeoConvexProductionClientEnsure(options)
    expect(repeated.success).toBe(true)
    if (repeated.success) expect(repeated.data.action).toBe("unchanged")
    expect(envelopes).toHaveLength(1)
  } finally {
    await rm(directory, { force: true, recursive: true })
  }
})

test("Leo Convex production ensure sanitizes protected-secret, realm, and upstream failures", async () => {
  const directory = await mkdtemp(join(tmpdir(), "authworks-leo-convex-failures-"))
  const envelopes: string[] = []
  const write = (secretLines: string) => productionEnvironmentWrite(directory, secretLines)
  const options = {
    credentialEnvelopeWrite: (envelope: string) => envelopes.push(envelope),
    fetch: async () => {
      throw new Error("upstream-secret-and-response-body")
    },
    homeDirectory: directory,
  }
  try {
    await write(`AUTHWORKS_SYSTEM_SECRET=${systemSecret}\nAUTHWORKS_SYSTEM_SECRET=second-secret-value\n`)
    const invalidSecret = await oidcLeoConvexProductionClientEnsure(options)
    expect(invalidSecret.success).toBe(false)
    if (!invalidSecret.success) {
      expect(invalidSecret.errorMessage).toContain("protected production Authworks system-secret file")
      expect(invalidSecret.errorMessage).not.toContain("second-secret-value")
    }

    await write(`AUTHWORKS_SYSTEM_SECRET=${systemSecret}\n`)
    const failedRealm = await oidcLeoConvexProductionClientEnsure(options)
    expect(failedRealm.success).toBe(false)
    if (!failedRealm.success) {
      expect(failedRealm.errorMessage).toContain("authworks.contentoren.de")
      expect(failedRealm.errorMessage).not.toContain("upstream-secret-and-response-body")
    }
    expect(envelopes).toHaveLength(0)
  } finally {
    await rm(directory, { force: true, recursive: true })
  }
})

test("Leo Convex production ensure CLI rejects caller flags and documents the fixed command", async () => {
  const rejected = Bun.spawn(
    ["bun", "src/outputs/cli.ts", "oidc", "leo-convex-production-ensure", "--server", "https://other.example"],
    { stderr: "pipe", stdout: "pipe" },
  )
  const [exitCode, stderr, stdout] = await Promise.all([
    rejected.exited,
    new Response(rejected.stderr).text(),
    new Response(rejected.stdout).text(),
  ])
  expect(exitCode).not.toBe(0)
  expect(stdout).toBe("")
  expect(stderr).toContain("No flag registered for --server")

  const help = Bun.spawn(["bun", "src/outputs/cli.ts", "oidc", "leo-convex-production-ensure", "--help"], {
    stderr: "pipe",
    stdout: "pipe",
  })
  const [helpExitCode, helpText] = await Promise.all([help.exited, new Response(help.stdout).text()])
  expect(helpExitCode).toBe(0)
  expect(helpText).toContain("fixed production Leo Convex OIDC client")
})

async function productionEnvironmentWrite(directory: string, content: string): Promise<void> {
  const environmentDirectory = join(directory, ".config", "authworks")
  await mkdir(environmentDirectory, { mode: 0o700, recursive: true })
  await writeFile(join(environmentDirectory, "authworks.env"), content, { mode: 0o600 })
}
