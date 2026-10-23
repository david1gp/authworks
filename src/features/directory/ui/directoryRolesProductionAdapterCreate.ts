import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { organizationApiClientCreate } from "../../organizations/client/organizationApiClientCreate.js"
import { projectApiClientCreate } from "../../projects/client/projectApiClientCreate.js"
import type { ProjectRoleCreateRequest } from "../../projects/public/projectRoleCreateRequestSchema.js"
import type { ProjectRoleUpdateRequest } from "../../projects/public/projectRoleUpdateRequestSchema.js"
import { sessionCsrfTokenGet } from "../../sessions/client/sessionCsrfTokenGet.js"
import { directoryApiClientCreate } from "../client/directoryApiClientCreate.js"
import type { DirectoryRolesAdapter } from "./directoryRolesAdapter.js"

const pageSize = 100

type DirectoryRolesFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

/**
 * Production adapter. Every call is realm-scoped and cookie-authenticated, so
 * tenant boundaries and permissions are enforced by the server, not the view.
 */
export function directoryRolesProductionAdapterCreate(options: {
  readonly baseUrl: string
  readonly fetch?: DirectoryRolesFetch
  readonly organizationId: () => string
  readonly realmId: () => string
}): DirectoryRolesAdapter {
  const browserFetch: DirectoryRolesFetch = (input, init) =>
    (options.fetch ?? fetch)(input, { ...init, credentials: "same-origin" })
  const realm = () => options.realmId()
  const organization = () => options.organizationId()
  const readClients = () => ({
    directory: directoryApiClientCreate({ baseUrl: options.baseUrl, fetch: browserFetch }),
    organizations: organizationApiClientCreate({ baseUrl: options.baseUrl, fetch: browserFetch }),
    projects: projectApiClientCreate({ baseUrl: options.baseUrl, fetch: browserFetch }),
  })
  const csrfClients = (csrfToken: string) => ({
    projects: projectApiClientCreate({ baseUrl: options.baseUrl, csrfToken, fetch: browserFetch }),
  })
  /**
   * Resolves a fresh realm-scoped CSRF token before each mutation so a rotated
   * session never replays a stale token.
   */
  const mutate = async <T>(
    operation: (client: ReturnType<typeof csrfClients>) => Promise<Result<T>>,
    op: string,
  ): Promise<Result<T>> => {
    const csrf = await sessionCsrfTokenGet({ baseUrl: options.baseUrl, fetch: options.fetch, realmId: realm() })
    if (!csrf.success) return resultErrorCodedCreate(op, csrf.errorMessage, "platform.request-failed")
    return operation(csrfClients(csrf.data))
  }

  return {
    organizationRoleList: async () => {
      const result = await readClients().organizations.organizationTenantRoleList(realm())
      if (!result.success) return result
      return resultCreate(result.data.items)
    },
    projectList: async () => {
      const result = await readClients().projects.projectTenantList(realm(), {
        organizationId: organization(),
        pageSize,
      })
      if (!result.success) return result
      return resultCreate(result.data.items)
    },
    projectRoleCreate: (projectId, input: ProjectRoleCreateRequest) =>
      mutate(async (client) => {
        const result = await client.projects.projectTenantRoleCreate(realm(), projectId, input)
        if (!result.success) return result
        return resultCreate(result.data.role)
      }, "directoryRolesProductionRoleCreate"),
    projectRoleDelete: (projectId, roleId) =>
      mutate(async (client) => {
        const result = await client.projects.projectTenantRoleDelete(realm(), projectId, roleId)
        if (!result.success) return result
        return resultCreate({ deleted: true as const })
      }, "directoryRolesProductionRoleDelete"),
    projectRoleList: async (projectId) => {
      const result = await readClients().projects.projectTenantRoleList(realm(), projectId, { pageSize })
      if (!result.success) return result
      return resultCreate(result.data.items)
    },
    projectRoleUpdate: (projectId, roleId, input: ProjectRoleUpdateRequest) =>
      mutate(async (client) => {
        const result = await client.projects.projectTenantRoleUpdate(realm(), projectId, roleId, input)
        if (!result.success) return result
        return resultCreate(result.data.role)
      }, "directoryRolesProductionRoleUpdate"),
    userSummary: () => readClients().directory.directoryOrganizationUserSummary(realm(), organization()),
  }
}
