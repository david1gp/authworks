import { describe, expect, test } from "bun:test"
import * as v from "valibot"
import { demoAdminOidcClients } from "../../src/features/demo/demoAdminOidcClients.js"
import { demoAdminOidcConsents } from "../../src/features/demo/demoAdminOidcConsents.js"
import { demoAdminOidcDiscovery } from "../../src/features/demo/demoAdminOidcDiscovery.js"
import { demoAdminOidcJwks } from "../../src/features/demo/demoAdminOidcJwks.js"
import { demoAdminOidcSigningKeys } from "../../src/features/demo/demoAdminOidcSigningKeys.js"
import { oidcClientSchema } from "../../src/features/oidc/public/oidcClientSchema.js"
import { oidcConsentSchema } from "../../src/features/oidc/public/oidcConsentSchema.js"
import { oidcDiscoverySchema } from "../../src/features/oidc/public/oidcDiscoverySchema.js"
import { oidcJwksSchema } from "../../src/features/oidc/public/oidcJwksSchema.js"
import { oidcSigningKeySchema } from "../../src/features/oidc/public/oidcSigningKeySchema.js"
import { oidcAdminDemoAdapterCreate } from "../../src/features/oidc/ui/oidcAdminDemoAdapterCreate.js"

const confidentialClientId = "01900000-0000-7000-8000-000000000041"
const publicClientId = "01900000-0000-7000-8000-000000000042"
const userId = "01900000-0000-7000-8000-000000000021"

describe("OIDC administration demo fixtures", () => {
  test("parse against the public transport schemas", () => {
    expect(v.safeParse(v.array(oidcClientSchema), demoAdminOidcClients).success).toBe(true)
    expect(v.safeParse(v.array(oidcSigningKeySchema), demoAdminOidcSigningKeys).success).toBe(true)
    expect(v.safeParse(v.array(oidcConsentSchema), demoAdminOidcConsents).success).toBe(true)
    expect(v.safeParse(oidcDiscoverySchema, demoAdminOidcDiscovery).success).toBe(true)
    expect(v.safeParse(oidcJwksSchema, demoAdminOidcJwks).success).toBe(true)
  })

  test("publish only active public keys and never private key material", () => {
    const activeKids = demoAdminOidcSigningKeys.filter((key) => key.status === "active").map((key) => key.id)
    expect(demoAdminOidcJwks.keys.map((key) => key.kid)).toEqual(activeKids)
    for (const key of demoAdminOidcJwks.keys)
      expect(Object.keys(key).sort()).toEqual(["alg", "e", "kid", "kty", "n", "use"])
  })

  test("expose exact redirect URIs without wildcards", () => {
    for (const client of demoAdminOidcClients) {
      expect(client.redirectUris.length).toBeGreaterThan(0)
      for (const uri of client.redirectUris) expect(uri).not.toContain("*")
    }
  })
})

