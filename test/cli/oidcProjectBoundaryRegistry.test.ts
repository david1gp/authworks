import { expect, test } from "bun:test"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { serverApplicationCreate } from "../../src/compositions/serverApplicationCreate.js"
import { oidcProjectDevelopmentClientEnsure } from "../../src/features/oidc/cli/oidcProjectDevelopmentClientEnsure.js"
import { oidcProjectBoundaryRegistry } from "../../src/features/oidc/cli/oidcProjectBoundaryRegistry.js"
import { oidcProjectProductionClientEnsure } from "../../src/features/oidc/cli/oidcProjectProductionClientEnsure.js"
import { oidcApiClientCreate } from "../../src/features/oidc/client/oidcApiClientCreate.js"
import { organizationApiClientCreate } from "../../src/features/organizations/client/organizationApiClientCreate.js"
import { realmApiClientCreate } from "../../src/features/realms/client/realmApiClientCreate.js"

const systemSecret = "project-boundary-production-system-secret-0001"
const productionOrigin = "https://authworks.contentoren.de"
const legacyDevelopmentHostSuffix = ".leonardomora.de"
const migratedDevelopmentHostSuffix = ".wonder1.de"
const migratedDevelopmentAliasMinimum = 6

const expectedRedirectUris: Record<string, { development: string[]; production: string[] }> = {
  "assets-service": {
    development: ["https://assets-service.wonder1.de/api/v1/auth/authworks/callback"],
    production: ["https://assets-service.contentoren.de/api/v1/auth/authworks/callback"],
  },
  archive: {
    development: [
      "http://127.0.0.1:3243/api/auth/authworks/callback",
      "https://archive-api.leonardomora.de/api/auth/authworks/callback",
      "https://archive-api.wonder1.de/api/auth/authworks/callback",
    ],
    production: ["https://archive-api.contentoren.de/api/auth/authworks/callback"],
  },
  "allgroups-chat": {
    development: [
      "http://127.0.0.1:3017/login/authworks/callback",
      "https://preview.allgroups.chat/login/authworks/callback",
    ],
    production: ["https://allgroups.chat/login/authworks/callback"],
  },
  akademie: {
    development: ["https://akademie-api.wonder1.de/api/auth/authworks"],
    production: ["https://api.akademie.contentoren.de/api/auth/authworks"],
  },
  billing: {
    development: [],
    production: ["https://billing.contentoren.de/login/authworks/callback"],
  },
  coachingcompany: {
    development: [
      "http://127.0.0.1:3134/login/authworks/callback",
      "https://coachingcompany.leonardomora.de/login/authworks/callback",
      "https://coachingcompany-v2.wonder1.de/login/authworks/callback",
      "https://coachingcompany.wonder1.de/login/authworks/callback",
    ],
    production: ["https://coachingcompany.contentoren.de/login/authworks/callback"],
  },
  crm: {
    development: ["http://127.0.0.1:5173/auth/authworks/callback"],
    production: [
      "https://crm.contentoren.de/auth/authworks/callback",
      "https://crm-api.wonder1.de/api/auth/authworks/callback",
    ],
  },
  eventoren: {
    development: [
      "https://eventoren.leonardomora.de/login/authworks/callback",
      "https://eventoren.wonder1.de/login/authworks/callback",
    ],
    production: ["https://eventoren.de/login/authworks/callback"],
  },
  filmschauspielschule: {
    development: [
      "http://127.0.0.1:3132/login/authworks/callback",
      "https://filmschauspielschule.leonardomora.de/login/authworks/callback",
      "https://preview.filmschauspielschule-v2.wonder1.de/login/authworks/callback",
      "https://preview.filmschauspielschule.wonder1.de/login/authworks/callback",
    ],
    production: ["https://filmschauspielschule.contentoren.de/login/authworks/callback"],
  },
  multisub: {
    development: [
      "http://localhost:1455/auth/authworks/callback",
      "https://multisub-dev.leonardomora.de/auth/authworks/callback",
      "https://multisub-dev.wonder1.de/auth/authworks/callback",
    ],
    production: ["https://multisub.contentoren.de/auth/authworks/callback"],
  },
  sales: {
    development: [],
    production: ["https://api.sales.contentoren.de/login/authworks/callback"],
  },
  semesterkur: {
    development: [
      "http://127.0.0.1:3053/login/authworks/callback",
      "https://semesterkur.leonardomora.de/login/authworks/callback",
      "https://semesterkur.wonder1.de/login/authworks/callback",
    ],
    production: ["https://semesterkur.com/login/authworks/callback"],
  },
  services: {
    development: [],
    production: ["https://services.contentoren.de/login/authworks/callback"],
  },
  "site-crawler": {
    development: [],
    production: ["https://site-crawler.leonardomora.de/api/auth/authworks/callback"],
  },
  "solid-convex": {
    development: [
      "https://solid-convex-api.leonardomora.de/api/auth/authworks/callback",
      "https://solid-convex-api.wonder1.de/api/auth/authworks/callback",
    ],
    production: ["https://solid-convex-api.contentoren.de/api/auth/authworks/callback"],
  },
  work: {
    development: [],
    production: [
      "https://work.semesterkur.com/auth/authworks/callback",
      "https://work.wonder1.de/auth/authworks/callback",
    ],
  },
}

