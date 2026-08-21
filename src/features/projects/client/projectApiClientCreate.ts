import * as v from "valibot"
import { type Result } from "#result"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { HttpGetOptions } from "../../../platform/http/HttpGetOptions.js"
import type { HttpGetResult } from "../../../platform/http/HttpGetResult.js"
import { httpApiClientGetRequest } from "../../../platform/http/httpApiClientGetRequest.js"
import { httpApiClientRequest } from "../../../platform/http/httpApiClientRequest.js"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import { Secret } from "../../../platform/secrets/Secret.js"
import { type ProjectAccessResponse, projectAccessResponseSchema } from "../public/projectAccessResponseSchema.js"
import {
  type ProjectApplicationCreateRequest,
  projectApplicationCreateRequestSchema,
} from "../public/projectApplicationCreateRequestSchema.js"
import {
  type ProjectApplicationDeleteResponse,
  projectApplicationDeleteResponseSchema,
} from "../public/projectApplicationDeleteResponseSchema.js"
import {
  type ProjectApplicationLifecycleRequest,
  projectApplicationLifecycleRequestSchema,
} from "../public/projectApplicationLifecycleRequestSchema.js"
import {
  type ProjectApplicationListResponse,
  projectApplicationListResponseSchema,
} from "../public/projectApplicationListResponseSchema.js"
import {
  type ProjectApplicationResponse,
  projectApplicationResponseSchema,
} from "../public/projectApplicationResponseSchema.js"
import {
  type ProjectApplicationUpdateRequest,
  projectApplicationUpdateRequestSchema,
} from "../public/projectApplicationUpdateRequestSchema.js"
import { type ProjectCreateRequest, projectCreateRequestSchema } from "../public/projectCreateRequestSchema.js"
import { type ProjectDeleteResponse, projectDeleteResponseSchema } from "../public/projectDeleteResponseSchema.js"
import {
  type ProjectGrantCreateRequest,
  projectGrantCreateRequestSchema,
} from "../public/projectGrantCreateRequestSchema.js"
import {
  type ProjectGrantDeleteResponse,
  projectGrantDeleteResponseSchema,
} from "../public/projectGrantDeleteResponseSchema.js"
import {
  type ProjectGrantLifecycleRequest,
  projectGrantLifecycleRequestSchema,
} from "../public/projectGrantLifecycleRequestSchema.js"
import {
  type ProjectGrantListResponse,
  projectGrantListResponseSchema,
} from "../public/projectGrantListResponseSchema.js"
import { type ProjectGrantResponse, projectGrantResponseSchema } from "../public/projectGrantResponseSchema.js"
import {
  type ProjectGrantUpdateRequest,
  projectGrantUpdateRequestSchema,
} from "../public/projectGrantUpdateRequestSchema.js"
import { type ProjectLifecycleRequest, projectLifecycleRequestSchema } from "../public/projectLifecycleRequestSchema.js"
import { type ProjectListResponse, projectListResponseSchema } from "../public/projectListResponseSchema.js"
import { type ProjectResponse, projectResponseSchema } from "../public/projectResponseSchema.js"
import {
  type ProjectRoleCreateRequest,
  projectRoleCreateRequestSchema,
} from "../public/projectRoleCreateRequestSchema.js"
import {
  type ProjectRoleDeleteResponse,
  projectRoleDeleteResponseSchema,
} from "../public/projectRoleDeleteResponseSchema.js"
import { type ProjectRoleListResponse, projectRoleListResponseSchema } from "../public/projectRoleListResponseSchema.js"
import { type ProjectRoleResponse, projectRoleResponseSchema } from "../public/projectRoleResponseSchema.js"
import {
  type ProjectRoleUpdateRequest,
  projectRoleUpdateRequestSchema,
} from "../public/projectRoleUpdateRequestSchema.js"
import { type ProjectUpdateRequest, projectUpdateRequestSchema } from "../public/projectUpdateRequestSchema.js"

type ProjectApiFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

type ProjectApiClientCreateOptions = {
  readonly baseUrl: string
  readonly csrfToken?: string
  readonly fetch?: ProjectApiFetch
  readonly token?: Secret | string
}

