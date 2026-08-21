import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { sessionCsrfTokenGet } from "../../sessions/client/sessionCsrfTokenGet.js"
import type { MachineAdminAdapter } from "./machineAdminAdapter.js"
import { machineAdminApiCreate } from "./machineAdminApiCreate.js"

const pageSize = 25

/**
 * Production adapter. Every call is realm-scoped and cookie-authenticated, so tenant
 * boundaries, permissions, and assurance are enforced by the server, not the view. Only the
 * browser tenant surface is used; the operator-only `/system/**` surface is never reached.
 */
export function machineAdminProductionAdapterCreate(options: {
  readonly baseUrl: string
  readonly realmId: () => string
  readonly csrfToken?: () => string | undefined
  readonly fetch?: (input: string | URL | Request, init?: RequestInit) => Promise<Response>
}): MachineAdminAdapter {
  const apiCreate = (csrfToken?: string) =>
    machineAdminApiCreate({
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
    apiKeyCreate: (machineUserId, input) =>
      mutate(
        (client) => client.machineUserTenantApiKeyCreate(realm(), machineUserId, input),
        (data) => ({ credential: data.credential, secret: data.secret }),
      ),
    clientSecretRotate: (machineUserId) =>
      mutate(
        (client) => client.machineUserTenantClientSecretRotate(realm(), machineUserId),
        (data) => ({ clientId: data.clientId, clientSecret: data.clientSecret, machineUser: data.machineUser }),
      ),
    credentialList: (machineUserId, pageToken) =>
      api().machineUserTenantCredentialList(realm(), machineUserId, listQuery(pageToken)),
    credentialRevoke: (credentialId, reason) =>
      mutate(
        (client) =>
          client.machineUserTenantCredentialRevoke(realm(), credentialId, reason === undefined ? {} : { reason }),
        (data) => data.credential,
      ),
    machineUserCreate: (input) =>
      mutate(
        (client) => client.machineUserTenantCreate(realm(), input),
        (data) => ({ clientId: data.clientId, clientSecret: data.clientSecret, machineUser: data.machineUser }),
      ),
    machineUserGet: (machineUserId) =>
      unwrap(api().machineUserTenantGet(realm(), machineUserId), (data) => data.machineUser),
    machineUserLifecycleSet: (machineUserId, input) =>
      mutate(
        (client) => client.machineUserTenantLifecycleSet(realm(), machineUserId, input),
        (data) => data.machineUser,
      ),
    machineUserList: (pageToken) => api().machineUserTenantList(realm(), listQuery(pageToken)),
    personalAccessTokenCreate: (machineUserId, input) =>
      mutate(
        (client) => client.machineUserTenantPersonalAccessTokenCreate(realm(), machineUserId, input),
        (data) => ({ credential: data.credential, secret: data.secret }),
      ),
  }
}
