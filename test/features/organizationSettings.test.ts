import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { emailOtpStart } from "../../src/features/emailOtp/actions/emailOtpStart.js"
import { externalIdentityProviderCreate } from "../../src/features/externalIdentities/actions/externalIdentityProviderCreate.js"
import { externalIdentityStart } from "../../src/features/externalIdentities/actions/externalIdentityStart.js"
import type { ExternalIdentityProviderPorts } from "../../src/features/externalIdentities/domain/externalIdentityProviderPort.js"
import { instanceCreate } from "../../src/features/instances/actions/instanceCreate.js"
import { instanceSystemContextCreate } from "../../src/features/instances/domain/instanceSystemContextCreate.js"
import { instanceTenantContextCreate } from "../../src/features/instances/domain/instanceTenantContextCreate.js"
import { organizationBrandingGet } from "../../src/features/organizations/actions/organizationBrandingGet.js"
import { organizationBrandingSet } from "../../src/features/organizations/actions/organizationBrandingSet.js"
import { organizationCreate } from "../../src/features/organizations/actions/organizationCreate.js"
import { organizationDomainClaim } from "../../src/features/organizations/actions/organizationDomainClaim.js"
import { organizationDomainDiscover } from "../../src/features/organizations/actions/organizationDomainDiscover.js"
import { organizationDomainRemove } from "../../src/features/organizations/actions/organizationDomainRemove.js"
import { organizationDomainVerify } from "../../src/features/organizations/actions/organizationDomainVerify.js"
import { organizationLoginPolicySet } from "../../src/features/organizations/actions/organizationLoginPolicySet.js"
import { organizationApiClientCreate } from "../../src/features/organizations/client/organizationApiClientCreate.js"
import type { OrganizationDomainDnsVerificationPort } from "../../src/features/organizations/domain/organizationDomainDnsVerificationPort.js"
import { organizationLoginPolicyEnforce } from "../../src/features/organizations/public/organizationLoginPolicyEnforce.js"
import { organizationServerAppCreate } from "../../src/features/organizations/server/organizationServerAppCreate.js"
import { passkeyAuthenticationStart } from "../../src/features/passkeys/actions/passkeyAuthenticationStart.js"
import { passwordLogin } from "../../src/features/passwords/actions/passwordLogin.js"
import { resultCreate } from "../../src/platform/errors/resultCreate.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageEventTable } from "../../src/platform/storage/storageEventTable.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

async function withDatabase<T>(
  operation: (database: StorageDatabase, testkit: ReturnType<typeof platformTestkitCreate>) => Promise<T>,
) {
  const directory = await mkdtemp(join(tmpdir(), "zitadel-v2-organization-settings-"))
  const testkit = platformTestkitCreate()
  const opened = storageDatabaseOpen(join(directory, "zitadel.sqlite"), testkit.runtime)
  expect(opened.success).toBe(true)
  if (!opened.success) throw new Error(opened.errorMessage)
  try {
    return await operation(opened.data, testkit)
  } finally {
    opened.data.close()
    await rm(directory, { force: true, recursive: true })
  }
}

async function createOrganization(database: StorageDatabase) {
  const instance = instanceCreate({
    context: instanceSystemContextCreate(),
    database,
    input: { domain: "instance.example.com", name: "Instance" },
  })
  expect(instance.success).toBe(true)
  if (!instance.success) throw new Error(instance.errorMessage)
  const organization = organizationCreate({
    context: instanceSystemContextCreate(),
    database,
    input: { name: "Organization" },
    instanceId: instance.data.instance.id,
  })
  expect(organization.success).toBe(true)
  if (!organization.success) throw new Error(organization.errorMessage)
  return { instance: instance.data.instance, organization: organization.data.organization }
}

const branding = {
  dark: {
    backgroundColor: "#111827",
    fontColor: "#f9fafb",
    icon: { contentType: "image/svg+xml", url: "https://assets.example.com/icon.svg" },
    logo: { contentType: "image/svg+xml", url: "https://assets.example.com/logo.svg" },
    primaryColor: "#60a5fa",
    warnColor: "#f87171",
  },
  disableWatermark: true,
  font: { contentType: "font/woff2", url: "https://assets.example.com/font.woff2" },
  legal: { privacyUrl: "https://example.com/privacy", termsUrl: "https://example.com/terms" },
  light: {
    backgroundColor: "#ffffff",
    fontColor: "#111827",
    icon: { contentType: "image/svg+xml", url: "https://assets.example.com/icon.svg" },
    logo: { contentType: "image/svg+xml", url: "https://assets.example.com/logo.svg" },
    primaryColor: "#2563eb",
    warnColor: "#dc2626",
  },
  themeMode: "system" as const,
}

