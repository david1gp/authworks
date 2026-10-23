import type { Result } from "#result"
import type { OrganizationRole } from "../../organizations/public/organizationRoleSchema.js"
import type { ProjectListItem } from "../../projects/public/projectListItemSchema.js"
import type { ProjectRoleCreateRequest } from "../../projects/public/projectRoleCreateRequestSchema.js"
import type { ProjectRole } from "../../projects/public/projectRoleSchema.js"
import type { ProjectRoleUpdateRequest } from "../../projects/public/projectRoleUpdateRequestSchema.js"
import type { DirectoryOrganizationUserSummary } from "../public/directoryOrganizationUserSummarySchema.js"

/** One project of the active organization with its roles; `owned` gates mutation UI. */
export type DirectoryRolesProjectEntry = {
  readonly owned: boolean
  readonly project: ProjectListItem
  readonly roles: readonly ProjectRole[]
}

/**
 * The single boundary between the shared stateless roles views and their
 * production (network) and demo (fixture) data sources.
 */
export type DirectoryRolesAdapter = {
  readonly organizationRoleList: () => Promise<Result<readonly OrganizationRole[]>>
  readonly projectList: () => Promise<Result<readonly ProjectListItem[]>>
  readonly projectRoleCreate: (projectId: string, input: ProjectRoleCreateRequest) => Promise<Result<ProjectRole>>
  readonly projectRoleDelete: (projectId: string, roleId: string) => Promise<Result<{ readonly deleted: true }>>
  readonly projectRoleList: (projectId: string) => Promise<Result<readonly ProjectRole[]>>
  readonly projectRoleUpdate: (
    projectId: string,
    roleId: string,
    input: ProjectRoleUpdateRequest,
  ) => Promise<Result<ProjectRole>>
  readonly userSummary: () => Promise<Result<DirectoryOrganizationUserSummary>>
}
