import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { demoAdminOidcClients } from "../../demo/demoAdminOidcClients.js"
import { demoAdminOidcConsents } from "../../demo/demoAdminOidcConsents.js"
import { demoAdminOidcDiscovery } from "../../demo/demoAdminOidcDiscovery.js"
import { demoAdminOidcJwks } from "../../demo/demoAdminOidcJwks.js"
import { demoAdminOidcSigningKeys } from "../../demo/demoAdminOidcSigningKeys.js"
import type { DemoFixtureState } from "../../demo/demoFixtureStateSchema.js"
import { demoRealmId } from "../../demo/demoRealmId.js"
import { demoResourceIdGenerate } from "../../demo/demoResourceIdGenerate.js"
import type { OidcClient } from "../public/oidcClientSchema.js"
import type { OidcSigningKey } from "../public/oidcSigningKeySchema.js"
import type { OidcAdminAdapter } from "./oidcAdminAdapter.js"
import { oidcAdminDemoUserFixtures } from "./oidcAdminDemoUserFixtures.js"

const neverResolves = <T>(): Promise<Result<T>> => new Promise<Result<T>>(() => undefined)

/** A deterministic, clearly fake secret so no demo screen ever suggests a usable credential. */
const demoSecretGenerate = () => `demo-secret-${demoResourceIdGenerate().replaceAll("-", "")}`

/**
 * Fixture-backed adapter. It performs no network access and derives every success, empty,
 * loading, error, denied, assurance, one-time, redacted, and cross-tenant response from the
 * URL-selected fixture state so each demo destination is deterministic.
 */
