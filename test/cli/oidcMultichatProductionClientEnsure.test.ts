import { expect, test } from "bun:test"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { serverApplicationCreate } from "../../src/compositions/serverApplicationCreate.js"
import { oidcMultichatDevelopmentClientEnsure } from "../../src/features/oidc/cli/oidcMultichatDevelopmentClientEnsure.js"
import { oidcMultichatProductionClientEnsure } from "../../src/features/oidc/cli/oidcMultichatProductionClientEnsure.js"
import { oidcMultichatProductionOrganizationIdGet } from "../../src/features/oidc/cli/oidcMultichatProductionOrganizationIdGet.js"
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
    expect(productionEnvelopes).toHaveLength(1)
    expect(JSON.stringify(secondProduction)).not.toContain(
      productionEnvelopes[0]?.split('"clientSecret":"')[1]?.split('"')[0] ?? "",
    )
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