const expectedPostLogoutUris: Record<string, { development: string[]; production: string[] }> = {
  archive: { development: [], production: ["https://archive.contentoren.de"] },
  multisub: {
    development: ["https://multisub-dev.wonder1.de/", "https://multisub-dev.leonardomora.de/"],
    production: ["https://multisub.contentoren.de/"],
  },
}

test("project production and development boundaries register the fixed confidential clients", async () => {
  expect(Object.keys(oidcProjectBoundaryRegistry).sort()).toEqual(Object.keys(expectedRedirectUris).sort())
  const fixture = await productionFixtureCreate()
  try {
    for (const slug of Object.keys(expectedRedirectUris).sort()) {
      const expected = expectedRedirectUris[slug]
      if (expected === undefined) throw new Error(`Missing expected redirect URIs for ${slug}.`)
      const productionEnvelopes: string[] = []
      const production = await oidcProjectProductionClientEnsure({
        credentialEnvelopeWrite: (envelope) => productionEnvelopes.push(envelope),
        fetch: fixture.fetch,
        homeDirectory: fixture.directory,
        project: slug,
      })
      expect(production.success).toBe(true)
      expect(productionEnvelopes).toHaveLength(1)
      expect(productionEnvelopes[0]).toContain(`"kind":"authworks.${slug}-production-oidc-credential"`)

      // Slugs without a live development client keep an empty development
      // list, which the server rejects; only their production client is ensured.
      if (expected.development.length > 0) {
        const developmentEnvelopes: string[] = []
        const development = await oidcProjectDevelopmentClientEnsure({
          credentialEnvelopeWrite: (envelope) => developmentEnvelopes.push(envelope),
          fetch: fixture.fetch,
          homeDirectory: fixture.directory,
          project: slug,
        })
        expect(development.success).toBe(true)
        expect(developmentEnvelopes).toHaveLength(1)
        expect(developmentEnvelopes[0]).toContain(`"kind":"authworks.${slug}-development-oidc-credential"`)
        expect(developmentEnvelopes[0]).not.toBe(productionEnvelopes[0])
      }

      const secondProduction = await oidcProjectProductionClientEnsure({
        credentialEnvelopeWrite: (envelope) => productionEnvelopes.push(envelope),
        fetch: fixture.fetch,
        homeDirectory: fixture.directory,
        project: slug,
      })
      expect(secondProduction.success).toBe(true)
      expect(secondProduction).toMatchObject({ data: { action: "unchanged" }, success: true })
      expect(productionEnvelopes).toHaveLength(1)
      expect(JSON.stringify(secondProduction)).not.toContain(
        productionEnvelopes[0]?.split('"clientSecret":"')[1]?.split('"')[0] ?? "",
      )
    }

    const clients = await fixture.oidc.oidcClientList(fixture.realmId, { pageSize: 100 })
    expect(clients.success).toBe(true)
    if (!clients.success) return
    expect(clients.data.items).toHaveLength(27)
    for (const slug of Object.keys(expectedRedirectUris).sort()) {
      const expected = expectedRedirectUris[slug]
      if (expected === undefined) throw new Error(`Missing expected redirect URIs for ${slug}.`)
      const expectedPostLogout = expectedPostLogoutUris[slug] ?? { development: [], production: [] }
      const config = oidcProjectBoundaryRegistry[slug]
      const productionClient = clients.data.items.find((client) => client.name === config?.productionName)
      const developmentClient = clients.data.items.find((client) => client.name === config?.developmentName)
      expect(productionClient?.redirectUris).toEqual(expected.production)
      expect(productionClient?.postLogoutRedirectUris).toEqual(expectedPostLogout.production)
      const expectedScopes = config?.allowedScopes ?? [
        "openid",
        "profile",
        "email",
        "offline_access",
        "urn:zitadel:iam:user:resourceowner",
      ]
      expect(productionClient?.allowedScopes).toEqual([...expectedScopes])
      expect(productionClient?.clientType).toBe("confidential")
      if (expected.development.length > 0) {
        expect(developmentClient?.redirectUris).toEqual(expected.development)
        expect(developmentClient?.postLogoutRedirectUris).toEqual(expectedPostLogout.development)
        expect(developmentClient?.allowedScopes).toEqual(productionClient?.allowedScopes)
        expect(developmentClient?.clientType).toBe("confidential")
      } else {
        expect(developmentClient).toBeUndefined()
      }
    }
  } finally {
    await fixture.close()
  }
})

