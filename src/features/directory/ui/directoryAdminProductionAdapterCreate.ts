import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import { machineUserApiClientCreate } from "../../machineUsers/client/machineUserApiClientCreate.js"
import type { MachineUserCreateRequest } from "../../machineUsers/public/machineUserCreateRequestSchema.js"
import { organizationApiClientCreate } from "../../organizations/client/organizationApiClientCreate.js"
import type { OrganizationInvitationCreateRequest } from "../../organizations/public/organizationInvitationCreateRequestSchema.js"
import { sessionCsrfTokenGet } from "../../sessions/client/sessionCsrfTokenGet.js"
import { userApiClientCreate } from "../../users/client/userApiClientCreate.js"
import { directoryApiClientCreate } from "../client/directoryApiClientCreate.js"
import type { DirectoryUserListQuery } from "../public/directoryUserListSchema.js"
import type { DirectoryAdminAdapter } from "./directoryAdminAdapter.js"

type DirectoryAdminFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

/**
 * Production adapter. Every call is realm-scoped and cookie-authenticated, so tenant
 * boundaries, permissions, and assurance are enforced by the server rather than the view.
 * Only the browser tenant surface is used; the operator-only `/system/**` surface is
 * never reached. Every mutation first exchanges a session CSRF token so cookie-mode
 * writes are accepted by the server.
 */
export function directoryAdminProductionAdapterCreate(options: {
  readonly baseUrl: string
  readonly fetch?: DirectoryAdminFetch
  readonly organizationId: () => string
  readonly realmId: () => string
}): DirectoryAdminAdapter {
  const browserFetch: DirectoryAdminFetch = (input, init) =>
    (options.fetch ?? fetch)(input, { ...init, credentials: "include" })
  const readClients = () => ({
    directory: directoryApiClientCreate({ baseUrl: options.baseUrl, fetch: browserFetch }),
    machines: machineUserApiClientCreate({ baseUrl: options.baseUrl, fetch: browserFetch }),
    organizations: organizationApiClientCreate({ baseUrl: options.baseUrl, fetch: browserFetch }),
    users: userApiClientCreate({ baseUrl: options.baseUrl, fetch: browserFetch }),
  })
  const write = async <T>(run: (clients: ReturnType<typeof readClients>) => Promise<Result<T>>): Promise<Result<T>> => {
    const csrf = await sessionCsrfTokenGet({
      baseUrl: options.baseUrl,
      fetch: options.fetch,
      realmId: options.realmId(),
    })
    if (!csrf.success) return csrf
    const clients = readClients()
    return run({
      ...clients,
      machines: machineUserApiClientCreate({
        baseUrl: options.baseUrl,
        csrfToken: csrf.data,
        fetch: browserFetch,
      }),
      organizations: organizationApiClientCreate({
        baseUrl: options.baseUrl,
        csrfToken: csrf.data,
        fetch: browserFetch,
      }),
      users: userApiClientCreate({
        baseUrl: options.baseUrl,
        fetch: browserFetch,
        // The users client exchanges its own CSRF inside `sessionBrowserRequest`; the
        // shared token is injected through the browser fetch headers instead.
        token: undefined,
      }),
    })
  }
  const realm = () => options.realmId()
  const organization = () => options.organizationId()
  const directoryQuery = (query?: DirectoryUserListQuery): DirectoryUserListQuery | undefined =>
    query === undefined ? undefined : { ...query }

  return {
    directoryUserCreate: async (input) => {
      const result = await write((clients) => clients.users.userTenantCreate(realm(), input))
      if (!result.success) return result
      return resultCreate({ user: result.data.user })
    },
    invitationCreate: (input: OrganizationInvitationCreateRequest) =>
      write((clients) => clients.organizations.organizationTenantInvitationCreate(realm(), organization(), input)),
    invitationList: (query?: ListQuery) =>
      readClients().organizations.organizationTenantInvitationList(realm(), organization(), query),
    invitationRevoke: (invitationId: string) =>
      write((clients) =>
        clients.organizations.organizationTenantInvitationRevoke(realm(), organization(), invitationId),
      ),
    organizationUserList: (query?: DirectoryUserListQuery) =>
      readClients().directory.directoryOrganizationUserList(realm(), organization(), directoryQuery(query)),
    organizationUserSummary: () => readClients().directory.directoryOrganizationUserSummary(realm(), organization()),
    realmUserList: (query?: DirectoryUserListQuery) =>
      readClients().directory.directoryRealmUserList(realm(), directoryQuery(query)),
    serviceAccountCreate: async (input: MachineUserCreateRequest) => {
      const result = await write((clients) => clients.machines.machineUserTenantCreate(realm(), organization(), input))
      if (!result.success) return result
      return resultCreate({
        clientId: result.data.clientId,
        machineUser: result.data.machineUser,
        secret: result.data.clientSecret,
      })
    },
    serviceAccountList: (query?: ListQuery) =>
      readClients().machines.machineUserTenantList(realm(), organization(), query),
  }
}
