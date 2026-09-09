import { expect, test } from "bun:test"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { serverApplicationCreate } from "../../src/compositions/serverApplicationCreate.js"
import { oidcMultichatDevelopmentClientEnsure } from "../../src/features/oidc/cli/oidcMultichatDevelopmentClientEnsure.js"
import { oidcMultichatDevelopmentSecretRotate } from "../../src/features/oidc/cli/oidcMultichatDevelopmentSecretRotate.js"
import { oidcMultichatProductionClientEnsure } from "../../src/features/oidc/cli/oidcMultichatProductionClientEnsure.js"
import { oidcMultichatProductionOrganizationIdGet } from "../../src/features/oidc/cli/oidcMultichatProductionOrganizationIdGet.js"
import { oidcMultichatProductionSecretRotate } from "../../src/features/oidc/cli/oidcMultichatProductionSecretRotate.js"
import { oidcApiClientCreate } from "../../src/features/oidc/client/oidcApiClientCreate.js"
import { organizationApiClientCreate } from "../../src/features/organizations/client/organizationApiClientCreate.js"
import { realmApiClientCreate } from "../../src/features/realms/client/realmApiClientCreate.js"

const systemSecret = "multichat-production-system-secret-0001"
const productionOrigin = "https://authworks.contentoren.de"

test("Multichat production and development clients are separate fixed confidential clients", async () => {
  const fixture = await productionFixtureCreate()
  try {
    const productionEnvelopes: string[] = []
    const production = await oidcMultichatProductionClientEnsure({
      credentialEnvelopeWrite: (envelope) => productionEnvelopes.push(envelope),
      fetch: fixture.fetch,
      homeDirectory: fixture.directory,
    })
    expect(production.success).toBe(true)
    expect(productionEnvelopes).toHaveLength(1)
    expect(productionEnvelopes[0]).toContain('"kind":"authworks.multichat-production-oidc-credential"')

    const developmentEnvelopes: string[] = []
    const development = await oidcMultichatDevelopmentClientEnsure({
      credentialEnvelopeWrite: (envelope) => developmentEnvelopes.push(envelope),
      fetch: fixture.fetch,
      homeDirectory: fixture.directory,
    })
    expect(development.success).toBe(true)
    expect(developmentEnvelopes).toHaveLength(1)
    expect(developmentEnvelopes[0]).toContain('"kind":"authworks.multichat-development-oidc-credential"')
    expect(developmentEnvelopes[0]).not.toBe(productionEnvelopes[0])

    const clients = await fixture.oidc.oidcClientList(fixture.realmId)
    expect(clients.success).toBe(true)
    if (!clients.success) return
    const productionClient = clients.data.items.find((client) => client.name === "Multichat production")
    const developmentClient = clients.data.items.find((client) => client.name === "Multichat development")
    expect(productionClient?.redirectUris).toEqual(["https://multichat.contentoren.de/login/authworks/callback"])
    expect(developmentClient?.redirectUris).toEqual([
      "http://127.0.0.1:3007/login/authworks/callback",
      "https://preview.multichat.leonardomora.de/login/authworks/callback",
    ])
    expect(productionClient?.allowedScopes).toEqual([
      "openid",
      "profile",
      "email",
      "offline_access",
      "urn:zitadel:iam:user:resourceowner",
    ])
    expect(developmentClient?.allowedScopes).toEqual(productionClient?.allowedScopes)

    const secondProduction = await oidcMultichatProductionClientEnsure({
      credentialEnvelopeWrite: (envelope) => productionEnvelopes.push(envelope),
      fetch: fixture.fetch,
      homeDirectory: fixture.directory,
    })
    expect(secondProduction.success).toBe(true)
    expect(secondProduction).toMatchObject({ data: { action: "unchanged" }, success: true })
    expect(productionEnvelopes).toHaveLength(1)
    expect(JSON.stringify(secondProduction)).not.toContain(
      productionEnvelopes[0]?.split('"clientSecret":"')[1]?.split('"')[0] ?? "",
    )

    const unrelated = await fixture.oidc.oidcClientCreate(fixture.realmId, {
      allowedScopes: ["openid"],
      clientType: "confidential",
      name: "Codeline preview",
      postLogoutRedirectUris: [],
      redirectUris: ["https://preview.codeline.work/api/auth/callback"],
      requireConsent: true,
      trusted: false,
    })
    expect(unrelated.success).toBe(true)
    if (!unrelated.success) return
    const unrelatedBefore = await fixture.oidc.oidcClientGet(fixture.realmId, unrelated.data.client.id)
    expect(unrelatedBefore.success).toBe(true)
    if (!unrelatedBefore.success) return

    const productionRotationEnvelopes: string[] = []
    const productionRotation = await oidcMultichatProductionSecretRotate({
      credentialEnvelopeWrite: (envelope) => productionRotationEnvelopes.push(envelope),
      fetch: fixture.fetch,
      homeDirectory: fixture.directory,
    })
    expect(productionRotation.success).toBe(true)
    expect(productionRotationEnvelopes).toHaveLength(1)
    expect(productionRotationEnvelopes[0]).not.toBe(productionEnvelopes[0])
    expect(JSON.parse(productionRotationEnvelopes[0] ?? "{}").clientId).toBe(productionClient?.id)

    const developmentRotationEnvelopes: string[] = []
    const developmentRotation = await oidcMultichatDevelopmentSecretRotate({
      credentialEnvelopeWrite: (envelope) => developmentRotationEnvelopes.push(envelope),
      fetch: fixture.fetch,
      homeDirectory: fixture.directory,
    })
    expect(developmentRotation.success).toBe(true)
    expect(developmentRotationEnvelopes).toHaveLength(1)
    expect(JSON.parse(developmentRotationEnvelopes[0] ?? "{}").clientId).toBe(developmentClient?.id)

    const unrelatedAfter = await fixture.oidc.oidcClientGet(fixture.realmId, unrelated.data.client.id)
    expect(unrelatedAfter.success).toBe(true)
    if (!unrelatedAfter.success || unrelatedAfter.status !== "current" || unrelatedBefore.status !== "current") return
    expect(unrelatedAfter.data).toEqual(unrelatedBefore.data)
  } finally {
    await fixture.close()
  }
})