describe("OIDC administration demo adapter", () => {
  test("returns fixture collections for the success state without any network access", async () => {
    const adapter = oidcAdminDemoAdapterCreate(() => "success")

    const clients = await adapter.clientList()
    const keys = await adapter.signingKeyList()
    const consents = await adapter.consentList(userId)
    const discovery = await adapter.discoveryGet()
    const jwks = await adapter.jwksGet()

    expect(clients.success && clients.data.items.length).toBeGreaterThan(0)
    expect(keys.success && keys.data.items.length).toBeGreaterThan(0)
    expect(consents.success && consents.data.items.length).toBeGreaterThan(0)
    expect(discovery.success && discovery.data.issuer).toContain("https://")
    expect(jwks.success && jwks.data.keys.length).toBeGreaterThan(0)
  })

  test("returns empty collections for the empty state", async () => {
    const adapter = oidcAdminDemoAdapterCreate(() => "empty")

    const clients = await adapter.clientList()
    const keys = await adapter.signingKeyList()

    expect(clients.success && clients.data.items).toEqual([])
    expect(keys.success && keys.data.items).toEqual([])
  })

  test("maps denied, assurance, and cross-tenant states onto distinct coded failures", async () => {
    const denied = await oidcAdminDemoAdapterCreate(() => "permission-denied").clientList()
    const assurance = await oidcAdminDemoAdapterCreate(() => "expired").clientList()
    const crossTenant = await oidcAdminDemoAdapterCreate(() => "cross-tenant").clientList()
    const failed = await oidcAdminDemoAdapterCreate(() => "error").clientList()

    expect(!denied.success && denied.code).toBe("oidc.forbidden")
    expect(!assurance.success && assurance.code).toBe("authorization.insufficient-assurance")
    expect(!crossTenant.success && crossTenant.code).toBe("oidc.tenant-mismatch")
    expect(!failed.success && failed.code).toBe("oidc.read-failed")
  })

  test("never settles in the loading state so the loading view stays visible", async () => {
    const pending = oidcAdminDemoAdapterCreate(() => "loading").clientList()

    const outcome = await Promise.race([
      pending.then(() => "settled" as const),
      new Promise<"pending">((resolve) => setTimeout(() => resolve("pending"), 25)),
    ])

    expect(outcome).toBe("pending")
  })

  test("issues a one-time secret for a confidential client and none for a public client", async () => {
    const adapter = oidcAdminDemoAdapterCreate(() => "success")

    const confidential = await adapter.clientCreate({
      clientType: "confidential",
      name: "Demo Confidential",
      redirectUris: ["https://demo.example/callback"],
    })
    const publicClient = await adapter.clientCreate({
      clientType: "public",
      name: "Demo Public",
      redirectUris: ["com.demo://callback"],
    })

    expect(confidential.success && confidential.data.clientSecret).toBeString()
    expect(publicClient.success && publicClient.data.clientSecret).toBeUndefined()
  })

  test("rotates a client secret to a new, non-recoverable value", async () => {
    const adapter = oidcAdminDemoAdapterCreate(() => "success")

    const first = await adapter.clientSecretRotate(confidentialClientId)
    const second = await adapter.clientSecretRotate(confidentialClientId)
    const client = await adapter.clientGet(confidentialClientId)

    expect(first.success && second.success && first.data.clientSecret !== second.data.clientSecret).toBe(true)
    // A read of the client never returns the secret, so it is not recoverable.
    expect(client.success && Object.keys(client.data)).not.toContain("clientSecret")
  })

  test("revoking a secret leaves the client readable without any secret material", async () => {
    const adapter = oidcAdminDemoAdapterCreate(() => "success")

    const revoked = await adapter.clientSecretRevoke(confidentialClientId)

    expect(revoked.success).toBe(true)
    expect(revoked.success && Object.keys(revoked.data)).not.toContain("clientSecret")
  })

  test("stores exact redirect URIs and scopes without normalising them", async () => {
    const adapter = oidcAdminDemoAdapterCreate(() => "success")

    const updated = await adapter.clientUpdate(confidentialClientId, {
      allowedScopes: ["openid", "email"],
      redirectUris: ["https://Portal.Acme.example/Callback?x=1"],
    })

    expect(updated.success && updated.data.redirectUris).toEqual(["https://Portal.Acme.example/Callback?x=1"])
    expect(updated.success && updated.data.allowedScopes).toEqual(["openid", "email"])
  })

  test("applies trusted and consent settings on create and update", async () => {
    const adapter = oidcAdminDemoAdapterCreate(() => "success")

    const created = await adapter.clientCreate({
      clientType: "public",
      name: "Trusted First Party",
      redirectUris: ["https://first.example/callback"],
      requireConsent: false,
      trusted: true,
    })
    const updated = await adapter.clientUpdate(publicClientId, { requireConsent: true, trusted: false })

    expect(created.success && created.data.client.trusted).toBe(true)
    expect(created.success && created.data.client.requireConsent).toBe(false)
    expect(updated.success && updated.data.trusted).toBe(false)
    expect(updated.success && updated.data.requireConsent).toBe(true)
  })

  test("moves a client through its lifecycle", async () => {
    const adapter = oidcAdminDemoAdapterCreate(() => "success")

    const deactivated = await adapter.clientLifecycleSet(confidentialClientId, { status: "inactive" })
    const removed = await adapter.clientLifecycleSet(confidentialClientId, { status: "removed" })

    expect(deactivated.success && deactivated.data.status).toBe("inactive")
    expect(removed.success && removed.data.status).toBe("removed")
  })

  test("rotation retires every active key and publishes exactly one replacement", async () => {
    const adapter = oidcAdminDemoAdapterCreate(() => "success")

    const rotated = await adapter.signingKeyRotate()
    const listed = await adapter.signingKeyList()

    expect(rotated.success && rotated.data.status).toBe("active")
    expect(listed.success && listed.data.items.filter((key) => key.status === "active")).toHaveLength(1)
    expect(listed.success && listed.data.items.every((key) => v.safeParse(oidcSigningKeySchema, key).success)).toBe(
      true,
    )
  })

  test("retiring a key stamps a retirement time and keeps its metadata readable", async () => {
    const adapter = oidcAdminDemoAdapterCreate(() => "success")

    const retired = await adapter.signingKeyRetire("01900000-0000-7000-8000-000000000061")

    expect(retired.success && retired.data.status).toBe("retired")
    expect(retired.success && retired.data.retiredAt).toBeNumber()
  })

  test("revoking a consent removes it from the subject's list", async () => {
    const adapter = oidcAdminDemoAdapterCreate(() => "success")

    const before = await adapter.consentList(userId)
    await adapter.consentRevoke(userId, confidentialClientId)
    const after = await adapter.consentList(userId)

    expect(before.success && after.success && after.data.items.length).toBe(
      (before.success ? before.data.items.length : 0) - 1,
    )
    expect(after.success && after.data.items.some((item) => item.clientId === confidentialClientId)).toBe(false)
  })

  test("exposes no mutating operation for discovery or JWKS", () => {
    const adapter = oidcAdminDemoAdapterCreate(() => "success")

    const surface = Object.keys(adapter)
    expect(surface.filter((name) => /discovery|jwks/i.test(name))).toEqual(["discoveryGet", "jwksGet"])
  })
})