test("migrated development callbacks keep their same-prefix wonder1.de alias", () => {
  // These live production callbacks intentionally run on the wonder1 host.
  const productionWonder1Exempt = new Set(["crm", "work"])
  // These live development callbacks intentionally have no same-prefix wonder1.de alias.
  const legacyWithoutAlias = new Set(["https://filmschauspielschule.leonardomora.de/login/authworks/callback"])
  const entries = Object.values(oidcProjectBoundaryRegistry)
  const migratedAliases = entries.flatMap((entry) =>
    entry.developmentRedirectUris
      .filter((uri) => uri.includes(migratedDevelopmentHostSuffix))
      .map((alias) => ({ alias, slug: entry.slug })),
  )
  expect(migratedAliases.length).toBeGreaterThanOrEqual(migratedDevelopmentAliasMinimum)
  for (const entry of entries) {
    for (const legacy of entry.developmentRedirectUris.filter((uri) => uri.includes(legacyDevelopmentHostSuffix))) {
      const developmentRedirectUris = oidcProjectBoundaryRegistry[entry.slug]?.developmentRedirectUris ?? []
      expect(developmentRedirectUris).toContain(legacy)
      if (legacyWithoutAlias.has(legacy)) continue
      const alias = legacy.replace(legacyDevelopmentHostSuffix, migratedDevelopmentHostSuffix)
      expect(developmentRedirectUris).toContain(alias)
      expect(developmentRedirectUris.indexOf(legacy)).toBeLessThan(developmentRedirectUris.indexOf(alias))
    }
    if (!productionWonder1Exempt.has(entry.slug))
      expect(entry.productionRedirectUris.some((uri) => uri.includes(migratedDevelopmentHostSuffix))).toBe(false)
  }
})

test("project boundaries refuse an unknown project slug without mutation", async () => {
  const fixture = await productionFixtureCreate()
  try {
    const envelopes: string[] = []
    const production = await oidcProjectProductionClientEnsure({
      credentialEnvelopeWrite: (envelope) => envelopes.push(envelope),
      fetch: fixture.fetch,
      homeDirectory: fixture.directory,
      project: "unknown-project",
    })
    expect(production.success).toBe(false)
    const development = await oidcProjectDevelopmentClientEnsure({
      credentialEnvelopeWrite: (envelope) => envelopes.push(envelope),
      fetch: fixture.fetch,
      homeDirectory: fixture.directory,
      project: "unknown-project",
    })
    expect(development.success).toBe(false)
    expect(envelopes).toEqual([])

    const clients = await fixture.oidc.oidcClientList(fixture.realmId)
    expect(clients.success).toBe(true)
    if (!clients.success) return
    expect(clients.data.items).toEqual([])
  } finally {
    await fixture.close()
  }
})

async function productionFixtureCreate() {
  const directory = await mkdtemp(join(tmpdir(), "authworks-project-boundary-"))
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
