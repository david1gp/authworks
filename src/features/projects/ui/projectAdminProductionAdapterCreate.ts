import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { authorizationFixedRoleDefinitions } from "../../authorization/domain/authorizationFixedRoleDefinitions.js"
import { sessionCsrfTokenGet } from "../../sessions/client/sessionCsrfTokenGet.js"
import type { ProjectAdminAdapter } from "./projectAdminAdapter.js"
import { projectAdminApiCreate } from "./projectAdminApiCreate.js"

const pageSize = 25

/**
 * Production adapter. Every call is realm-scoped and cookie-authenticated, so
 * tenant boundaries and permissions are enforced by the server, not the view.
 */
export function projectAdminProductionAdapterCreate(options: {
  readonly baseUrl: string
  readonly realmId: () => string
  readonly csrfToken?: () => string | undefined
  readonly fetch?: (input: string | URL | Request, init?: RequestInit) => Promise<Response>
}): ProjectAdminAdapter {
  const apiCreate = (csrfToken?: string) =>
    projectAdminApiCreate({
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
   * Resolves a fresh realm-scoped CSRF token before each mutation so a rotated
   * session never replays a stale token, then unwraps the response envelope.
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
    applicationCreate: (projectId, input) =>
      mutate(
        (client) => client.projects.projectTenantApplicationCreate(realm(), projectId, input),
        (data) => data.application,
      ),
    applicationLifecycleSet: (projectId, applicationId, input) =>
      mutate(
        (client) => client.projects.projectTenantApplicationLifecycleSet(realm(), projectId, applicationId, input),
        (data) => data.application,
      ),
    applicationList: (projectId, pageToken) =>
      api().projects.projectTenantApplicationList(realm(), projectId, listQuery(pageToken)),
    applicationUpdate: (projectId, applicationId, input) =>
      mutate(
        (client) => client.projects.projectTenantApplicationUpdate(realm(), projectId, applicationId, input),
        (data) => data.application,
      ),
    grantCreate: (projectId, input) =>
      mutate(
        (client) => client.projects.projectTenantGrantCreate(realm(), projectId, input),
        (data) => data.grant,
      ),
    grantDelete: (projectId, grantId) =>
      mutate(
        (client) => client.projects.projectTenantGrantDelete(realm(), projectId, grantId),
        () => ({ deleted: true }) as const,
      ),
    grantLifecycleSet: (projectId, grantId, input) =>
      mutate(
        (client) => client.projects.projectTenantGrantLifecycleSet(realm(), projectId, grantId, input),
        (data) => data.grant,
      ),
    grantList: (projectId, pageToken) =>
      api().projects.projectTenantGrantList(realm(), projectId, listQuery(pageToken)),
    grantUpdate: (projectId, grantId, input) =>
      mutate(
        (client) => client.projects.projectTenantGrantUpdate(realm(), projectId, grantId, input),
        (data) => data.grant,
      ),
    organizations: async () => {
      const result = await api().organizations.organizationTenantList(realm(), { pageSize: 100 })
      if (!result.success) return result
      return resultCreate(result.data.items.map((item) => ({ id: item.id, name: item.name })))
    },
    permissionRoles: () => authorizationFixedRoleDefinitions,
    projectAccessCheck: (projectId) => api().projects.projectTenantAccessCheck(realm(), projectId),
    projectCreate: (input) =>
      mutate(
        (client) => client.projects.projectTenantCreate(realm(), input),
        (data) => data.project,
      ),
    projectDelete: (projectId) =>
      mutate(
        (client) => client.projects.projectTenantDelete(realm(), projectId),
        () => ({ deleted: true }) as const,
      ),
    projectGet: async (projectId) => {
      // No conditional request header is sent, so a "current" response is always expected.
      const result = await api().projects.projectTenantGet(realm(), projectId)
      if (!result.success) return result
      if (result.status !== "current")
        return resultErrorCodedCreate(
          "projectAdminProjectGet",
          "The project could not be read.",
          "projects.read-failed",
        )
      return resultCreate(result.data.project)
    },
    projectLifecycleSet: (projectId, input) =>
      mutate(
        (client) => client.projects.projectTenantLifecycleSet(realm(), projectId, input),
        (data) => data.project,
      ),
    projectList: (pageToken) => api().projects.projectTenantList(realm(), listQuery(pageToken)),
    projectUpdate: (projectId, input) =>
      mutate(
        (client) => client.projects.projectTenantUpdate(realm(), projectId, input),
        (data) => data.project,
      ),
    roleCreate: (projectId, input) =>
      mutate(
        (client) => client.projects.projectTenantRoleCreate(realm(), projectId, input),
        (data) => data.role,
      ),
    roleDelete: (projectId, roleId) =>
      mutate(
        (client) => client.projects.projectTenantRoleDelete(realm(), projectId, roleId),
        () => ({ deleted: true }) as const,
      ),
    roleList: (projectId, pageToken) => api().projects.projectTenantRoleList(realm(), projectId, listQuery(pageToken)),
    roleUpdate: (projectId, roleId, input) =>
      mutate(
        (client) => client.projects.projectTenantRoleUpdate(realm(), projectId, roleId, input),
        (data) => data.role,
      ),
  }
}
