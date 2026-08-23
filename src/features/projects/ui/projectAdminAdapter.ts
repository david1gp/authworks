import type { Result } from "#result"
import type { AuthorizationRoleDefinition } from "../../authorization/public/authorizationRoleDefinitionSchema.js"
import type { ProjectAccessResponse } from "../public/projectAccessResponseSchema.js"
import type { ProjectApplicationCreateRequest } from "../public/projectApplicationCreateRequestSchema.js"
import type { ProjectApplicationLifecycleRequest } from "../public/projectApplicationLifecycleRequestSchema.js"
import type { ProjectApplicationListResponse } from "../public/projectApplicationListResponseSchema.js"
import type { ProjectApplication } from "../public/projectApplicationSchema.js"
import type { ProjectApplicationUpdateRequest } from "../public/projectApplicationUpdateRequestSchema.js"
import type { ProjectCreateRequest } from "../public/projectCreateRequestSchema.js"
import type { ProjectGrantCreateRequest } from "../public/projectGrantCreateRequestSchema.js"
import type { ProjectGrantLifecycleRequest } from "../public/projectGrantLifecycleRequestSchema.js"
import type { ProjectGrantListResponse } from "../public/projectGrantListResponseSchema.js"
import type { ProjectGrant } from "../public/projectGrantSchema.js"
import type { ProjectGrantUpdateRequest } from "../public/projectGrantUpdateRequestSchema.js"
import type { ProjectLifecycleRequest } from "../public/projectLifecycleRequestSchema.js"
import type { ProjectListResponse } from "../public/projectListResponseSchema.js"
import type { ProjectRoleCreateRequest } from "../public/projectRoleCreateRequestSchema.js"
import type { ProjectRoleListResponse } from "../public/projectRoleListResponseSchema.js"
import type { ProjectRole } from "../public/projectRoleSchema.js"
import type { ProjectRoleUpdateRequest } from "../public/projectRoleUpdateRequestSchema.js"
import type { Project } from "../public/projectSchema.js"
import type { ProjectUpdateRequest } from "../public/projectUpdateRequestSchema.js"

/**
 * The single boundary that separates the shared stateless project administration
 * views from their production (network) and demo (fixture) data sources.
 */
export type ProjectAdminAdapter = {
  readonly applicationCreate: (
    projectId: string,
    input: ProjectApplicationCreateRequest,
  ) => Promise<Result<ProjectApplication>>
  readonly applicationLifecycleSet: (
    projectId: string,
    applicationId: string,
    input: ProjectApplicationLifecycleRequest,
  ) => Promise<Result<ProjectApplication>>
  readonly applicationList: (projectId: string, pageToken?: string) => Promise<Result<ProjectApplicationListResponse>>
  readonly applicationUpdate: (
    projectId: string,
    applicationId: string,
    input: ProjectApplicationUpdateRequest,
  ) => Promise<Result<ProjectApplication>>
  readonly grantCreate: (projectId: string, input: ProjectGrantCreateRequest) => Promise<Result<ProjectGrant>>
  readonly grantDelete: (projectId: string, grantId: string) => Promise<Result<{ readonly deleted: true }>>
  readonly grantLifecycleSet: (
    projectId: string,
    grantId: string,
    input: ProjectGrantLifecycleRequest,
  ) => Promise<Result<ProjectGrant>>
  readonly grantList: (projectId: string, pageToken?: string) => Promise<Result<ProjectGrantListResponse>>
  readonly grantUpdate: (
    projectId: string,
    grantId: string,
    input: ProjectGrantUpdateRequest,
  ) => Promise<Result<ProjectGrant>>
  /** Read-only fixed role/permission catalogue used by the effective access view. */
  readonly permissionRoles: () => readonly AuthorizationRoleDefinition[]
  readonly projectAccessCheck: (projectId: string) => Promise<Result<ProjectAccessResponse>>
  readonly projectCreate: (input: ProjectCreateRequest) => Promise<Result<Project>>
  readonly projectDelete: (projectId: string) => Promise<Result<{ readonly deleted: true }>>
  readonly projectGet: (projectId: string) => Promise<Result<Project>>
  readonly projectLifecycleSet: (projectId: string, input: ProjectLifecycleRequest) => Promise<Result<Project>>
  readonly projectList: (pageToken?: string) => Promise<Result<ProjectListResponse>>
  readonly projectUpdate: (projectId: string, input: ProjectUpdateRequest) => Promise<Result<Project>>
  readonly roleCreate: (projectId: string, input: ProjectRoleCreateRequest) => Promise<Result<ProjectRole>>
  readonly roleDelete: (projectId: string, roleId: string) => Promise<Result<{ readonly deleted: true }>>
  readonly roleList: (projectId: string, pageToken?: string) => Promise<Result<ProjectRoleListResponse>>
  readonly roleUpdate: (
    projectId: string,
    roleId: string,
    input: ProjectRoleUpdateRequest,
  ) => Promise<Result<ProjectRole>>
  /** Organizations the operator may reference when creating projects or grants. */
  readonly organizations: () => Promise<Result<readonly { readonly id: string; readonly name: string }[]>>
}