test("branding and verified domain discovery are tenant-safe and DNS-port based", async () => {
  await withDatabase(async (database) => {
    const { instance, organization } = await createOrganization(database)
    const set = organizationBrandingSet({
      context: instanceSystemContextCreate(),
      database,
      input: branding,
      instanceId: instance.id,
      organizationId: organization.id,
    })
    expect(set.success).toBe(true)
    const claimed = organizationDomainClaim({
      context: instanceSystemContextCreate(),
      database,
      input: { domain: "Login.Example.com" },
      instanceId: instance.id,
      organizationId: organization.id,
    })
    expect(claimed.success).toBe(true)
    if (!claimed.success) return
    expect(claimed.data.domain.domain).toBe("login.example.com")
    expect(claimed.data.domain.verification?.recordValue).not.toBeUndefined()
    const port: OrganizationDomainDnsVerificationPort = {
      txtRecordsGet: async (recordName) => {
        expect(recordName).toBe("_zitadel-verification.login.example.com")
        return resultCreate([claimed.data.domain.verification?.recordValue ?? ""])
      },
    }
    expect(
      (
        await organizationDomainVerify({
          context: instanceSystemContextCreate(),
          database,
          dnsPort: port,
          domain: "login.example.com",
          instanceId: instance.id,
          organizationId: organization.id,
        })
      ).success,
    ).toBe(true)
    const discovered = organizationDomainDiscover({ database, domain: "LOGIN.EXAMPLE.COM" })
    expect(discovered).toMatchObject({ success: true, data: { found: true, organization: { id: organization.id } } })
    if (discovered.success && discovered.data.found) {
      expect(discovered.data.branding.disableWatermark).toBe(true)
      expect(discovered.data.providers).toEqual([])
    }
    expect(organizationDomainDiscover({ database, domain: "unverified.example.com" })).toEqual({
      data: { found: false },
      success: true,
    })
    expect(JSON.stringify(database.db.select().from(storageEventTable).all())).not.toContain(
      claimed.data.domain.verification?.recordValue ?? "never",
    )
  })
})

test("branding validation rejects insecure assets without changing the default", async () => {
  await withDatabase(async (database) => {
    const { instance, organization } = await createOrganization(database)
    const invalid = organizationBrandingSet({
      context: instanceSystemContextCreate(),
      database,
      input: { ...branding, fontUrl: "http://assets.example.com/font.woff2" },
      instanceId: instance.id,
      organizationId: organization.id,
    })
    expect(invalid.success).toBe(false)
    expect(
      organizationBrandingGet({ database, instanceId: instance.id, organizationId: organization.id }),
    ).toMatchObject({
      data: { branding: { disableWatermark: false }, version: 1 },
      success: true,
    })
  })
})

