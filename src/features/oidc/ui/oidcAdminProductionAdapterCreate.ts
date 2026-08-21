import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { sessionCsrfTokenGet } from "../../sessions/client/sessionCsrfTokenGet.js"
import type { OidcAdminAdapter } from "./oidcAdminAdapter.js"
import { oidcAdminApiCreate } from "./oidcAdminApiCreate.js"

const pageSize = 25

/**
 * Production adapter. Every call is realm-scoped and cookie-authenticated, so tenant
 * boundaries, permissions, and assurance are enforced by the server, not the view.
 * Discovery and JWKS are read through the public well-known endpoints and never written.
 */
export function oidcAdminProductionAdapterCreate(options: {
  readonly baseUrl: string
  readonly realmId: () => string
  readonly csrfToken?: () => string | undefined
  readonly fetch?: (input: string | URL | Request, init?: RequestInit) => Promise<Response>
}): OidcAdminAdapter {
  const apiCreate = (csrfToken?: string) =>
    oidcAdminApiCreate({
      baseUrl: options.baseUrl,
      ...(csrfToken === undefined ? {} : { csrfToken }),
      ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
    })
  const api = () => apiCreate(options.csrfToken?.())
  const realm = () => options.realmId()
  const listQuery = (pageToken?: string) => (pageToken === undefined ? { pageSize } : { pageSize, pageToken })
  const unwrap = async <TResponse, TValue>(
    operation: Promise<Result<TResponse>>,
    select: (response: TResponse) => TValue,
  ): Promise<Result<TValue>> => {
    const result = await operation
    if (!result.success) return result
    return resultCreate(select(result.data))
  }
  /**
   * Resolves a fresh realm-scoped CSRF token before each mutation so a rotated session
   * never replays a stale token, then unwraps the response envelope.
   */
  const mutate = async <TResponse, TValue>(
    operation: (client: ReturnType<typeof apiCreate>) => Promise<Result<TResponse>>,
    select: (response: TResponse) => TValue,
  ): Promise<Result<TValue>> => {
    const provided = options.csrfToken?.()
    if (provided !== undefined) return unwrap(operation(apiCreate(provided)), select)
    const csrf = await sessionCsrfTokenGet({
      baseUrl: options.baseUrl,
      ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
      realmId: realm(),
    })
    if (!csrf.success) return csrf
    return unwrap(operation(apiCreate(csrf.data)), select)
  }

  return {
    clientCreate: (input) =>
      mutate(
        (client) => client.oidc.oidcClientTenantCreate(realm(), input),
        (data) => ({
          client: data.client,
          ...(data.clientSecret === undefined ? {} : { clientSecret: data.clientSecret }),
        }),
      ),
    clientGet: async (clientId) => {
      // No conditional request header is sent, so a "current" response is always expected.
      const result = await api().oidc.oidcClientTenantGet(realm(), clientId)
      if (!result.success) return result
      if (result.status !== "current")
        return resultErrorCodedCreate("oidcAdminClientGet", "The OIDC client could not be read.", "oidc.read-failed")
      return resultCreate(result.data.client)
    },
    clientLifecycleSet: (clientId, input) =>
      mutate(
        (client) => client.oidc.oidcClientTenantLifecycleSet(realm(), clientId, input),
        (data) => data.client,
      ),
    clientList: (pageToken) => api().oidc.oidcClientTenantList(realm(), listQuery(pageToken)),
    clientSecretRevoke: (clientId) =>
      mutate(
        (client) => client.oidc.oidcClientTenantSecretRevoke(realm(), clientId),
        (data) => data.client,
      ),
    clientSecretRotate: (clientId) =>
      mutate(
        (client) => client.oidc.oidcClientTenantSecretRotate(realm(), clientId),
        (data) => ({ client: data.client, clientSecret: data.clientSecret }),
      ),
    clientUpdate: (clientId, input) =>
      mutate(
        (client) => client.oidc.oidcClientTenantUpdate(realm(), clientId, input),
        (data) => data.client,
      ),
    consentList: (userId, pageToken) => api().oidc.oidcConsentTenantList(realm(), userId, listQuery(pageToken)),
    consentRevoke: (userId, clientId) =>
      mutate(
        (client) => client.oidc.oidcConsentTenantRevoke(realm(), userId, { client_id: clientId }),
        (data) => ({ revoked: data.revoked }),
      ),
    discoveryGet: () => api().oidc.oidcDiscoveryGet(),
    jwksGet: () => api().oidc.oidcJwksGet(),
    signingKeyCreate: () =>
      mutate(
        (client) => client.oidc.oidcSigningKeyTenantCreate(realm()),
        (data) => data.signingKey,
      ),
    signingKeyList: (pageToken) => api().oidc.oidcSigningKeyTenantList(realm(), listQuery(pageToken)),
    signingKeyRetire: (signingKeyId) =>
      mutate(
        (client) => client.oidc.oidcSigningKeyTenantLifecycleSet(realm(), signingKeyId, { status: "retired" }),
        (data) => data.signingKey,
      ),
    signingKeyRotate: () =>
      mutate(
        (client) => client.oidc.oidcSigningKeyTenantRotate(realm()),
        (data) => data.signingKey,
      ),
    users: async () => {
      const result = await api().users.userTenantList(realm(), { pageSize: 100 })
      if (!result.success) return result
      return resultCreate(result.data.items.map((item) => ({ id: item.id, label: item.email })))
    },
  }
}