export function oidcAdminDemoAdapterCreate(fixtureState: () => DemoFixtureState): OidcAdminAdapter {
  const clients = demoAdminOidcClients.map((client) => ({ ...client }))
  const signingKeys = demoAdminOidcSigningKeys.map((key) => ({ ...key }))
  const consents = demoAdminOidcConsents.map((consent) => ({ ...consent }))
  const timestamp = 1_755_782_400_000

  const gate = <T>(value: () => Result<T>): Promise<Result<T>> => {
    const state = fixtureState()
    if (state === "loading") return neverResolves<T>()
    if (state === "error")
      return Promise.resolve(
        resultErrorCodedCreate("oidcAdminDemo", "The deterministic OIDC fixture failed.", "oidc.read-failed"),
      )
    if (state === "permission-denied")
      return Promise.resolve(
        resultErrorCodedCreate("oidcAdminDemo", "You do not have permission to perform this action.", "oidc.forbidden"),
      )
    if (state === "expired")
      return Promise.resolve(
        resultErrorCodedCreate(
          "oidcAdminDemo",
          "A stronger, more recent sign-in is required.",
          "authorization.insufficient-assurance",
        ),
      )
    if (state === "cross-tenant")
      return Promise.resolve(
        resultErrorCodedCreate("oidcAdminDemo", "This resource belongs to a different realm.", "oidc.tenant-mismatch"),
      )
    return Promise.resolve(value())
  }
  const collection = <T>(items: readonly T[]) =>
    gate(() => resultCreate({ items: fixtureState() === "empty" ? [] : [...items] }))

  return {
    clientCreate: (input) =>
      gate(() => {
        const client: OidcClient = {
          allowedScopes: input.allowedScopes === undefined ? ["openid"] : [...input.allowedScopes],
          ...(input.applicationId === undefined ? {} : { applicationId: input.applicationId }),
          clientType: input.clientType,
          createdAt: timestamp,
          id: demoResourceIdGenerate(),
          realmId: demoRealmId,
          name: input.name,
          postLogoutRedirectUris: input.postLogoutRedirectUris === undefined ? [] : [...input.postLogoutRedirectUris],
          ...(input.projectId === undefined ? {} : { projectId: input.projectId }),
          redirectUris: [...input.redirectUris],
          requireConsent: input.requireConsent ?? true,
          status: "active",
          trusted: input.trusted ?? false,
          updatedAt: timestamp,
        }
        clients.push(client)
        // A public client is never issued a secret, matching the production contract.
        if (client.clientType === "public") return resultCreate({ client })
        return resultCreate({ client, clientSecret: demoSecretGenerate() })
      }),
    clientGet: (clientId) =>
      gate(() => {
        const client = clients.find((item) => item.id === clientId)
        if (client === undefined)
          return resultErrorCodedCreate("oidcAdminDemo", "The OIDC client was not found.", "oidc.not-found")
        return resultCreate(client)
      }),
    clientLifecycleSet: (clientId, input) =>
      gate(() => {
        const index = clients.findIndex((item) => item.id === clientId)
        const existing = clients[index]
        if (existing === undefined)
          return resultErrorCodedCreate("oidcAdminDemo", "The OIDC client was not found.", "oidc.not-found")
        const updated = { ...existing, status: input.status, updatedAt: timestamp }
        clients[index] = updated
        return resultCreate(updated)
      }),
    clientList: () => collection(clients),
    clientSecretRevoke: (clientId) =>
      gate(() => {
        const client = clients.find((item) => item.id === clientId)
        if (client === undefined)
          return resultErrorCodedCreate("oidcAdminDemo", "The OIDC client was not found.", "oidc.not-found")
        return resultCreate({ ...client, updatedAt: timestamp })
      }),
    clientSecretRotate: (clientId) =>
      gate(() => {
        const index = clients.findIndex((item) => item.id === clientId)
        const existing = clients[index]
        if (existing === undefined)
          return resultErrorCodedCreate("oidcAdminDemo", "The OIDC client was not found.", "oidc.not-found")
        const updated = { ...existing, updatedAt: timestamp }
        clients[index] = updated
        return resultCreate({ client: updated, clientSecret: demoSecretGenerate() })
      }),
    clientUpdate: (clientId, input) =>
      gate(() => {
        const index = clients.findIndex((item) => item.id === clientId)
        const existing = clients[index]
        if (existing === undefined)
          return resultErrorCodedCreate("oidcAdminDemo", "The OIDC client was not found.", "oidc.not-found")
        const updated: OidcClient = {
          ...existing,
          allowedScopes: input.allowedScopes === undefined ? existing.allowedScopes : [...input.allowedScopes],
          name: input.name ?? existing.name,
          postLogoutRedirectUris:
            input.postLogoutRedirectUris === undefined
              ? existing.postLogoutRedirectUris
              : [...input.postLogoutRedirectUris],
          redirectUris: input.redirectUris === undefined ? existing.redirectUris : [...input.redirectUris],
          requireConsent: input.requireConsent ?? existing.requireConsent,
          trusted: input.trusted ?? existing.trusted,
          updatedAt: timestamp,
        }
        clients[index] = updated
        return resultCreate(updated)
      }),
    consentList: (userId) => collection(consents.filter((item) => item.userId === userId)),
    consentRevoke: (userId, clientId) =>
      gate(() => {
        const index = consents.findIndex((item) => item.userId === userId && item.clientId === clientId)
        if (index >= 0) consents.splice(index, 1)
        return resultCreate({ revoked: true })
      }),
    discoveryGet: () => gate(() => resultCreate(demoAdminOidcDiscovery)),
    jwksGet: () => gate(() => resultCreate(demoAdminOidcJwks)),
    signingKeyCreate: () =>
      gate(() => {
        const key = signingKeyCreate()
        signingKeys.push(key)
        return resultCreate(key)
      }),
    signingKeyList: () => collection(signingKeys),
    signingKeyRetire: (signingKeyId) =>
      gate(() => {
        const index = signingKeys.findIndex((item) => item.id === signingKeyId)
        const existing = signingKeys[index]
        if (existing === undefined)
          return resultErrorCodedCreate("oidcAdminDemo", "The signing key was not found.", "oidc.not-found")
        const updated: OidcSigningKey = { ...existing, retiredAt: timestamp, status: "retired" }
        signingKeys[index] = updated
        return resultCreate(updated)
      }),
    signingKeyRotate: () =>
      gate(() => {
        // Rotation retires every active key and publishes exactly one replacement.
        for (const [index, key] of signingKeys.entries()) {
          if (key.status === "active") signingKeys[index] = { ...key, retiredAt: timestamp, status: "retired" }
        }
        const key = signingKeyCreate()
        signingKeys.push(key)
        return resultCreate(key)
      }),
    users: () => gate(() => resultCreate(oidcAdminDemoUserFixtures.map((user) => ({ ...user })))),
  }

  function signingKeyCreate(): OidcSigningKey {
    const id = demoResourceIdGenerate()
    return {
      algorithm: "RS256",
      createdAt: timestamp,
      id,
      realmId: demoRealmId,
      publicJwk: {
        alg: "RS256",
        e: "AQAB",
        kid: id,
        kty: "RSA",
        n: `${demoAdminOidcSigningKeys[0]?.publicJwk.n ?? "AQAB"}R`,
        use: "sig",
      },
      retiredAt: null,
      status: "active",
    }
  }
}