test("organization domains reject instance conflicts, preserve primary invariants, and require the DNS proof", async () => {
  await withDatabase(async (database) => {
    const { instance, organization } = await createOrganization(database)
    expect(
      organizationDomainClaim({
        context: instanceSystemContextCreate(),
        database,
        input: { domain: instance.domain },
        instanceId: instance.id,
        organizationId: organization.id,
      }).success,
    ).toBe(false)

    const primary = organizationDomainClaim({
      context: instanceSystemContextCreate(),
      database,
      input: { domain: "primary.example.com" },
      instanceId: instance.id,
      organizationId: organization.id,
    })
    const secondary = organizationDomainClaim({
      context: instanceSystemContextCreate(),
      database,
      input: { domain: "secondary.example.com", isPrimary: false },
      instanceId: instance.id,
      organizationId: organization.id,
    })
    expect(primary.success && secondary.success).toBe(true)
    expect(
      organizationDomainRemove({
        context: instanceSystemContextCreate(),
        database,
        domain: "primary.example.com",
        instanceId: instance.id,
        organizationId: organization.id,
      }).success,
    ).toBe(false)
    expect(
      organizationDomainRemove({
        context: instanceSystemContextCreate(),
        database,
        domain: "secondary.example.com",
        instanceId: instance.id,
        organizationId: organization.id,
      }).success,
    ).toBe(true)
    expect(
      organizationDomainRemove({
        context: instanceSystemContextCreate(),
        database,
        domain: "primary.example.com",
        instanceId: instance.id,
        organizationId: organization.id,
      }).success,
    ).toBe(true)

    const claimed = organizationDomainClaim({
      context: instanceSystemContextCreate(),
      database,
      input: { domain: "verified.example.com" },
      instanceId: instance.id,
      organizationId: organization.id,
    })
    expect(claimed.success).toBe(true)
    if (!claimed.success) return
    const token = claimed.data.domain.verification?.recordValue ?? ""
    const wrongProof = await organizationDomainVerify({
      context: instanceSystemContextCreate(),
      database,
      dnsPort: { txtRecordsGet: async () => resultCreate(["wrong-proof"]) },
      domain: "verified.example.com",
      instanceId: instance.id,
      organizationId: organization.id,
    })
    expect(wrongProof.success).toBe(false)
    expect(organizationDomainDiscover({ database, domain: "verified.example.com" })).toEqual({
      data: { found: false },
      success: true,
    })
    let calls = 0
    const verified = await organizationDomainVerify({
      context: instanceSystemContextCreate(),
      database,
      dnsPort: {
        txtRecordsGet: async () => {
          calls += 1
          return resultCreate([token])
        },
      },
      domain: "verified.example.com",
      instanceId: instance.id,
      organizationId: organization.id,
    })
    expect(verified.success).toBe(true)
    expect(
      (
        await organizationDomainVerify({
          context: instanceSystemContextCreate(),
          database,
          dnsPort: { txtRecordsGet: async () => resultCreate(["unused"]) },
          domain: "verified.example.com",
          instanceId: instance.id,
          organizationId: organization.id,
        })
      ).success,
    ).toBe(true)
    expect(calls).toBe(1)
  })
})

