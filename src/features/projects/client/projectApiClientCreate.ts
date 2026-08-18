import * as v from "valibot"
import { type Result } from "#result"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { httpApiClientRequest } from "../../../platform/http/httpApiClientRequest.js"
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
  type ProjectApplicationListResponse,
  projectApplicationListResponseSchema,
} from "../public/projectApplicationListResponseSchema.js"
import {
  type ProjectApplicationLifecycleRequest,
  projectApplicationLifecycleRequestSchema,
} from "../public/projectApplicationLifecycleRequestSchema.js"
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
  type ProjectGrantListResponse,
  projectGrantListResponseSchema,
} from "../public/projectGrantListResponseSchema.js"
import {
  type ProjectGrantLifecycleRequest,
  projectGrantLifecycleRequestSchema,
} from "../public/projectGrantLifecycleRequestSchema.js"
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
  const jsonRequest = (input: unknown): RequestInit => ({ body: JSON.stringify(input), method: "POST" })
  const patchRequest = (input: unknown): RequestInit => ({ body: JSON.stringify(input), method: "PATCH" })
  const projectPath = (realmId: string, projectId?: string) =>
    `/system/realms/${encodeURIComponent(realmId)}/projects${projectId === undefined ? "" : `/${encodeURIComponent(projectId)}`}`

  return {
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
          resultErrorCreate("projectApiClientApplicationCreate", "The application request is invalid."),
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
    ): Promise<Result<ProjectApplicationResponse>> {
      return request(
        `${projectPath(realmId, projectId)}/applications/${encodeURIComponent(applicationId)}`,
        { method: "GET" },
        projectApplicationResponseSchema,
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
          resultErrorCreate("projectApiClientApplicationLifecycleSet", "The application lifecycle request is invalid."),
        )
      return request(
        `${projectPath(realmId, projectId)}/applications/${encodeURIComponent(applicationId)}/lifecycle`,
        jsonRequest(parsed.output),
        projectApplicationResponseSchema,
      )
    },
    projectApplicationList(realmId: string, projectId: string): Promise<Result<ProjectApplicationListResponse>> {
      return request(
        `${projectPath(realmId, projectId)}/applications`,
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
          resultErrorCreate("projectApiClientApplicationUpdate", "The application update is invalid."),
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
        return Promise.resolve(resultErrorCreate("projectApiClientCreate", "The project request is invalid."))
      return request(projectPath(realmId), jsonRequest(parsed.output), projectResponseSchema)
    },
    projectDelete(realmId: string, projectId: string): Promise<Result<ProjectDeleteResponse>> {
      return request(projectPath(realmId, projectId), { method: "DELETE" }, projectDeleteResponseSchema)
    },
    projectGet(realmId: string, projectId: string): Promise<Result<ProjectResponse>> {
      return request(projectPath(realmId, projectId), { method: "GET" }, projectResponseSchema)
    },
    projectGrantCreate(
      realmId: string,
      projectId: string,
      input: ProjectGrantCreateRequest,
    ): Promise<Result<ProjectGrantResponse>> {
      const parsed = v.safeParse(projectGrantCreateRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCreate("projectApiClientGrantCreate", "The project grant request is invalid."),
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
          resultErrorCreate("projectApiClientGrantLifecycleSet", "The project grant lifecycle request is invalid."),
        )
      return request(
        `${projectPath(realmId, projectId)}/grants/${encodeURIComponent(grantId)}/lifecycle`,
        jsonRequest(parsed.output),
        projectGrantResponseSchema,
      )
    },
    projectGrantList(realmId: string, projectId: string): Promise<Result<ProjectGrantListResponse>> {
      return request(`${projectPath(realmId, projectId)}/grants`, { method: "GET" }, projectGrantListResponseSchema)
    },
    projectGrantUpdate(
      realmId: string,
      projectId: string,
      grantId: string,
      input: ProjectGrantUpdateRequest,
    ): Promise<Result<ProjectGrantResponse>> {
      const parsed = v.safeParse(projectGrantUpdateRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(resultErrorCreate("projectApiClientGrantUpdate", "The project grant update is invalid."))
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
          resultErrorCreate("projectApiClientLifecycleSet", "The project lifecycle request is invalid."),
        )
      return request(`${projectPath(realmId, projectId)}/lifecycle`, jsonRequest(parsed.output), projectResponseSchema)
    },
    projectList(realmId: string): Promise<Result<ProjectListResponse>> {
      return request(projectPath(realmId), { method: "GET" }, projectListResponseSchema)
    },
    projectRoleCreate(
      realmId: string,
      projectId: string,
      input: ProjectRoleCreateRequest,
    ): Promise<Result<ProjectRoleResponse>> {
      const parsed = v.safeParse(projectRoleCreateRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(resultErrorCreate("projectApiClientRoleCreate", "The project role request is invalid."))
      return request(`${projectPath(realmId, projectId)}/roles`, jsonRequest(parsed.output), projectRoleResponseSchema)
    },
    projectRoleDelete(realmId: string, projectId: string, roleId: string): Promise<Result<ProjectRoleDeleteResponse>> {
      return request(
        `${projectPath(realmId, projectId)}/roles/${encodeURIComponent(roleId)}`,
        { method: "DELETE" },
        projectRoleDeleteResponseSchema,
      )
    },
    projectRoleList(realmId: string, projectId: string): Promise<Result<ProjectRoleListResponse>> {
      return request(`${projectPath(realmId, projectId)}/roles`, { method: "GET" }, projectRoleListResponseSchema)
    },
    projectRoleUpdate(
      realmId: string,
      projectId: string,
      roleId: string,
      input: ProjectRoleUpdateRequest,
    ): Promise<Result<ProjectRoleResponse>> {
      const parsed = v.safeParse(projectRoleUpdateRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(resultErrorCreate("projectApiClientRoleUpdate", "The project role update is invalid."))
      return request(
        `${projectPath(realmId, projectId)}/roles/${encodeURIComponent(roleId)}`,
        patchRequest(parsed.output),
        projectRoleResponseSchema,
      )
    },
    projectUpdate(realmId: string, projectId: string, input: ProjectUpdateRequest): Promise<Result<ProjectResponse>> {
      const parsed = v.safeParse(projectUpdateRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(resultErrorCreate("projectApiClientUpdate", "The project update is invalid."))
      return request(projectPath(realmId, projectId), patchRequest(parsed.output), projectResponseSchema)
    },
  }
}