test("Multichat production secret recovery refuses a missing dedicated client before rotation", async () => {
  const fixture = await productionFixtureCreate()
  try {
    let rotationRequests = 0
    const fetch = async (input: string | URL | Request, init?: RequestInit) => {
      const request = new Request(input, init)
      if (request.method === "POST" && new URL(request.url).pathname.endsWith("/secret/rotate")) rotationRequests += 1
      return await fixture.fetch(request)
    }
    const envelopes: string[] = []
    const result = await oidcMultichatProductionSecretRotate({
      credentialEnvelopeWrite: (envelope) => envelopes.push(envelope),
      fetch,
      homeDirectory: fixture.directory,
    })

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.code).toBe("oidc.not-found")
    expect(rotationRequests).toBe(0)
    expect(envelopes).toEqual([])
  } finally {
    await fixture.close()
  }
})

test("Multichat organization handoff reads the active Contentoren organization without mutation", async () => {
  const fixture = await productionFixtureCreate()
  try {
    const methods: string[] = []
    const result = await oidcMultichatProductionOrganizationIdGet({
      fetch: async (input, init) => {
        const request = new Request(input, init)
        methods.push(request.method)
        return await fixture.fetch(request)
      },
      homeDirectory: fixture.directory,
    })
    expect(result).toEqual({ data: { organizationId: fixture.organizationId }, success: true })
    expect(new Set(methods)).toEqual(new Set(["GET"]))
  } finally {
    await fixture.close()
  }
})

async function productionFixtureCreate() {
  const directory = await mkdtemp(join(tmpdir(), "authworks-multichat-production-"))
  const server = serverApplicationCreate({ databasePath: join(directory, "authworks.sqlite"), systemSecret })
  if (!server.success) throw new Error("The Authworks test server could not be created.")
  const environmentDirectory = join(directory, ".config", "authworks")
  await mkdir(environmentDirectory, { mode: 0o700, recursive: true })
  await writeFile(join(environmentDirectory, "authworks.env"), `AUTHWORKS_SYSTEM_SECRET=${systemSecret}\n`, {
    mode: 0o600,
  })
  const fetch = async (input: string | URL | Request, init?: RequestInit) =>
    await server.data.fetch(new Request(input, init))
  const clientOptions = { baseUrl: productionOrigin, fetch, token: systemSecret }
  const realms = realmApiClientCreate(clientOptions)
  const organizations = organizationApiClientCreate(clientOptions)
  const oidc = oidcApiClientCreate(clientOptions)
  const realm = await realms.realmCreate({ domain: "authworks.contentoren.de", name: "Production" })
  if (!realm.success) throw new Error("The production realm fixture could not be created.")
  const organization = await organizations.organizationCreate(realm.data.realm.id, { name: "Contentoren" })
  if (!organization.success) throw new Error("The Contentoren organization fixture could not be created.")
  return {
    async close() {
      server.data.stop()
      await rm(directory, { force: true, recursive: true })
    },
    directory,
    fetch,
    oidc,
    organizationId: organization.data.organization.id,
    realmId: realm.data.realm.id,
  }
}
