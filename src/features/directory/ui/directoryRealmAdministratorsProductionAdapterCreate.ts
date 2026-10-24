import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { realmApiClientCreate } from "../../realms/client/realmApiClientCreate.js"
import { sessionCsrfTokenGet } from "../../sessions/client/sessionCsrfTokenGet.js"
import { directoryApiClientCreate } from "../client/directoryApiClientCreate.js"
import type { DirectoryRealmAdministratorsAdapter } from "./directoryRealmAdministratorsAdapter.js"

type DirectoryRealmAdministratorsFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

/**
 * Production adapter. Every call is realm-scoped and cookie-authenticated, so
 * tenant boundaries and permissions are enforced by the server, not the view.
 */
export function directoryRealmAdministratorsProductionAdapterCreate(options: {
  readonly baseUrl: string
  readonly fetch?: DirectoryRealmAdministratorsFetch
  readonly realmId: () => string
}): DirectoryRealmAdministratorsAdapter {
  const browserFetch: DirectoryRealmAdministratorsFetch = (input, init) =>
    (options.fetch ?? fetch)(input, { ...init, credentials: "include" })
  const realm = () => options.realmId()
  const clients = () => ({
    directory: directoryApiClientCreate({ baseUrl: options.baseUrl, fetch: browserFetch }),
    realms: realmApiClientCreate({ baseUrl: options.baseUrl, fetch: browserFetch }),
  })
  const withCsrf = async <T>(
    operation: (csrf: Awaited<ReturnType<typeof sessionCsrfTokenGet>>) => Promise<Result<T>>,
  ): Promise<Result<T>> => {
    const csrf = await sessionCsrfTokenGet({ baseUrl: options.baseUrl, fetch: options.fetch, realmId: realm() })
    if (!csrf.success) return csrf
    return operation(csrf)
  }

  return {
    administratorGrant: (userId) =>
      withCsrf(async () => {
        const result = await clients().realms.realmTenantAdministratorGrant(realm(), { userId })
        if (!result.success) return result
        return resultCreate(result.data)
      }),
    administratorList: async () => {
      const result = await clients().realms.realmTenantAdministratorList(realm())
      if (!result.success) return result
      return resultCreate([...result.data.items])
    },
    administratorRevoke: (userId) =>
      withCsrf(async () => {
        const result = await clients().realms.realmTenantAdministratorRevoke(realm(), userId)
        if (!result.success) return result
        return resultCreate(result.data)
      }),
    realmUserSearch: async (search) => {
      const result = await clients().directory.directoryRealmUserList(realm(), { pageSize: 20, search })
      if (!result.success) return result
      return resultCreate([...result.data.items])
    },
  }
}
