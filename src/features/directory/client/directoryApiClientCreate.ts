import * as v from "valibot"
import type { Result } from "#result"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { httpApiClientRequest } from "../../../platform/http/httpApiClientRequest.js"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import { listQueryToSearchParams } from "../../../platform/http/listQueryToSearchParams.js"
import { Secret } from "../../../platform/secrets/Secret.js"
import { sessionBrowserRequest } from "../../sessions/client/sessionBrowserRequest.js"
import {
  type DirectoryOrganizationUserSummary,
  directoryOrganizationUserSummarySchema,
} from "../public/directoryOrganizationUserSummarySchema.js"
import { type DirectoryUserAccess, directoryUserAccessSchema } from "../public/directoryUserAccessSchema.js"
import {
  type DirectoryUserListQuery,
  type DirectoryUserListResponse,
  directoryUserListQuerySchema,
  directoryUserListResponseSchema,
} from "../public/directoryUserListSchema.js"

type DirectoryApiFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

type DirectoryApiClientCreateOptions = {
  readonly baseUrl: string
  readonly csrfToken?: string
  readonly fetch?: DirectoryApiFetch
  readonly token?: Secret | string
}

function directoryQueryToSearchParams(query: DirectoryUserListQuery | ListQuery | undefined): string {
  if (query === undefined) return ""
  const params = new URLSearchParams(listQueryToSearchParams(query).replace(/^\?/, ""))
  const filters = query as DirectoryUserListQuery
  if (filters.emailVerified !== undefined) params.set("emailVerified", filters.emailVerified ? "true" : "false")
  if (filters.role !== undefined) params.set("role", filters.role)
  if (filters.state !== undefined) params.set("state", filters.state)
  const encoded = params.toString()
  return encoded.length === 0 ? "" : `?${encoded}`
}

export function directoryApiClientCreate(options: DirectoryApiClientCreateOptions) {
  const request = <T>(path: string, init: RequestInit, schema: v.GenericSchema<T>): Promise<Result<T>> =>
    httpApiClientRequest({
      baseUrl: options.baseUrl,
      fetch: options.fetch,
      init,
      op: "directoryApiClientRequest",
      path,
      schema,
      token: options.token,
    })
  const browserRequestInit = (init: RequestInit): RequestInit => {
    const headers = new Headers(init.headers)
    if (options.csrfToken !== undefined) headers.set("x-csrf-token", options.csrfToken)
    return { ...init, credentials: "same-origin", headers }
  }
  const browserRequest = <T>(path: string, init: RequestInit, schema: v.GenericSchema<T>): Promise<Result<T>> =>
    httpApiClientRequest({
      baseUrl: options.baseUrl,
      fetch: options.fetch,
      init: browserRequestInit(init),
      op: "directoryApiClientTenantRequest",
      path,
      schema,
    })
  const tenantMutation = <T>(
    realmId: string,
    op: string,
    path: string,
    init: RequestInit,
    schema: v.GenericSchema<T>,
  ): Promise<Result<T>> => {
    if (options.token !== undefined) return request(path, init, schema)
    if (options.csrfToken !== undefined) return browserRequest(path, init, schema)
    return sessionBrowserRequest({ baseUrl: options.baseUrl, fetch: options.fetch, init, op, path, realmId, schema })
  }
  const directoryListQueryParse = (
    query: DirectoryUserListQuery | undefined,
    op: string,
  ): Result<DirectoryUserListQuery> => {
    if (query === undefined) return { data: {}, success: true }
    const parsed = v.safeParse(directoryUserListQuerySchema, query)
    if (!parsed.success) return resultErrorCodedCreate(op, "The directory list query is invalid.", "directory.invalid")
    return { data: parsed.output, success: true }
  }

  return {
    directoryOrganizationUserList(
      realmId: string,
      organizationId: string,
      query?: DirectoryUserListQuery,
    ): Promise<Result<DirectoryUserListResponse>> {
      const parsed = directoryListQueryParse(query, "directoryApiClientOrganizationUserList")
      if (!parsed.success) return Promise.resolve(parsed)
      return tenantMutation(
        realmId,
        "directoryApiClientOrganizationUserList",
        `/realms/${encodeURIComponent(realmId)}/organizations/${encodeURIComponent(organizationId)}/users${directoryQueryToSearchParams(parsed.data)}`,
        { method: "GET" },
        directoryUserListResponseSchema,
      )
    },
    directoryOrganizationUserSummary(
      realmId: string,
      organizationId: string,
    ): Promise<Result<DirectoryOrganizationUserSummary>> {
      return tenantMutation(
        realmId,
        "directoryApiClientOrganizationUserSummary",
        `/realms/${encodeURIComponent(realmId)}/organizations/${encodeURIComponent(organizationId)}/users/summary`,
        { method: "GET" },
        directoryOrganizationUserSummarySchema,
      )
    },
    directoryRealmUserList(
      realmId: string,
      query?: DirectoryUserListQuery,
    ): Promise<Result<DirectoryUserListResponse>> {
      const parsed = directoryListQueryParse(query, "directoryApiClientRealmUserList")
      if (!parsed.success) return Promise.resolve(parsed)
      return tenantMutation(
        realmId,
        "directoryApiClientRealmUserList",
        `/realms/${encodeURIComponent(realmId)}/directory/users${directoryQueryToSearchParams(parsed.data)}`,
        { method: "GET" },
        directoryUserListResponseSchema,
      )
    },
    directoryUserAccess(realmId: string, userId: string): Promise<Result<DirectoryUserAccess>> {
      return tenantMutation(
        realmId,
        "directoryApiClientUserAccess",
        `/realms/${encodeURIComponent(realmId)}/users/${encodeURIComponent(userId)}/access`,
        { method: "GET" },
        directoryUserAccessSchema,
      )
    },
  }
}
