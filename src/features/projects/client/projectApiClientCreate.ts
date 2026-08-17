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
  const projectPath = (instanceId: string, projectId?: string) =>
    `/system/instances/${encodeURIComponent(instanceId)}/projects${projectId === undefined ? "" : `/${encodeURIComponent(projectId)}`}`

  return {
    projectAccessCheck(instanceId: string, projectId: string): Promise<Result<ProjectAccessResponse>> {
      return request(`${projectPath(instanceId, projectId)}/access`, { method: "GET" }, projectAccessResponseSchema)
    },
    projectApplicationCreate(
      instanceId: string,
      projectId: string,
      input: ProjectApplicationCreateRequest,
    ): Promise<Result<ProjectApplicationResponse>> {
      const parsed = v.safeParse(projectApplicationCreateRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCreate("projectApiClientApplicationCreate", "The application request is invalid."),
        )
      return request(
        `${projectPath(instanceId, projectId)}/applications`,
        jsonRequest(parsed.output),
        projectApplicationResponseSchema,
      )
    },
    projectApplicationDelete(
      instanceId: string,
      projectId: string,
      applicationId: string,
    ): Promise<Result<ProjectApplicationDeleteResponse>> {
      return request(
        `${projectPath(instanceId, projectId)}/applications/${encodeURIComponent(applicationId)}`,
        { method: "DELETE" },
        projectApplicationDeleteResponseSchema,
      )
    },
    projectApplicationGet(
      instanceId: string,
      projectId: string,
      applicationId: string,
    ): Promise<Result<ProjectApplicationResponse>> {
      return request(
        `${projectPath(instanceId, projectId)}/applications/${encodeURIComponent(applicationId)}`,
        { method: "GET" },
        projectApplicationResponseSchema,
      )
    },
    projectApplicationLifecycleSet(
      instanceId: string,
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
        `${projectPath(instanceId, projectId)}/applications/${encodeURIComponent(applicationId)}/lifecycle`,
        jsonRequest(parsed.output),
        projectApplicationResponseSchema,
      )
    },
    projectApplicationList(instanceId: string, projectId: string): Promise<Result<ProjectApplicationListResponse>> {
      return request(
        `${projectPath(instanceId, projectId)}/applications`,
        { method: "GET" },
        projectApplicationListResponseSchema,
      )
    },
    projectApplicationUpdate(
      instanceId: string,
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
        `${projectPath(instanceId, projectId)}/applications/${encodeURIComponent(applicationId)}`,
        patchRequest(parsed.output),
        projectApplicationResponseSchema,
      )
    },
    projectCreate(instanceId: string, input: ProjectCreateRequest): Promise<Result<ProjectResponse>> {
      const parsed = v.safeParse(projectCreateRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(resultErrorCreate("projectApiClientCreate", "The project request is invalid."))
      return request(projectPath(instanceId), jsonRequest(parsed.output), projectResponseSchema)
    },
    projectDelete(instanceId: string, projectId: string): Promise<Result<ProjectDeleteResponse>> {
      return request(projectPath(instanceId, projectId), { method: "DELETE" }, projectDeleteResponseSchema)
    },
    projectGet(instanceId: string, projectId: string): Promise<Result<ProjectResponse>> {
      return request(projectPath(instanceId, projectId), { method: "GET" }, projectResponseSchema)
    },
    projectGrantCreate(
      instanceId: string,
      projectId: string,
      input: ProjectGrantCreateRequest,
    ): Promise<Result<ProjectGrantResponse>> {
      const parsed = v.safeParse(projectGrantCreateRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCreate("projectApiClientGrantCreate", "The project grant request is invalid."),
        )
      return request(
        `${projectPath(instanceId, projectId)}/grants`,
        jsonRequest(parsed.output),
        projectGrantResponseSchema,
      )
    },
    projectGrantDelete(
      instanceId: string,
      projectId: string,
      grantId: string,
    ): Promise<Result<ProjectGrantDeleteResponse>> {
      return request(
        `${projectPath(instanceId, projectId)}/grants/${encodeURIComponent(grantId)}`,
        { method: "DELETE" },
        projectGrantDeleteResponseSchema,
      )
    },
    projectGrantLifecycleSet(
      instanceId: string,
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
        `${projectPath(instanceId, projectId)}/grants/${encodeURIComponent(grantId)}/lifecycle`,
        jsonRequest(parsed.output),
        projectGrantResponseSchema,
      )
    },
    projectGrantList(instanceId: string, projectId: string): Promise<Result<ProjectGrantListResponse>> {
      return request(`${projectPath(instanceId, projectId)}/grants`, { method: "GET" }, projectGrantListResponseSchema)
    },
    projectGrantUpdate(
      instanceId: string,
      projectId: string,
      grantId: string,
      input: ProjectGrantUpdateRequest,
    ): Promise<Result<ProjectGrantResponse>> {
      const parsed = v.safeParse(projectGrantUpdateRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(resultErrorCreate("projectApiClientGrantUpdate", "The project grant update is invalid."))
      return request(
        `${projectPath(instanceId, projectId)}/grants/${encodeURIComponent(grantId)}`,
        patchRequest(parsed.output),
        projectGrantResponseSchema,
      )
    },
    projectLifecycleSet(
      instanceId: string,
      projectId: string,
      input: ProjectLifecycleRequest,
    ): Promise<Result<ProjectResponse>> {
      const parsed = v.safeParse(projectLifecycleRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCreate("projectApiClientLifecycleSet", "The project lifecycle request is invalid."),
        )
      return request(
        `${projectPath(instanceId, projectId)}/lifecycle`,
        jsonRequest(parsed.output),
        projectResponseSchema,
      )
    },
    projectList(instanceId: string): Promise<Result<ProjectListResponse>> {
      return request(projectPath(instanceId), { method: "GET" }, projectListResponseSchema)
    },
    projectRoleCreate(
      instanceId: string,
      projectId: string,
      input: ProjectRoleCreateRequest,
    ): Promise<Result<ProjectRoleResponse>> {
      const parsed = v.safeParse(projectRoleCreateRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(resultErrorCreate("projectApiClientRoleCreate", "The project role request is invalid."))
      return request(
        `${projectPath(instanceId, projectId)}/roles`,
        jsonRequest(parsed.output),
        projectRoleResponseSchema,
      )
    },
    projectRoleDelete(
      instanceId: string,
      projectId: string,
      roleId: string,
    ): Promise<Result<ProjectRoleDeleteResponse>> {
      return request(
        `${projectPath(instanceId, projectId)}/roles/${encodeURIComponent(roleId)}`,
        { method: "DELETE" },
        projectRoleDeleteResponseSchema,
      )
    },
    projectRoleList(instanceId: string, projectId: string): Promise<Result<ProjectRoleListResponse>> {
      return request(`${projectPath(instanceId, projectId)}/roles`, { method: "GET" }, projectRoleListResponseSchema)
    },
    projectRoleUpdate(
      instanceId: string,
      projectId: string,
      roleId: string,
      input: ProjectRoleUpdateRequest,
    ): Promise<Result<ProjectRoleResponse>> {
      const parsed = v.safeParse(projectRoleUpdateRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(resultErrorCreate("projectApiClientRoleUpdate", "The project role update is invalid."))
      return request(
        `${projectPath(instanceId, projectId)}/roles/${encodeURIComponent(roleId)}`,
        patchRequest(parsed.output),
        projectRoleResponseSchema,
      )
    },
    projectUpdate(
      instanceId: string,
      projectId: string,
      input: ProjectUpdateRequest,
    ): Promise<Result<ProjectResponse>> {
      const parsed = v.safeParse(projectUpdateRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(resultErrorCreate("projectApiClientUpdate", "The project update is invalid."))
      return request(projectPath(instanceId, projectId), patchRequest(parsed.output), projectResponseSchema)
    },
  }
}