test("organization login policy inherits, overrides, filters providers, and blocks existing login methods", async () => {
  await withDatabase(async (database) => {
    const { instance, organization } = await createOrganization(database)
    const provider = externalIdentityProviderCreate({
      context: instanceSystemContextCreate(),
      database,
      input: {
        allowAccountCreation: true,
        clientId: "client",
        clientSecret: "secret",
        displayName: "Google",
        redirectUri: "https://app.example.com/callback",
        type: "google",
      },
      instanceId: instance.id,
    })
    expect(provider.success).toBe(true)
    if (!provider.success) return
    expect(
      organizationLoginPolicySet({
        context: instanceSystemContextCreate(),
        database,
        input: { allowPassword: false, providerIds: ["other-provider"] },
        instanceId: instance.id,
      }).success,
    ).toBe(true)
    expect(
      organizationLoginPolicyEnforce({
        database,
        instanceId: instance.id,
        method: "password",
      }).success,
    ).toBe(false)
    expect(
      organizationLoginPolicySet({
        context: instanceSystemContextCreate(),
        database,
        input: { allowPassword: true, providerIds: [provider.data.provider.id] },
        instanceId: instance.id,
        organizationId: organization.id,
      }).success,
    ).toBe(true)
    const partial = organizationLoginPolicySet({
      context: instanceSystemContextCreate(),
      database,
      input: { allowEmailOtp: false },
      instanceId: instance.id,
      organizationId: organization.id,
    })
    expect(partial).toMatchObject({
      data: { policy: { allowEmailOtp: false, allowPassword: true, providerIds: [provider.data.provider.id] } },
      success: true,
    })
    expect(
      organizationLoginPolicySet({
        context: instanceSystemContextCreate(),
        database,
        input: {},
        instanceId: instance.id,
        organizationId: organization.id,
      }).success,
    ).toBe(false)
    expect(
      organizationLoginPolicyEnforce({
        database,
        instanceId: instance.id,
        method: "password",
        organizationId: organization.id,
      }).success,
    ).toBe(true)
    expect(
      organizationLoginPolicyEnforce({
        database,
        instanceId: instance.id,
        method: "external_identity",
        organizationId: organization.id,
        providerId: "other-provider",
      }).success,
    ).toBe(false)
    const cleared = organizationLoginPolicySet({
      context: instanceSystemContextCreate(),
      database,
      input: { providerIds: null },
      instanceId: instance.id,
      organizationId: organization.id,
    })
    expect(cleared).toMatchObject({ data: { policy: { providerIds: ["other-provider"] } }, success: true })
    if (cleared.success) expect(cleared.data.overrides.providerIds).toBeUndefined()
    expect(
      passwordLogin({
        context: instanceTenantContextCreate(instance.id, "anonymous"),
        database,
        input: { identifier: "unknown", organizationId: undefined, password: "wrong" },
        instanceId: instance.id,
        organizationId: undefined,
      }).success,
    ).toBe(false)
    const disabled = organizationLoginPolicySet({
      context: instanceSystemContextCreate(),
      database,
      input: { allowEmailOtp: false, allowExternalIdentity: false, allowPasskey: false },
      instanceId: instance.id,
      organizationId: organization.id,
    })
    expect(disabled.success).toBe(true)
    expect(
      emailOtpStart({
        context: instanceTenantContextCreate(instance.id, "anonymous"),
        database,
        input: { email: "person@example.com", organizationId: organization.id },
        instanceId: instance.id,
      }).success,
    ).toBe(false)
    expect(
      (
        await passkeyAuthenticationStart({
          database,
          instanceId: instance.id,
          organizationId: organization.id,
          origins: ["https://app.example.com"],
          purpose: "passwordless",
          rpId: "app.example.com",
          rpName: "Example",
        })
      ).success,
    ).toBe(false)
    const ports: ExternalIdentityProviderPorts = {
      google: {
        authorizationUrlCreate: () => resultCreate("https://provider.example/authorize"),
        callbackExchange: async () =>
          resultCreate({
            emailVerified: true,
            externalSubject: "subject",
            providerType: "google",
          }),
      },
    }
    expect(
      externalIdentityStart({
        database,
        input: { organizationId: organization.id },
        instanceId: instance.id,
        providerId: provider.data.provider.id,
        providerPorts: ports,
      }).success,
    ).toBe(false)
  })
})

test("organization discovery honors its domain policy and provider allowlist", async () => {
  await withDatabase(async (database) => {
    const { instance, organization } = await createOrganization(database)
    const globalProvider = externalIdentityProviderCreate({
      context: instanceSystemContextCreate(),
      database,
      input: {
        allowAccountCreation: true,
        clientId: "global-client",
        clientSecret: "global-secret",
        displayName: "Google",
        redirectUri: "https://app.example.com/google",
        type: "google",
      },
      instanceId: instance.id,
    })
    const organizationProvider = externalIdentityProviderCreate({
      context: instanceSystemContextCreate(),
      database,
      input: {
        allowAccountCreation: true,
        clientId: "organization-client",
        clientSecret: "organization-secret",
        displayName: "GitHub",
        organizationId: organization.id,
        redirectUri: "https://app.example.com/github",
        type: "github",
      },
      instanceId: instance.id,
    })
    expect(globalProvider.success && organizationProvider.success).toBe(true)
    if (!globalProvider.success || !organizationProvider.success) return

    const claimed = organizationDomainClaim({
      context: instanceSystemContextCreate(),
      database,
      input: { domain: "discover.example.com" },
      instanceId: instance.id,
      organizationId: organization.id,
    })
    expect(claimed.success).toBe(true)
    if (!claimed.success) return
    const token = claimed.data.domain.verification?.recordValue ?? ""
    expect(
      (
        await organizationDomainVerify({
          context: instanceSystemContextCreate(),
          database,
          dnsPort: { txtRecordsGet: async () => resultCreate([token]) },
          domain: "discover.example.com",
          instanceId: instance.id,
          organizationId: organization.id,
        })
      ).success,
    ).toBe(true)

    expect(
      organizationLoginPolicySet({
        context: instanceSystemContextCreate(),
        database,
        input: { allowDomainDiscovery: false, providerIds: [organizationProvider.data.provider.id] },
        instanceId: instance.id,
        organizationId: organization.id,
      }).success,
    ).toBe(true)
    expect(organizationDomainDiscover({ database, domain: "discover.example.com" })).toEqual({
      data: { found: false },
      success: true,
    })

    expect(
      organizationLoginPolicySet({
        context: instanceSystemContextCreate(),
        database,
        input: { allowDomainDiscovery: true, providerIds: [organizationProvider.data.provider.id] },
        instanceId: instance.id,
        organizationId: organization.id,
      }).success,
    ).toBe(true)
    const discovered = organizationDomainDiscover({ database, domain: "discover.example.com" })
    expect(discovered).toMatchObject({ success: true, data: { found: true } })
    if (discovered.success && discovered.data.found) {
      expect(discovered.data.providers).toEqual([
        expect.objectContaining({ id: organizationProvider.data.provider.id, type: "github" }),
      ])
      expect(discovered.data.providers.some((provider) => provider.id === globalProvider.data.provider.id)).toBe(false)
    }
  })
})