export function projectApiClientCreate(options: ProjectApiClientCreateOptions) {
  const request = <T>(path: string, init: RequestInit, schema: v.GenericSchema<T>): Promise<Result<T>> =>
    httpApiClientRequest({
      baseUrl: options.baseUrl,
      fetch: options.fetch,
      init,
      op: "projectApiClientRequest",
      path,
      schema,
      token: options.token,
    })
  const getRequest = <T>(
    path: string,
    schema: v.GenericSchema<T>,
    getOptions?: HttpGetOptions,
  ): Promise<HttpGetResult<T>> =>
    httpApiClientGetRequest({
      baseUrl: options.baseUrl,
      fetch: options.fetch,
      ifModifiedSince: getOptions?.ifModifiedSince,
      init: { method: "GET" },
      op: "projectApiClientRequest",
      path,
      schema,
      token: options.token,
    })
  const jsonRequest = (input: unknown): RequestInit => ({ body: JSON.stringify(input), method: "POST" })
  const patchRequest = (input: unknown): RequestInit => ({ body: JSON.stringify(input), method: "PATCH" })
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
      op: "projectApiClientTenantRequest",
      path,
      schema,
    })
  const browserGetRequest = <T>(
    path: string,
    schema: v.GenericSchema<T>,
    getOptions?: HttpGetOptions,
  ): Promise<HttpGetResult<T>> =>
    httpApiClientGetRequest({
      baseUrl: options.baseUrl,
      fetch: options.fetch,
      ifModifiedSince: getOptions?.ifModifiedSince,
      init: browserRequestInit({ method: "GET" }),
      op: "projectApiClientTenantRequest",
      path,
      schema,
    })
  const projectPath = (realmId: string, projectId?: string) =>
    `/system/realms/${encodeURIComponent(realmId)}/projects${projectId === undefined ? "" : `/${encodeURIComponent(projectId)}`}`
  const projectTenantPath = (realmId: string, projectId?: string) =>
    `/realms/${encodeURIComponent(realmId)}/projects${projectId === undefined ? "" : `/${encodeURIComponent(projectId)}`}`

  return {
    projectTenantAccessCheck(realmId: string, projectId: string): Promise<Result<ProjectAccessResponse>> {
      return browserRequest(
        `${projectTenantPath(realmId, projectId)}/access`,
        { method: "GET" },
        projectAccessResponseSchema,
      )
    },
    projectTenantApplicationCreate(
      realmId: string,
      projectId: string,
      input: ProjectApplicationCreateRequest,
    ): Promise<Result<ProjectApplicationResponse>> {
      const parsed = v.safeParse(projectApplicationCreateRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCodedCreate(
            "projectApiClientTenantApplicationCreate",
            "The application request is invalid.",
            "projects.invalid",
          ),
        )
      return browserRequest(
        `${projectTenantPath(realmId, projectId)}/applications`,
        jsonRequest(parsed.output),
        projectApplicationResponseSchema,
      )
    },
    projectTenantApplicationDelete(
      realmId: string,
      projectId: string,
      applicationId: string,
    ): Promise<Result<ProjectApplicationDeleteResponse>> {
      return browserRequest(
        `${projectTenantPath(realmId, projectId)}/applications/${encodeURIComponent(applicationId)}`,
        { method: "DELETE" },
        projectApplicationDeleteResponseSchema,
      )
    },
    projectTenantApplicationGet(
      realmId: string,
      projectId: string,
      applicationId: string,
      getOptions?: HttpGetOptions,
    ): Promise<HttpGetResult<ProjectApplicationResponse>> {
      return browserGetRequest(
        `${projectTenantPath(realmId, projectId)}/applications/${encodeURIComponent(applicationId)}`,
        projectApplicationResponseSchema,
        getOptions,
      )
    },
    projectTenantApplicationLifecycleSet(
      realmId: string,
      projectId: string,
      applicationId: string,
      input: ProjectApplicationLifecycleRequest,
    ): Promise<Result<ProjectApplicationResponse>> {
      const parsed = v.safeParse(projectApplicationLifecycleRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCodedCreate(
            "projectApiClientTenantApplicationLifecycleSet",
            "The application lifecycle request is invalid.",
            "projects.invalid",
          ),
        )
      return browserRequest(
        `${projectTenantPath(realmId, projectId)}/applications/${encodeURIComponent(applicationId)}/lifecycle`,
        jsonRequest(parsed.output),
        projectApplicationResponseSchema,
      )
    },
    projectTenantApplicationList(
      realmId: string,
      projectId: string,
      query?: ListQuery,
    ): Promise<Result<ProjectApplicationListResponse>> {
      return browserRequest(
        projectListPath(`${projectTenantPath(realmId, projectId)}/applications`, query),
        { method: "GET" },
        projectApplicationListResponseSchema,
      )
    },
    projectTenantApplicationUpdate(
      realmId: string,
      projectId: string,
      applicationId: string,
      input: ProjectApplicationUpdateRequest,
    ): Promise<Result<ProjectApplicationResponse>> {
      const parsed = v.safeParse(projectApplicationUpdateRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCodedCreate(
            "projectApiClientTenantApplicationUpdate",
            "The application update is invalid.",
            "projects.invalid",
          ),
        )
      return browserRequest(
        `${projectTenantPath(realmId, projectId)}/applications/${encodeURIComponent(applicationId)}`,
        patchRequest(parsed.output),
        projectApplicationResponseSchema,
      )
    },
    projectTenantCreate(realmId: string, input: ProjectCreateRequest): Promise<Result<ProjectResponse>> {
      const parsed = v.safeParse(projectCreateRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCodedCreate("projectApiClientTenantCreate", "The project request is invalid.", "projects.invalid"),
        )
      return browserRequest(projectTenantPath(realmId), jsonRequest(parsed.output), projectResponseSchema)
    },
    projectTenantDelete(realmId: string, projectId: string): Promise<Result<ProjectDeleteResponse>> {
      return browserRequest(projectTenantPath(realmId, projectId), { method: "DELETE" }, projectDeleteResponseSchema)
    },
    projectTenantGet(
      realmId: string,
      projectId: string,
      getOptions?: HttpGetOptions,
    ): Promise<HttpGetResult<ProjectResponse>> {
      return browserGetRequest(projectTenantPath(realmId, projectId), projectResponseSchema, getOptions)
    },
    projectTenantGrantCreate(
      realmId: string,
      projectId: string,
      input: ProjectGrantCreateRequest,
    ): Promise<Result<ProjectGrantResponse>> {
      const parsed = v.safeParse(projectGrantCreateRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCodedCreate(
            "projectApiClientTenantGrantCreate",
            "The project grant request is invalid.",
            "projects.invalid",
          ),
        )
      return browserRequest(
        `${projectTenantPath(realmId, projectId)}/grants`,
        jsonRequest(parsed.output),
        projectGrantResponseSchema,
      )
    },
    projectTenantGrantDelete(
      realmId: string,
      projectId: string,
      grantId: string,
    ): Promise<Result<ProjectGrantDeleteResponse>> {
      return browserRequest(
        `${projectTenantPath(realmId, projectId)}/grants/${encodeURIComponent(grantId)}`,
        { method: "DELETE" },
        projectGrantDeleteResponseSchema,
      )
    },
    projectTenantGrantLifecycleSet(
      realmId: string,
      projectId: string,
      grantId: string,
      input: ProjectGrantLifecycleRequest,
    ): Promise<Result<ProjectGrantResponse>> {
      const parsed = v.safeParse(projectGrantLifecycleRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCodedCreate(
            "projectApiClientTenantGrantLifecycleSet",
            "The project grant lifecycle request is invalid.",
            "projects.invalid",
          ),
        )
      return browserRequest(
        `${projectTenantPath(realmId, projectId)}/grants/${encodeURIComponent(grantId)}/lifecycle`,
        jsonRequest(parsed.output),
        projectGrantResponseSchema,
      )
    },
    projectTenantGrantList(
      realmId: string,
      projectId: string,
      query?: ListQuery,
    ): Promise<Result<ProjectGrantListResponse>> {
      return browserRequest(
        projectListPath(`${projectTenantPath(realmId, projectId)}/grants`, query),
        { method: "GET" },
        projectGrantListResponseSchema,
      )
    },
    projectTenantGrantUpdate(
      realmId: string,
      projectId: string,
      grantId: string,
      input: ProjectGrantUpdateRequest,
    ): Promise<Result<ProjectGrantResponse>> {
      const parsed = v.safeParse(projectGrantUpdateRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCodedCreate(
            "projectApiClientTenantGrantUpdate",
            "The project grant update is invalid.",
            "projects.invalid",
          ),
        )
      return browserRequest(
        `${projectTenantPath(realmId, projectId)}/grants/${encodeURIComponent(grantId)}`,
        patchRequest(parsed.output),
        projectGrantResponseSchema,
      )
    },
    projectTenantLifecycleSet(
      realmId: string,
      projectId: string,
      input: ProjectLifecycleRequest,
    ): Promise<Result<ProjectResponse>> {
      const parsed = v.safeParse(projectLifecycleRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCodedCreate(
            "projectApiClientTenantLifecycleSet",
            "The project lifecycle request is invalid.",
            "projects.invalid",
          ),
        )
      return browserRequest(
        `${projectTenantPath(realmId, projectId)}/lifecycle`,
        jsonRequest(parsed.output),
        projectResponseSchema,
      )
    },
    projectTenantList(realmId: string, query?: ListQuery): Promise<Result<ProjectListResponse>> {
      return browserRequest(
        projectListPath(projectTenantPath(realmId), query),
        { method: "GET" },
        projectListResponseSchema,
      )
    },
    projectTenantRoleCreate(
      realmId: string,
      projectId: string,
      input: ProjectRoleCreateRequest,
    ): Promise<Result<ProjectRoleResponse>> {
      const parsed = v.safeParse(projectRoleCreateRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCodedCreate(
            "projectApiClientTenantRoleCreate",
            "The project role request is invalid.",
            "projects.invalid",
          ),
        )
      return browserRequest(
        `${projectTenantPath(realmId, projectId)}/roles`,
        jsonRequest(parsed.output),
        projectRoleResponseSchema,
      )
    },
    projectTenantRoleDelete(
      realmId: string,
      projectId: string,
      roleId: string,
    ): Promise<Result<ProjectRoleDeleteResponse>> {
      return browserRequest(
        `${projectTenantPath(realmId, projectId)}/roles/${encodeURIComponent(roleId)}`,
        { method: "DELETE" },
        projectRoleDeleteResponseSchema,
      )
    },
    projectTenantRoleList(
      realmId: string,
      projectId: string,
      query?: ListQuery,
    ): Promise<Result<ProjectRoleListResponse>> {
      return browserRequest(
        projectListPath(`${projectTenantPath(realmId, projectId)}/roles`, query),
        { method: "GET" },
        projectRoleListResponseSchema,
      )
    },
    projectTenantRoleUpdate(
      realmId: string,
      projectId: string,
      roleId: string,
      input: ProjectRoleUpdateRequest,
    ): Promise<Result<ProjectRoleResponse>> {
      const parsed = v.safeParse(projectRoleUpdateRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCodedCreate(
            "projectApiClientTenantRoleUpdate",
            "The project role update is invalid.",
            "projects.invalid",
          ),
        )
      return browserRequest(
        `${projectTenantPath(realmId, projectId)}/roles/${encodeURIComponent(roleId)}`,
        patchRequest(parsed.output),
        projectRoleResponseSchema,
      )
    },
    projectTenantUpdate(
      realmId: string,
      projectId: string,
      input: ProjectUpdateRequest,
    ): Promise<Result<ProjectResponse>> {
      const parsed = v.safeParse(projectUpdateRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCodedCreate("projectApiClientTenantUpdate", "The project update is invalid.", "projects.invalid"),
        )
      return browserRequest(projectTenantPath(realmId, projectId), patchRequest(parsed.output), projectResponseSchema)
    },
    projectAccessCheck(realmId: string, projectId: string): Promise<Result<ProjectAccessResponse>> {
      return request(`${projectPath(realmId, projectId)}/access`, { method: "GET" }, projectAccessResponseSchema)
    },
    projectApplicationCreate(
      realmId: string,
      projectId: string,
      input: ProjectApplicationCreateRequest,
    ): Promise<Result<ProjectApplicationResponse>> {
      const parsed = v.safeParse(projectApplicationCreateRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCodedCreate(
            "projectApiClientApplicationCreate",
            "The application request is invalid.",
            "projects.invalid",
          ),
        )
      return request(
        `${projectPath(realmId, projectId)}/applications`,
        jsonRequest(parsed.output),
        projectApplicationResponseSchema,
      )
    },
    projectApplicationDelete(
      realmId: string,
      projectId: string,
      applicationId: string,
    ): Promise<Result<ProjectApplicationDeleteResponse>> {
      return request(
        `${projectPath(realmId, projectId)}/applications/${encodeURIComponent(applicationId)}`,
        { method: "DELETE" },
        projectApplicationDeleteResponseSchema,
      )
    },
    projectApplicationGet(
      realmId: string,
      projectId: string,
      applicationId: string,
      getOptions?: HttpGetOptions,
    ): Promise<HttpGetResult<ProjectApplicationResponse>> {
      return getRequest(
        `${projectPath(realmId, projectId)}/applications/${encodeURIComponent(applicationId)}`,
        projectApplicationResponseSchema,
        getOptions,
      )
    },
    projectApplicationLifecycleSet(
      realmId: string,
      projectId: string,
      applicationId: string,
      input: ProjectApplicationLifecycleRequest,
    ): Promise<Result<ProjectApplicationResponse>> {
      const parsed = v.safeParse(projectApplicationLifecycleRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCodedCreate(
            "projectApiClientApplicationLifecycleSet",
            "The application lifecycle request is invalid.",
            "projects.invalid",
          ),
        )
      return request(
        `${projectPath(realmId, projectId)}/applications/${encodeURIComponent(applicationId)}/lifecycle`,
        jsonRequest(parsed.output),
        projectApplicationResponseSchema,
      )
    },
    projectApplicationList(
      realmId: string,
      projectId: string,
      query?: ListQuery,
    ): Promise<Result<ProjectApplicationListResponse>> {
      return request(
        projectListPath(`${projectPath(realmId, projectId)}/applications`, query),
        { method: "GET" },
        projectApplicationListResponseSchema,
      )
    },
    projectApplicationUpdate(
      realmId: string,
      projectId: string,
      applicationId: string,
      input: ProjectApplicationUpdateRequest,
    ): Promise<Result<ProjectApplicationResponse>> {
      const parsed = v.safeParse(projectApplicationUpdateRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCodedCreate(
            "projectApiClientApplicationUpdate",
            "The application update is invalid.",
            "projects.invalid",
          ),
        )
      return request(
        `${projectPath(realmId, projectId)}/applications/${encodeURIComponent(applicationId)}`,
        patchRequest(parsed.output),
        projectApplicationResponseSchema,
      )
    },
    projectCreate(realmId: string, input: ProjectCreateRequest): Promise<Result<ProjectResponse>> {
      const parsed = v.safeParse(projectCreateRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCodedCreate("projectApiClientCreate", "The project request is invalid.", "projects.invalid"),
        )
      return request(projectPath(realmId), jsonRequest(parsed.output), projectResponseSchema)
    },
    projectDelete(realmId: string, projectId: string): Promise<Result<ProjectDeleteResponse>> {
      return request(projectPath(realmId, projectId), { method: "DELETE" }, projectDeleteResponseSchema)
    },
    projectGet(
      realmId: string,
      projectId: string,
      getOptions?: HttpGetOptions,
    ): Promise<HttpGetResult<ProjectResponse>> {
      return getRequest(projectPath(realmId, projectId), projectResponseSchema, getOptions)
    },
    projectGrantCreate(
      realmId: string,
      projectId: string,
      input: ProjectGrantCreateRequest,
    ): Promise<Result<ProjectGrantResponse>> {
      const parsed = v.safeParse(projectGrantCreateRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCodedCreate(
            "projectApiClientGrantCreate",
            "The project grant request is invalid.",
            "projects.invalid",
          ),
        )
      return request(
        `${projectPath(realmId, projectId)}/grants`,
        jsonRequest(parsed.output),
        projectGrantResponseSchema,
      )
    },
    projectGrantDelete(
      realmId: string,
      projectId: string,
      grantId: string,
    ): Promise<Result<ProjectGrantDeleteResponse>> {
      return request(
        `${projectPath(realmId, projectId)}/grants/${encodeURIComponent(grantId)}`,
        { method: "DELETE" },
        projectGrantDeleteResponseSchema,
      )
    },
    projectGrantLifecycleSet(
      realmId: string,
      projectId: string,
      grantId: string,
      input: ProjectGrantLifecycleRequest,
    ): Promise<Result<ProjectGrantResponse>> {
      const parsed = v.safeParse(projectGrantLifecycleRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCodedCreate(
            "projectApiClientGrantLifecycleSet",
            "The project grant lifecycle request is invalid.",
            "projects.invalid",
          ),
        )
      return request(
        `${projectPath(realmId, projectId)}/grants/${encodeURIComponent(grantId)}/lifecycle`,
        jsonRequest(parsed.output),
        projectGrantResponseSchema,
      )
    },
    projectGrantList(realmId: string, projectId: string, query?: ListQuery): Promise<Result<ProjectGrantListResponse>> {
      return request(
        projectListPath(`${projectPath(realmId, projectId)}/grants`, query),
        { method: "GET" },
        projectGrantListResponseSchema,
      )
    },
    projectGrantUpdate(
      realmId: string,
      projectId: string,
      grantId: string,
      input: ProjectGrantUpdateRequest,
    ): Promise<Result<ProjectGrantResponse>> {
      const parsed = v.safeParse(projectGrantUpdateRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCodedCreate(
            "projectApiClientGrantUpdate",
            "The project grant update is invalid.",
            "projects.invalid",
          ),
        )
      return request(
        `${projectPath(realmId, projectId)}/grants/${encodeURIComponent(grantId)}`,
        patchRequest(parsed.output),
        projectGrantResponseSchema,
      )
    },
    projectLifecycleSet(
      realmId: string,
      projectId: string,
      input: ProjectLifecycleRequest,
    ): Promise<Result<ProjectResponse>> {
      const parsed = v.safeParse(projectLifecycleRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCodedCreate(
            "projectApiClientLifecycleSet",
            "The project lifecycle request is invalid.",
            "projects.invalid",
          ),
        )
      return request(`${projectPath(realmId, projectId)}/lifecycle`, jsonRequest(parsed.output), projectResponseSchema)
    },
    projectList(realmId: string, query?: ListQuery): Promise<Result<ProjectListResponse>> {
      return request(projectListPath(projectPath(realmId), query), { method: "GET" }, projectListResponseSchema)
    },
    projectRoleCreate(
      realmId: string,
      projectId: string,
      input: ProjectRoleCreateRequest,
    ): Promise<Result<ProjectRoleResponse>> {
      const parsed = v.safeParse(projectRoleCreateRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCodedCreate(
            "projectApiClientRoleCreate",
            "The project role request is invalid.",
            "projects.invalid",
          ),
        )
      return request(`${projectPath(realmId, projectId)}/roles`, jsonRequest(parsed.output), projectRoleResponseSchema)
    },
    projectRoleDelete(realmId: string, projectId: string, roleId: string): Promise<Result<ProjectRoleDeleteResponse>> {
      return request(
        `${projectPath(realmId, projectId)}/roles/${encodeURIComponent(roleId)}`,
        { method: "DELETE" },
        projectRoleDeleteResponseSchema,
      )
    },
    projectRoleList(realmId: string, projectId: string, query?: ListQuery): Promise<Result<ProjectRoleListResponse>> {
      return request(
        projectListPath(`${projectPath(realmId, projectId)}/roles`, query),
        { method: "GET" },
        projectRoleListResponseSchema,
      )
    },
    projectRoleUpdate(
      realmId: string,
      projectId: string,
      roleId: string,
      input: ProjectRoleUpdateRequest,
    ): Promise<Result<ProjectRoleResponse>> {
      const parsed = v.safeParse(projectRoleUpdateRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCodedCreate(
            "projectApiClientRoleUpdate",
            "The project role update is invalid.",
            "projects.invalid",
          ),
        )
      return request(
        `${projectPath(realmId, projectId)}/roles/${encodeURIComponent(roleId)}`,
        patchRequest(parsed.output),
        projectRoleResponseSchema,
      )
    },
    projectUpdate(realmId: string, projectId: string, input: ProjectUpdateRequest): Promise<Result<ProjectResponse>> {
      const parsed = v.safeParse(projectUpdateRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCodedCreate("projectApiClientUpdate", "The project update is invalid.", "projects.invalid"),
        )
      return request(projectPath(realmId, projectId), patchRequest(parsed.output), projectResponseSchema)
    },
  }
}

function projectListPath(path: string, query: ListQuery | undefined): string {
  if (query === undefined) return path
  const params = new URLSearchParams()
  if (query.pageSize !== undefined) params.set("pageSize", String(query.pageSize))
  if (query.pageToken !== undefined) params.set("pageToken", query.pageToken)
  if (query.sortBy !== undefined) params.set("sortBy", query.sortBy)
  if (query.sortDirection !== undefined) params.set("sortDirection", query.sortDirection)
  const encoded = params.toString()
  return encoded.length === 0 ? path : `${path}?${encoded}`
}