test("branding, domain claims, and policies roll back with rejected events", async () => {
  await withDatabase(async (database) => {
    const { instance, organization } = await createOrganization(database)
    database.sqlite.run(
      "CREATE TRIGGER reject_organization_settings BEFORE INSERT ON events WHEN NEW.aggregate_type IN ('organization_branding', 'organization_domain', 'login_policy') BEGIN SELECT RAISE(ABORT, 'event rejected'); END",
    )
    expect(
      organizationBrandingSet({
        context: instanceSystemContextCreate(),
        database,
        input: branding,
        instanceId: instance.id,
        organizationId: organization.id,
      }).success,
    ).toBe(false)
    const brandingAfter = organizationBrandingGet({
      database,
      instanceId: instance.id,
      organizationId: organization.id,
    })
    expect(brandingAfter.success && brandingAfter.data.version).toBe(1)
    expect(
      organizationDomainClaim({
        context: instanceSystemContextCreate(),
        database,
        input: { domain: "rollback.example.com" },
        instanceId: instance.id,
        organizationId: organization.id,
      }).success,
    ).toBe(false)
    expect(database.sqlite.query("SELECT COUNT(*) AS count FROM organization_domains").get()).toEqual({ count: 0 })
    expect(
      organizationLoginPolicySet({
        context: instanceSystemContextCreate(),
        database,
        input: { allowPassword: false },
        instanceId: instance.id,
        organizationId: organization.id,
      }).success,
    ).toBe(false)
    expect(database.sqlite.query("SELECT COUNT(*) AS count FROM organization_login_policies").get()).toEqual({
      count: 0,
    })
  })
})

test("organization settings routes and clients preserve public contracts", async () => {
  await withDatabase(async (database) => {
    const { instance, organization } = await createOrganization(database)
    const app = organizationServerAppCreate({ database, systemSecret: "system-secret" })
    const client = organizationApiClientCreate({
      baseUrl: "https://server.example",
      fetch: async (input, init) => app.request(input.toString(), init),
      token: "system-secret",
    })
    const updated = await client.organizationBrandingSet(instance.id, organization.id, branding)
    expect(updated.success).toBe(true)
    const policy = await client.organizationLoginPolicySet(instance.id, organization.id, { allowPassword: false })
    expect(policy.success).toBe(true)
    const claimed = await client.organizationDomainClaim(instance.id, organization.id, { domain: "api.example.com" })
    expect(claimed.success).toBe(true)
    const discovery = await organizationApiClientCreate({
      baseUrl: "https://server.example",
      fetch: async (input, init) => app.request(input.toString(), { ...init, headers: { host: "api.example.com" } }),
    }).organizationDomainDiscover("api.example.com")
    expect(discovery).toMatchObject({ success: true, data: { found: false } })
    const unauthorized = await organizationApiClientCreate({
      baseUrl: "https://server.example",
      fetch: async (input, init) => app.request(input.toString(), init),
    }).organizationLoginPolicyGet(instance.id, organization.id)
    expect(unauthorized.success).toBe(false)
  })
  const helpProcess = Bun.spawn(["bun", "src/outputs/cli.ts", "organizations", "--help"], {
    stderr: "pipe",
    stdout: "pipe",
  })
  const helpOutput = await new Response(helpProcess.stdout).text()
  expect(await helpProcess.exited).toBe(0)
  expect(helpOutput).toContain("Claim an organization domain")
})
